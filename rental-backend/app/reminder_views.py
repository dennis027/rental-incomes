"""
SMS reminders sent to tenants.

  GET  api/reminders/        the latest texts and whether SMS is set up
  POST api/reminders/send/   text tenants now {contract_ids: [..]}
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import billing, sms
from .models import SmsMessage
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
        wanted = {int(pk) for pk in request.data.get("contract_ids") or [] if str(pk).isdigit()}
        if not wanted:
            return Response({"contract_ids": ["Choose at least one tenant."]}, status=status.HTTP_400_BAD_REQUEST)

        account = request.user.account
        results = []
        for row in billing.arrears():
            if row["contract_id"] not in wanted:
                continue
            error = sms.send_reminder(row, SmsMessage.MANUAL, account)
            results.append({"contract_id": row["contract_id"], "customer_name": row["customer_name"],
                            "sent": error is None, "error": error or ""})
        return Response({
            "sent": len([r for r in results if r["sent"]]),
            "failed": len([r for r in results if not r["sent"]]),
            "results": results,
        })
