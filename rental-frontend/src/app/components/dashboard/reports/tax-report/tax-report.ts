import { ChangeDetectorRef, Component, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SharedImports } from '../../../../shared-imports/imports';
import { PropertyContext } from '../../../../services/property-context';
import { environment } from '../../../../../environments/environment';

interface TaxFigures {
  month: string;
  due_date: string;
  rate: number;
  regime: 'mri' | 'below_threshold' | 'above_threshold';
  thresholds: { min_yearly: number; max_yearly: number };
  twelve_month_rent: number;
  totals: { collected: number; rent: number; tax: number };
  properties: { id: number; name: string; collected: number; rent: number; tax: number }[];
  payments: { date: string; tenant: string; unit: string; property: string; invoice: string; reference: string; amount: number; rent: number }[];
}

/** Monthly Rental Income tax for KRA (eRITS), worked out from the rent received */
@Component({
  selector: 'app-tax-report',
  imports: [SharedImports],
  templateUrl: './tax-report.html',
  styleUrl: './tax-report.css'
})
export class TaxReport {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private propertyContext = inject(PropertyContext);

  // Last month: the one due for filing this month
  month = (() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  wholeAccount = true;

  loading = false;
  failed = false;
  report: TaxFigures | null = null;

  private propertySync = effect(() => {
    this.propertyContext.selectedId();
    untracked(() => { if (!this.wholeAccount) { this.load(); } });
  });

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    }
  }

  get propertyName(): string {
    return this.propertyContext.selected()?.name ?? '';
  }

  load(): void {
    const params: Record<string, string> = { month: this.month };
    const propertyId = this.propertyContext.selectedId();
    if (!this.wholeAccount && propertyId) {
      params['property_id'] = String(propertyId);
    }
    this.loading = true;
    this.failed = false;
    this.http.get<TaxFigures>(`${environment.apiUrl}api/reports/rental-income-tax/`, { params }).subscribe({
      next: report => {
        this.report = report;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.loading = false;
        this.failed = true;
        this.cdr.markForCheck();
      }
    });
  }

  setScope(wholeAccount: boolean): void {
    this.wholeAccount = wholeAccount;
    this.load();
  }

  get monthLabel(): string {
    const [year, month] = (this.report?.month ?? this.month).split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-KE', { month: 'long', year: 'numeric' });
  }

  /** A spreadsheet of the month's payments, to keep with the eRITS return */
  downloadCsv(): void {
    const report = this.report;
    if (!report) {
      return;
    }
    const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Date', 'Tenant', 'Property', 'Unit', 'Invoice', 'Reference', 'Amount received (KES)', 'Rent portion (KES)'].map(cell).join(','),
      ...report.payments.map(p => [p.date, p.tenant, p.property, p.unit, p.invoice, p.reference, p.amount, p.rent].map(cell).join(',')),
      '',
      [cell('Gross rent received'), '', '', '', '', '', cell(report.totals.collected), cell(report.totals.rent)].join(','),
      [cell(`MRI tax at ${report.rate}%`), '', '', '', '', '', '', cell(report.totals.tax)].join(','),
      [cell('Due by'), cell(report.due_date)].join(','),
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rental-income-tax-${report.month}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }
}
