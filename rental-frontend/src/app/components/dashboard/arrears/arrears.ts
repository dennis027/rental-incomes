import { Component, PLATFORM_ID, effect, inject, untracked, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { SharedImports } from '../../../shared-imports/imports';
import { BillingService } from '../../../services/billing';
import { PropertyContext } from '../../../services/property-context';
import { invoiceNumber } from '../rent-document/rent-document';
import { openRecordPayment } from '../record-payment/record-payment-dialog';
import { longDate, money, openWhatsApp } from '../../../shared/share';

export interface ArrearsRow {
  contract_id: number;
  contract_number: string;
  is_active: boolean;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  unit: string;
  property: string;
  outstanding: string;
  owing_since: string;
  due_date: string;
  days_overdue: number;
  last_payment_date: string | null;
  invoice_id: number;
  invoice_number: string;
}

/** Who owes rent, how much and for how long, with the actions to chase it. */
@Component({
  selector: 'app-arrears',
  standalone: true,
  imports: [SharedImports, RouterLink],
  templateUrl: './arrears.html',
  styleUrl: './arrears.css'
})
export class Arrears {
  private billing = inject(BillingService);
  private propertyContext = inject(PropertyContext);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);


  columns = ['tenant', 'outstanding', 'owing_since', 'overdue', 'last_payment', 'actions'];
  dataSource = new MatTableDataSource<ArrearsRow>([]);
  rows: ArrearsRow[] = [];
  summary = { tenants: 0, total_outstanding: 0, overdue_tenants: 0, total_overdue: 0 };
  filter: 'all' | 'overdue' = 'all';
  search = '';
  isLoading = false;
  loadError = false;

  // Follows the property chosen in the top bar
  private propertySync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => this.load(propertyId));
  });

  load(propertyId: number | null = this.propertyContext.selectedId()): void {
    if (!isPlatformBrowser(this.platformId)) return;
    // A refresh keeps the current rows on screen instead of flashing the spinner
    this.isLoading = this.rows.length === 0;
    this.loadError = false;
    this.billing.arrears(propertyId).subscribe({
      next: data => {
        this.rows = data.rows ?? [];
        this.summary = data.summary ?? this.summary;
        this.isLoading = false;
        this.applyFilter();
      },
      error: err => {
        this.isLoading = false;
        if (err.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        this.loadError = true;
        this.cdr.markForCheck();
      },
    });
  }

  get overdueCount(): number {
    return this.rows.filter(row => row.days_overdue > 0).length;
  }

  setFilter(filter: 'all' | 'overdue'): void {
    this.filter = filter;
    this.applyFilter();
  }

  applyFilter(): void {
    const term = this.search.trim().toLowerCase();
    this.dataSource.data = this.rows.filter(row =>
      (this.filter === 'all' || row.days_overdue > 0) &&
      (!term || `${row.customer_name} ${row.unit} ${row.customer_phone}`.toLowerCase().includes(term))
    );
    this.cdr.markForCheck();
  }

  // ---------- Remind ----------

  remind(row: ArrearsRow): void {
    const firstName = row.customer_name.split(' ')[0];
    const overdue = row.days_overdue > 0
      ? `It was due on ${longDate(row.due_date)} and is now ${row.days_overdue} day${row.days_overdue === 1 ? '' : 's'} overdue.`
      : `It is due by ${longDate(row.due_date)}.`;
    openWhatsApp(row.customer_phone,
      `Hello ${firstName}, this is a reminder that the rent account for Unit ${row.unit} at ${row.property} has a balance of KES ${money(row.outstanding)}. ` +
      `${overdue} Please quote ${invoiceNumber(row.invoice_number)} when paying. Thank you.`);
  }

  // ---------- Pay ----------

  openPay(row: ArrearsRow): void {
    openRecordPayment(this.dialog, {
      invoiceId: row.invoice_id,
      tenant: row.customer_name,
      unit: row.unit,
      owes: Number(row.outstanding),
    }).subscribe(recorded => {
      if (recorded) {
        this.load();
      }
    });
  }
}
