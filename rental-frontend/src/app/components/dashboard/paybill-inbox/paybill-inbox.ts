import { ChangeDetectorRef, Component, EventEmitter, OnInit, Output, PLATFORM_ID, TemplateRef, ViewChild, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SharedImports } from '../../../shared-imports/imports';
import { BillingService } from '../../../services/billing';
import { ReceiptService } from '../../../services/receipts';
import { invoiceNumber } from '../rent-document/rent-document';

/**
 * Payments reported by Safaricom for the paybill or till. Most are matched to an
 * invoice automatically; the ones that could not be are matched here by hand.
 */
@Component({
  selector: 'app-paybill-inbox',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './paybill-inbox.html',
  styleUrl: './paybill-inbox.css'
})
export class PaybillInbox implements OnInit {
  private billing = inject(BillingService);
  private invoiceService = inject(ReceiptService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  /** A payment was created, so lists of payments elsewhere are out of date. */
  @Output() matched = new EventEmitter<void>();
  /** How many payments are waiting to be matched. */
  @Output() waiting = new EventEmitter<number>();

  @ViewChild('matchDialog') matchDialog!: TemplateRef<any>;

  transactions: any[] = [];
  configured = true;
  isLoading = false;
  loadError = false;

  matching: any = null;
  owingInvoices: any[] = [];
  invoiceId: number | null = null;
  saving = false;
  saveError = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.isLoading = true;
    this.loadError = false;
    this.billing.paybillTransactions().subscribe({
      next: data => {
        this.transactions = data.transactions ?? [];
        this.configured = !!data.configured;
        this.isLoading = false;
        this.waiting.emit(this.transactions.filter(row => !row.matched).length);
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      },
    });
  }

  inv(stored: string | null): string {
    return invoiceNumber(stored);
  }

  openMatch(row: any): void {
    this.matching = row;
    this.invoiceId = null;
    this.saveError = '';
    this.saving = false;
    this.owingInvoices = [];
    this.dialog.open(this.matchDialog, { width: '520px', maxWidth: '95vw' });
    this.invoiceService.getReceipts().subscribe({
      next: (invoices: any[]) => {
        this.owingInvoices = (invoices ?? []).filter(invoice => Number(invoice.balance) > 0);
        this.cdr.markForCheck();
      },
      error: () => {
        this.saveError = 'The invoices could not be loaded.';
        this.cdr.markForCheck();
      },
    });
  }

  confirmMatch(): void {
    if (!this.matching || !this.invoiceId) return;
    this.saving = true;
    this.saveError = '';
    this.billing.matchPaybillTransaction(this.matching.id, this.invoiceId).subscribe({
      next: () => {
        // `saving` is reset when the dialog is next opened; changing it while the dialog closes trips Angular's dev check
        this.dialog.closeAll();
        this.snackBar.open('Payment matched and recorded', 'Close', {
          duration: 3000, panelClass: ['success-snackbar'], horizontalPosition: 'right', verticalPosition: 'top',
        });
        this.load();
        this.matched.emit();
      },
      error: err => {
        this.saving = false;
        this.saveError = err.error?.error || 'The payment could not be matched. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }
}
