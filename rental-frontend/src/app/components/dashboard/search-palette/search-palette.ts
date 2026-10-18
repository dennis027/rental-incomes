import { ChangeDetectorRef, Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { catchError, forkJoin, of } from 'rxjs';
import { CustomersService } from '../../../services/customer';
import { UnitsService } from '../../../services/units';
import { ReceiptService } from '../../../services/receipts';
import { BillingService } from '../../../services/billing';
import { invoiceNumber } from '../rent-document/rent-document';

interface SearchResult {
  group: 'Pages' | 'Tenants' | 'Units' | 'Invoices' | 'M-Pesa payments';
  icon: string;
  title: string;
  detail: string;
  /** Everything the query is matched against, lower case. */
  text: string;
  route: string;
  queryParams?: Record<string, any>;
}

export interface SearchPage {
  name: string;
  route: string;
  icon: string;
  hint: string;
}

const GROUP_LIMIT = 5;

/** Find a tenant, unit, invoice, M-Pesa code or page from anywhere, and jump to it. */
@Component({
  selector: 'app-search-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-palette.html',
  styleUrl: './search-palette.css'
})
export class SearchPalette {
  private router = inject(Router);
  private dialogRef = inject(MatDialogRef<SearchPalette>);
  private cdr = inject(ChangeDetectorRef);
  private customers = inject(CustomersService);
  private units = inject(UnitsService);
  private receipts = inject(ReceiptService);
  private billing = inject(BillingService);

  @ViewChild('list') list?: ElementRef<HTMLElement>;

  pages: SearchPage[] = [];
  query = '';
  loading = true;
  results: SearchResult[] = [];
  active = 0;

  private index: SearchResult[] = [];

  /** Called by openSearchPalette once the dialog exists. */
  start(pages: SearchPage[]): void {
    this.pages = pages;
    this.index = this.pageResults();
    this.search();
    forkJoin({
      customers: this.customers.getCustomers().pipe(catchError(() => of([]))),
      units: this.units.getUnits().pipe(catchError(() => of([]))),
      receipts: this.receipts.getReceipts().pipe(catchError(() => of([]))),
      paybill: this.billing.paybillTransactions().pipe(catchError(() => of(null))),
    }).subscribe(data => {
      this.index = [
        ...this.pageResults(),
        ...this.tenantResults(this.rows(data.customers)),
        ...this.unitResults(this.rows(data.units)),
        ...this.invoiceResults(this.rows(data.receipts), this.rows(data.customers)),
        ...this.paybillResults(data.paybill?.transactions ?? []),
      ];
      this.loading = false;
      this.search();
    });
  }

  search(): void {
    const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const counts = new Map<string, number>();
    this.results = this.index.filter(result => {
      // With nothing typed the palette only offers the pages
      if (!words.length ? result.group !== 'Pages' : !words.every(word => result.text.includes(word))) {
        return false;
      }
      const seen = counts.get(result.group) ?? 0;
      counts.set(result.group, seen + 1);
      return seen < GROUP_LIMIT;
    });
    this.active = 0;
    this.cdr.markForCheck();
  }

  onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.active = (this.active + step + this.results.length) % Math.max(this.results.length, 1);
      queueMicrotask(() => this.list?.nativeElement.querySelector('.active')?.scrollIntoView({ block: 'nearest' }));
    } else if (event.key === 'Enter' && this.results[this.active]) {
      event.preventDefault();
      this.open(this.results[this.active]);
    }
  }

  open(result: SearchResult): void {
    this.dialogRef.close();
    this.router.navigate([result.route], { queryParams: result.queryParams });
  }

  startsGroup(index: number): boolean {
    return index === 0 || this.results[index - 1].group !== this.results[index].group;
  }

  private rows(data: any): any[] {
    return Array.isArray(data) ? data : [];
  }

  private pageResults(): SearchResult[] {
    return this.pages.map(page => ({
      group: 'Pages' as const,
      icon: page.icon,
      title: page.name,
      detail: page.hint,
      text: page.name.toLowerCase(),
      route: page.route,
    }));
  }

  private tenantResults(customers: any[]): SearchResult[] {
    return customers.map(customer => {
      const name = `${customer.first_name} ${customer.last_name}`;
      const where = customer.unit_number ? `Unit ${customer.unit_number} · ${customer.property_name}` : 'No unit';
      return {
        group: 'Tenants' as const,
        icon: 'fas fa-user',
        title: name,
        detail: `${customer.phone_number} · ${where}`,
        text: `${name} ${customer.phone_number} ${customer.email ?? ''} ${customer.id_number ?? ''} ${customer.unit_number ?? ''}`.toLowerCase(),
        route: '/dashboard/statement',
        queryParams: { tenant: customer.id },
      };
    });
  }

  private unitResults(units: any[]): SearchResult[] {
    return units.map(unit => ({
      group: 'Units' as const,
      icon: 'fas fa-door-open',
      title: `Unit ${unit.unit_number}`,
      detail: `${unit.property_name} · ${unit.tenant_name || 'Vacant'}`,
      text: `unit ${unit.unit_number} ${unit.property_name} ${unit.tenant_name ?? 'vacant'} ${unit.unit_type_display ?? ''}`.toLowerCase(),
      route: '/dashboard/units',
      queryParams: { q: unit.unit_number },
    }));
  }

  private invoiceResults(receipts: any[], customers: any[]): SearchResult[] {
    // An invoice names its tenant but not the tenant's id, which the statement page needs
    const ids = new Map(customers.map(customer => [`${customer.first_name} ${customer.last_name}`, customer.id]));
    return receipts.map(receipt => {
      const number = invoiceNumber(receipt.receipt_number);
      const tenant = ids.get(receipt.customer_name);
      return {
        group: 'Invoices' as const,
        icon: 'fas fa-file-invoice',
        title: number,
        detail: `${receipt.customer_name} · Unit ${receipt.unit} · KES ${Number(receipt.total_amount).toLocaleString('en-US')}`,
        text: `${number} ${receipt.receipt_number} ${receipt.customer_name} ${receipt.contract_number ?? ''}`.toLowerCase(),
        route: tenant ? '/dashboard/statement' : '/dashboard/receipts',
        queryParams: tenant ? { tenant, contract: receipt.contract } : undefined,
      };
    });
  }

  private paybillResults(transactions: any[]): SearchResult[] {
    return transactions.map(row => ({
      group: 'M-Pesa payments' as const,
      icon: 'fas fa-mobile-screen',
      title: row.trans_id,
      detail: `${row.payer_name || 'Unknown payer'} · KES ${Number(row.amount).toLocaleString('en-US')} · ${row.matched ? 'matched' : 'not matched'}`,
      text: `${row.trans_id} ${row.payer_name ?? ''} ${row.bill_ref ?? ''}`.toLowerCase(),
      route: '/dashboard/payments',
    }));
  }
}

export function openSearchPalette(dialog: MatDialog, pages: SearchPage[]): void {
  // Ctrl+K while it is already open should not stack a second one
  if (dialog.openDialogs.some(open => open.componentInstance instanceof SearchPalette)) {
    return;
  }
  const ref = dialog.open(SearchPalette, {
    width: '620px',
    maxWidth: '94vw',
    position: { top: '10vh' },
    panelClass: 'search-palette-panel',
    autoFocus: 'input',
  });
  ref.componentInstance.start(pages);
}
