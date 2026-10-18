import { ChangeDetectorRef, Component, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BillingService } from '../../../services/billing';
import { PropertyContext } from '../../../services/property-context';

interface Bucket {
  label: string;
  tone: string;
  amount: number;
  tenants: number;
  share: number;
}

/** Dashboard card: unpaid rent split by how long it has been overdue. */
@Component({
  selector: 'app-arrears-ageing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './arrears-ageing.html',
  styleUrl: './arrears-ageing.css'
})
export class ArrearsAgeing {
  private billing = inject(BillingService);
  private propertyContext = inject(PropertyContext);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  buckets: Bucket[] = [];
  total = 0;

  private propertySync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => this.load(propertyId));
  });

  load(propertyId: number | null): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.billing.arrears(propertyId).subscribe({
      next: data => {
        this.build(data.rows ?? []);
        this.cdr.markForCheck();
      },
      // The card simply stays hidden when the list cannot be fetched
      error: () => {},
    });
  }

  private build(rows: any[]): void {
    const ranges: { label: string; tone: string; from: number; to: number }[] = [
      { label: 'Not yet overdue', tone: 'grace', from: -Infinity, to: 0 },
      { label: '1 – 30 days', tone: 'early', from: 1, to: 30 },
      { label: '31 – 60 days', tone: 'late', from: 31, to: 60 },
      { label: 'Over 60 days', tone: 'severe', from: 61, to: Infinity },
    ];
    this.total = rows.reduce((sum, row) => sum + Number(row.outstanding), 0);
    this.buckets = ranges.map(range => {
      const inRange = rows.filter(row => row.days_overdue >= range.from && row.days_overdue <= range.to);
      const amount = inRange.reduce((sum, row) => sum + Number(row.outstanding), 0);
      return {
        label: range.label,
        tone: range.tone,
        amount,
        tenants: inRange.length,
        share: this.total ? (amount / this.total) * 100 : 0,
      };
    });
  }
}
