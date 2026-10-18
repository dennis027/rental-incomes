import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { catchError, forkJoin, of } from 'rxjs';
import { BillingService } from './billing';
import { MaintenanceService } from './maintanance-service';

export interface AppNotification {
  icon: string;
  tone: 'error' | 'warning' | 'brand';
  title: string;
  detail: string;
  route: string;
  queryParams?: Record<string, any>;
}

/**
 * The things waiting for the landlord's attention, gathered from the pages
 * that already track them: overdue rent, contracts about to end, M-Pesa
 * payments nobody could match, and repairs not yet finished.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private platformId = inject(PLATFORM_ID);
  private billing = inject(BillingService);
  private maintenance = inject(MaintenanceService);

  readonly items = signal<AppNotification[]>([]);
  readonly count = computed(() => this.items().length);
  readonly loading = signal(false);

  load(propertyId: number | null): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.loading.set(true);
    forkJoin({
      arrears: this.billing.arrears(propertyId).pipe(catchError(() => of(null))),
      ending: this.billing.contractsEndingSoon(propertyId).pipe(catchError(() => of([]))),
      paybill: this.billing.paybillTransactions().pipe(catchError(() => of(null))),
      repairs: this.maintenance.getMaintenanceRequests().pipe(catchError(() => of([]))),
    }).subscribe(({ arrears, ending, paybill, repairs }) => {
      this.items.set([
        ...this.overdue(arrears?.rows ?? []),
        ...this.endingSoon(Array.isArray(ending) ? ending : []),
        ...this.unmatched(paybill),
        ...this.openRepairs(Array.isArray(repairs) ? repairs : [], propertyId),
      ]);
      this.loading.set(false);
    });
  }

  private overdue(rows: any[]): AppNotification[] {
    return rows
      .filter(row => row.days_overdue > 0)
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .map(row => ({
        icon: 'fas fa-triangle-exclamation',
        tone: 'error' as const,
        title: `${row.customer_name} owes KES ${Number(row.outstanding).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
        detail: `Unit ${row.unit} · ${row.days_overdue} day${row.days_overdue === 1 ? '' : 's'} overdue`,
        route: '/dashboard/arrears',
      }));
  }

  private endingSoon(contracts: any[]): AppNotification[] {
    return contracts
      .filter(contract => contract.days_left <= 30)
      .map(contract => ({
        icon: 'fas fa-file-signature',
        tone: 'warning' as const,
        title: contract.days_left < 0
          ? `${contract.customer_name}'s contract has ended`
          : `${contract.customer_name}'s contract ends in ${contract.days_left} day${contract.days_left === 1 ? '' : 's'}`,
        detail: `Unit ${contract.unit} · renew it or plan the move-out`,
        route: '/dashboard/home',
      }));
  }

  private unmatched(paybill: any): AppNotification[] {
    const rows: any[] = paybill?.transactions ?? [];
    return rows
      .filter(row => !row.matched)
      .map(row => ({
        icon: 'fas fa-mobile-screen',
        tone: 'brand' as const,
        title: `M-Pesa payment ${row.trans_id} is not matched`,
        detail: `KES ${Number(row.amount).toLocaleString('en-US', { maximumFractionDigits: 0 })} · choose the invoice it pays`,
        route: '/dashboard/payments',
      }));
  }

  private openRepairs(requests: any[], propertyId: number | null): AppNotification[] {
    return requests
      .filter(request => request.status !== 'resolved' && (propertyId === null || request.property_id === propertyId))
      .map(request => ({
        icon: 'fas fa-wrench',
        tone: 'brand' as const,
        title: `${request.category_display || 'Repair'} in Unit ${request.unit_number}`,
        detail: `${request.description} · ${request.status_display || request.status}`,
        route: '/dashboard/expensesmaintain',
      }));
  }
}
