import { ChangeDetectorRef, Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { Location, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedImports } from '../../../shared-imports/imports';
import { BillingService } from '../../../services/billing';
import { longDate, money, openWhatsApp, printPdf } from '../../../shared/share';
import { invoiceNumber } from '../rent-document/rent-document';
import { buildStatementPdf } from './statement-pdf';

/** One tenant's invoices and payments in date order, with a running balance. */
@Component({
  selector: 'app-tenant-statement',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './tenant-statement.html',
  styleUrl: './tenant-statement.css'
})
export class TenantStatement implements OnInit {
  private billing = inject(BillingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private location = inject(Location);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  customerId = 0;
  statement: any = null;
  isLoading = false;
  loadError = false;

  contractId: number | '' = '';
  startDate = '';
  endDate = '';

  ngOnInit(): void {
    // The tenant is a query parameter so the page needs no server-side route parameters
    this.customerId = Number(this.route.snapshot.queryParamMap.get('tenant'));
    const contract = Number(this.route.snapshot.queryParamMap.get('contract'));
    this.contractId = contract > 0 ? contract : '';
    this.load();
  }

  load(): void {
    if (!isPlatformBrowser(this.platformId) || !this.customerId) return;
    this.isLoading = true;
    this.loadError = false;
    this.billing.statement(this.customerId, {
      contract_id: this.contractId, start_date: this.startDate, end_date: this.endDate,
    }).subscribe({
      next: data => {
        this.statement = data;
        this.isLoading = false;
        this.cdr.markForCheck();
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

  clearDates(): void {
    this.startDate = '';
    this.endDate = '';
    this.load();
  }

  back(): void {
    this.location.back();
  }

  get closing(): number {
    return Number(this.statement?.closing_balance) || 0;
  }

  /** Invoices are stored with an RCT- number; they are shown as INV- */
  reference(entry: any): string {
    return entry.type === 'invoice' ? invoiceNumber(entry.number) : entry.number;
  }

  private get filename(): string {
    return `statement_${(this.statement?.tenant?.name || 'tenant').replace(/\s+/g, '_')}.pdf`;
  }

  download(): void {
    buildStatementPdf(this.statement).save(this.filename);
  }

  print(): void {
    printPdf(buildStatementPdf(this.statement), this.filename);
  }

  share(): void {
    const tenant = this.statement.tenant;
    const where = this.statement.unit ? ` for Unit ${this.statement.unit}` : '';
    const balance = this.closing < 0
      ? `Your account is in credit by KES ${money(-this.closing)}.`
      : this.closing > 0
        ? `The balance due is KES ${money(this.closing)}.`
        : 'Your account is fully paid. Thank you.';
    openWhatsApp(tenant.phone,
      `Hello ${tenant.name.split(' ')[0]}, here is your rent statement${where} as at ${longDate(this.statement.generated_on)}: ` +
      `charged KES ${money(this.statement.total_charged)}, paid KES ${money(this.statement.total_paid)}. ${balance}`);
  }
}
