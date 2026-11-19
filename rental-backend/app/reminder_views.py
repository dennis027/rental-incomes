"""
SMS reminders sent to tenants.

  GET  api/reminders/        the latest texts and whether SMS is set up
  POST api/reminders/send/   text tenants now {contract_ids: [..]}; queued for the worker (202)
  POST api/reminders/whatsapp/  send one message written in KodiDesk on WhatsApp {phone, message, contract_id?}
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import sms, tasks, whatsapp
from .models import RentalContract, SmsMessage
from .permissions import IsAccountMember


def _row(message):
    return {
        "id": message.id,
        "phone": message.phone,
        "message": message.message,
        "kind": message.kind,
        "kind_label": message.get_kind_display(),
        "channel": message.channel,
        "channel_label": message.get_channel_display(),
        "sent": message.sent,
        "error": message.error,
        "invoice_number": message.invoice_number,
        "contract_id": message.contract_id,
        "created_at": message.created_at,
    }


class ReminderListView(APIView):
    permission_classes = [IsAccountMember]

    def get(self, request):
        messages = SmsMessage.objects.all()
        contract_id = request.query_params.get("contract_id")
        if contract_id and str(contract_id).isdigit():
            messages = messages.filter(contract_id=contract_id)
        account = request.user.account
        return Response({
            # Whether this account can send reminders on the channel it chose
            "configured": bool(sms.channels_for(account)),
            "channels": sms.channels_for(account),
            "enabled": account.sms_reminders_enabled,
            # Whether the WhatsApp message dialog can send from the business number
            "whatsapp_ready": whatsapp.configured(),
            "messages": [_row(message) for message in messages[:100]],
        })


class ReminderSendView(APIView):
    permission_classes = [IsAccountMember]

    def post(self, request):
        if not sms.channels_for(request.user.account):
            return Response({"error": "Reminders are not set up on the server yet for the channel this account uses."},
                            status=status.HTTP_400_BAD_REQUEST)
        ids = request.data.get("contract_ids")
        # A list of ids: a bare "12" must not be read as contracts 1 and 2
        if not isinstance(ids, list):
            return Response({"contract_ids": ["Send a list of contract ids."]}, status=status.HTTP_400_BAD_REQUEST)
        wanted = {int(pk) for pk in ids if str(pk).isdigit()}
        if not wanted:
            return Response({"contract_ids": ["Choose at least one tenant."]}, status=status.HTTP_400_BAD_REQUEST)

        # Only this account's contracts, and none texted by hand a moment ago:
        # repeating a request (a timeout, a double click) never texts anyone twice
        contracts = set(RentalContract.objects.filter(pk__in=wanted).values_list("pk", flat=True))
        recent = sms.recently_texted(contracts)
        queued = sorted(contracts - recent)
        if queued:
            # The texts go out from the worker; each one appears in the SMS log as it is sent
            tasks.send_manual_reminders.delay(request.user.account_id, queued)
        return Response({
            "queued": len(queued),
            "skipped_recent": len(recent),
        }, status=status.HTTP_202_ACCEPTED)


class WhatsAppMessageView(APIView):
    """
    POST api/reminders/whatsapp/ {phone, message, contract_id?}
    Sends a message written or edited in KodiDesk to a tenant on WhatsApp, from
    the business number, and keeps a record of it. Sent at once, not queued:
    it is one message, and the dialog shows whether WhatsApp took it.
    """
    permission_classes = [IsAccountMember]

    def post(self, request):
        if not whatsapp.configured():
            return Response({"error": "WhatsApp is not set up on the server yet."}, status=status.HTTP_400_BAD_REQUEST)
        phone = str(request.data.get("phone") or "").strip()
        text = str(request.data.get("message") or "")
        if sms.kenyan_number(phone) is None:
            return Response({"phone": ["Enter a Kenyan mobile number such as 0712 345 678."]},
                            status=status.HTTP_400_BAD_REQUEST)
        if not whatsapp.as_variable(text):
            return Response({"message": ["Write a message first."]}, status=status.HTTP_400_BAD_REQUEST)

        contract = None
        contract_id = request.data.get("contract_id")
        if contract_id not in (None, "") and str(contract_id).isdigit():
            # Only one of this account's contracts (the manager is scoped)
            contract = RentalContract.objects.filter(pk=contract_id).first()

        account = request.user.account
        error, sent_text = whatsapp.send_message(phone, text, account)
        SmsMessage.objects.create(
            account=account, contract=contract, phone=phone, message=sent_text,
            kind=SmsMessage.MANUAL, channel=SmsMessage.WHATSAPP, sent=error is None, error=error or "",
        )
        if error:
            return Response({"sent": False, "error": whatsapp.friendly_error(error)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"sent": True, "message": sent_text})
