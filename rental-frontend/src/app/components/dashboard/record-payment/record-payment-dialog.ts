import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { SharedImports } from '../../../shared-imports/imports';
import { BillingService } from '../../../services/billing';
import { PaymentService } from '../../../services/payments';
import { ReceiptService } from '../../../services/receipts';
import { RentDocument, RentDocumentData, receiptDocument } from '../rent-document/rent-document';

export interface RecordPaymentData {
  /** The tenant's current invoice. Left out when the user should pick the tenant first. */
  invoiceId?: number;
  tenant?: string;
  unit?: string;
  owes?: number;
  /** Limits the tenant list to one property when the tenant is picked here. */
  propertyId?: number | null;
}

/**
 * The one place a rent payment is recorded, used from Invoices, Arrears,
 * Payments and the dashboard. It ends on the receipt for the payment.
 * Closes with `true` when a payment was recorded.
 */
@Component({
  selector: 'app-record-payment-dialog',
  standalone: true,
  imports: [SharedImports, RentDocument],
  templateUrl: './record-payment-dialog.html',
  styleUrl: './record-payment-dialog.css'
})
export class RecordPaymentDialog implements OnInit {
  private billing = inject(BillingService);
  private payments = inject(PaymentService);
  private invoices = inject(ReceiptService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<RecordPaymentDialog>);
  data: RecordPaymentData = inject(MAT_DIALOG_DATA) ?? {};

  // Tenant picker, only when no invoice was given
  pickTenant = false;
  loadingTenants = false;
  tenants: any[] = [];
  tenantId: number | null = null;

  invoiceId: number | null = null;
  tenant = '';
  unit = '';
  owes = 0;

  form: FormGroup = this.fb.group({
    amount: [null, [Validators.required, Validators.min(1)]],
    method: ['mpesa', Validators.required],
    // Cash has no reference, so it is optional
    reference: [''],
    notes: [''],
  });
  saving = false;
  error = '';

  /** Set once the payment is saved; the dialog then shows its receipt. */
  receipt: RentDocumentData | null = null;
  private recorded = false;

  ngOnInit(): void {
    if (this.data.invoiceId) {
      this.choose(this.data.invoiceId, this.data.tenant ?? '', this.data.unit ?? '', Number(this.data.owes) || 0);
      return;
    }
    this.pickTenant = true;
    this.loadingTenants = true;
    this.billing.arrears(this.data.propertyId).subscribe({
      next: data => {
        this.tenants = data.rows ?? [];
        this.loadingTenants = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingTenants = false;
        this.error = 'The tenants could not be loaded. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  onTenantChange(contractId: number): void {
    const row = this.tenants.find(tenant => tenant.contract_id === contractId);
    if (row) {
      this.choose(row.invoice_id, row.customer_name, row.unit, Number(row.outstanding) || 0);
    }
  }

  private choose(invoiceId: number, tenant: string, unit: string, owes: number): void {
    this.invoiceId = invoiceId;
    this.tenant = tenant;
    this.unit = unit;
    this.owes = owes;
    // Start from the full balance; most payments clear it
    this.form.patchValue({ amount: owes > 0 ? owes : null });
  }

  /** What the tenant will owe after this payment. Negative: paid more than was owed. */
  get remaining(): number {
    return Math.round((this.owes - (Number(this.form.value.amount) || 0)) * 100) / 100;
  }

  save(): void {
    if (!this.invoiceId || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const form = this.form.value;
    this.saving = true;
    this.error = '';
    this.payments.makePayment({
      receipt: this.invoiceId,
      amount: form.amount,
      method: form.method,
      // References must be unique, so an empty one is sent as "none"
      reference: (form.reference || '').trim() || null,
      notes: form.notes,
    }).subscribe({
      next: payment => {
        this.recorded = true;
        this.showReceipt(payment);
      },
      error: err => {
        this.saving = false;
        this.error = err.error?.reference
          ? 'That reference has already been used on another payment.'
          : 'The payment could not be saved. Check the details and try again.';
        this.cdr.markForCheck();
      },
    });
  }

  /** The invoice is fetched after the payment so the receipt shows the balance that is left. */
  private showReceipt(payment: any): void {
    this.invoices.getReceipts(payment.receipt).subscribe({
      next: invoice => {
        this.receipt = receiptDocument(payment, invoice, parseFloat(invoice.amount_paid) || 0);
        // The receipt sheet is wider than the form
        this.dialogRef.updateSize('800px');
        this.cdr.markForCheck();
      },
      // The payment is saved; its receipt can still be printed from Payments
      error: () => this.dialogRef.close(true),
    });
  }

  close(): void {
    this.dialogRef.close(this.recorded);
  }
}

/** Open the payment dialog. The result is `true` when a payment was recorded. */
export function openRecordPayment(dialog: MatDialog, data: RecordPaymentData = {}) {
  return dialog.open(RecordPaymentDialog, { width: '520px', maxWidth: '95vw', disableClose: true, data }).afterClosed();
}
