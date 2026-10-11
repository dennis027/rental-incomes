import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { SharedImports } from '../../../shared-imports/imports';
import { BillingService } from '../../../services/billing';
import { longDate, money, openWhatsApp, printPdf } from '../../../shared/share';
import { buildMoveOutPdf } from './move-out-pdf';

/**
 * Ends a contract and settles the deposit: final meter readings, deductions,
 * and what is refunded. For a contract already settled it shows the settlement.
 * Closes with `true` when a contract was ended.
 */
@Component({
  selector: 'app-move-out-dialog',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './move-out-dialog.html',
  styleUrl: './move-out-dialog.css'
})
export class MoveOutDialog implements OnInit {
  private billing = inject(BillingService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private dialogRef = inject(MatDialogRef<MoveOutDialog>);
  data: { contractId: number } = inject(MAT_DIALOG_DATA);

  isLoading = true;
  loadError = '';
  preview: any = null;
  settlement: any = null;
  saving = false;
  saveError = '';
  private endedNow = false;

  form: FormGroup = this.fb.group({
    move_out_date: [new Date().toISOString().slice(0, 10), Validators.required],
    final_water_reading: [null],
    final_electricity_reading: [null],
    deductions: [0, [Validators.min(0)]],
    deduction_notes: [''],
    record_refund: [true],
    refund_method: ['mpesa'],
    refund_reference: [''],
  });

  ngOnInit(): void {
    this.billing.moveOutPreview(this.data.contractId).subscribe({
      next: data => {
        this.isLoading = false;
        if (data.settled) {
          this.settlement = data.settlement;
        } else {
          this.preview = data;
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = 'The contract could not be loaded. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  private used(control: string, last: any): number {
    const reading = this.form.value[control];
    if (reading === null || reading === '') return 0;
    return Math.max(Number(reading) - Number(last), 0);
  }

  get waterBill(): number {
    const meters = this.preview?.meters;
    return meters?.has_water_bill ? this.used('final_water_reading', meters.water_reading) * Number(meters.water_unit_cost) : 0;
  }

  get electricityBill(): number {
    const meters = this.preview?.meters;
    return meters?.has_electricity_bill ? this.used('final_electricity_reading', meters.electricity_reading) * Number(meters.electricity_unit_cost) : 0;
  }

  get unpaid(): number {
    return Number(this.preview?.unpaid_balance || 0) + this.waterBill + this.electricityBill;
  }

  get deductions(): number {
    return Number(this.form.value.deductions) || 0;
  }

  /** Positive: goes back to the tenant. Negative: the tenant still owes it. */
  get refund(): number {
    return Number(this.preview?.deposit_held || 0) - this.unpaid - this.deductions;
  }

  abs(value: any): number {
    return Math.abs(Number(value) || 0);
  }

  confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.billing.moveOut(this.data.contractId, this.form.value).subscribe({
      next: data => {
        this.saving = false;
        this.endedNow = true;
        this.preview = null;
        this.settlement = data.settlement;
        this.cdr.markForCheck();
      },
      error: err => {
        this.saving = false;
        this.saveError = err.error?.error || 'The contract could not be ended. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  close(): void {
    this.dialogRef.close(this.endedNow);
  }

  private get filename(): string {
    return `move_out_${this.settlement?.contract_number || 'statement'}.pdf`;
  }

  download(): void {
    buildMoveOutPdf(this.settlement).save(this.filename);
  }

  print(): void {
    printPdf(buildMoveOutPdf(this.settlement), this.filename);
  }

  share(): void {
    const s = this.settlement;
    const refund = Number(s.refund_amount) || 0;
    const outcome = refund >= 0
      ? `Refund to you: KES ${money(refund)}.`
      : `Amount still payable: KES ${money(-refund)}.`;
    openWhatsApp(s.tenant.phone,
      `Hello ${s.tenant.name.split(' ')[0]}, here is your move-out statement for Unit ${s.unit} at ${s.property.name} (${longDate(s.move_out_date)}). ` +
      `Deposit held: KES ${money(s.deposit_held)}. Unpaid rent and bills: KES ${money(s.unpaid_balance)}. Deductions: KES ${money(s.deductions)}. ${outcome}`);
  }
}
