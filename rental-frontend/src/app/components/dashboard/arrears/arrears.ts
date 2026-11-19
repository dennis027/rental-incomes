import { Component, PLATFORM_ID, effect, inject, untracked, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { SharedImports } from '../../../shared-imports/imports';
import { BillingService } from '../../../services/billing';
import { PropertyContext } from '../../../services/property-context';
import { invoiceNumber } from '../rent-document/rent-document';
import { openRecordPayment } from '../record-payment/record-payment-dialog';
import { openStkPush, stkConfigured } from '../stk-push/stk-push-dialog';
import { HttpClient } from '@angular/common/http';
import { longDate, money, openWhatsApp } from '../../../shared/share';
import { downloadCsv, fileDate } from '../../../shared/export';

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
  private snackBar = inject(MatSnackBar);

  private http = inject(HttpClient);

  // SMS and M-Pesa prompt buttons show once they are set up on the server
  smsReady = false;
  stkReady = false;
  texting = false;


  columns = ['select', 'tenant', 'outstanding', 'owing_since', 'overdue', 'last_payment', 'actions'];
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
    if (!this.smsReady) {
      this.checkSms();
    }
    if (!this.stkReady) {
      stkConfigured(this.http).subscribe({
        next: info => { this.stkReady = info.configured; this.cdr.markForCheck(); },
        error: () => {}
      });
    }
    // A refresh keeps the current rows on screen instead of flashing the spinner
    this.isLoading = this.rows.length === 0;
    this.loadError = false;
    this.billing.arrears(propertyId).subscribe({
      next: data => {
        this.rows = data.rows ?? [];
        // Someone who has paid up since they were ticked drops out of the selection
        const owing = new Set(this.rows.map(row => row.contract_id));
        this.selected.forEach(id => owing.has(id) || this.selected.delete(id));
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

  // ---------- Select and remind several ----------

  /** Contract ids of the ticked rows. */
  selected = new Set<number>();
  /** The tenants being reminded one after the other, and how far along we are. */
  queue: ArrearsRow[] = [];
  queueIndex = 0;

  get allSelected(): boolean {
    const shown = this.dataSource.data;
    return shown.length > 0 && shown.every(row => this.selected.has(row.contract_id));
  }

  get selectedTotal(): number {
    return this.rows.filter(row => this.selected.has(row.contract_id)).reduce((sum, row) => sum + Number(row.outstanding), 0);
  }

  toggle(row: ArrearsRow, checked: boolean): void {
    checked ? this.selected.add(row.contract_id) : this.selected.delete(row.contract_id);
  }

  toggleAll(checked: boolean): void {
    this.dataSource.data.forEach(row => this.toggle(row, checked));
  }

  clearSelection(): void {
    this.selected.clear();
  }

  startQueue(): void {
    this.queue = this.rows.filter(row => this.selected.has(row.contract_id));
    this.queueIndex = 0;
  }

  sendQueued(): void {
    this.remind(this.queue[this.queueIndex]);
    this.skipQueued();
  }

  skipQueued(): void {
    this.queueIndex++;
    if (this.queueIndex >= this.queue.length) {
      this.stopQueue();
      this.clearSelection();
    }
  }

  stopQueue(): void {
    this.queue = [];
    this.queueIndex = 0;
  }

  // ---------- Remind ----------

  private checkSms(): void {
    this.billing.reminders().subscribe({
      next: info => {
        this.smsReady = info.configured;
        this.cdr.markForCheck();
      },
      error: () => {}
    });
  }

  /** SMS the chosen tenants straight away; the server writes the message and keeps a record */
  sms(rows: ArrearsRow[]): void {
    if (!rows.length || this.texting) {
      return;
    }
    this.texting = true;
    this.billing.sendSmsReminders(rows.map(row => row.contract_id)).subscribe({
      next: result => {
        this.texting = false;
        // The server queues the texts and sends them in the background
        const queued: number = result.queued ?? 0;
        const skipped: number = result.skipped_recent ?? 0;
        let message = queued
          ? `Sending ${queued} SMS reminder${queued === 1 ? '' : 's'}`
          : 'No reminders sent';
        if (skipped) {
          message += `. ${skipped} tenant${skipped === 1 ? ' was' : 's were'} texted a few minutes ago and ${skipped === 1 ? 'was' : 'were'} skipped`;
        }
        this.snackBar.open(message, 'Close', { duration: 6000 });
        this.clearSelection();
        this.cdr.markForCheck();
      },
      error: err => {
        this.texting = false;
        this.snackBar.open(err.error?.error || 'The reminders could not be sent.', 'Close', { duration: 5000 });
        this.cdr.markForCheck();
      }
    });
  }

  smsSelected(): void {
    this.sms(this.rows.filter(row => this.selected.has(row.contract_id)));
  }

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

  /** Prompt the tenant to pay on their phone; the list refreshes once they have */
  requestMpesa(row: ArrearsRow): void {
    openStkPush(this.dialog, {
      invoiceId: row.invoice_id,
      customerName: row.customer_name,
      phone: row.customer_phone,
      amount: row.outstanding,
      unit: row.unit,
    }).subscribe(paid => {
      if (paid) {
        this.load();
      }
    });
  }

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

  /** The tenants owing on screen as a spreadsheet */
  exportCsv(): void {
    downloadCsv(`arrears-${fileDate()}`,
      ['Tenant', 'Phone', 'Property', 'Unit', 'Owed (KES)', 'Owing since', 'Due date', 'Days overdue', 'Last payment', 'Invoice'],
      this.dataSource.data.map(row => [
        row.customer_name, row.customer_phone, row.property, row.unit, row.outstanding, row.owing_since,
        row.due_date, row.days_overdue, row.last_payment_date ?? '', invoiceNumber(row.invoice_number),
      ]));
  }
}
