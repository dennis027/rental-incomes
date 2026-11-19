"""
SMS reminders sent to tenants.

  GET  api/reminders/        the latest texts and whether SMS is set up
  POST api/reminders/send/   text tenants now {contract_ids: [..]}; queued for the worker (202)
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import sms, tasks
from .models import RentalContract, SmsMessage
from .permissions import IsAccountMember


def _row(message):
    return {
        "id": message.id,
        "phone": message.phone,
        "message": message.message,
        "kind": message.kind,
        "kind_label": message.get_kind_display(),
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
        return Response({
            "configured": sms.configured(),
            "enabled": request.user.account.sms_reminders_enabled,
            "messages": [_row(message) for message in messages[:100]],
        })


class ReminderSendView(APIView):
    permission_classes = [IsAccountMember]

    def post(self, request):
        if not sms.configured():
            return Response({"error": "SMS is not set up on the server yet."}, status=status.HTTP_400_BAD_REQUEST)
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
