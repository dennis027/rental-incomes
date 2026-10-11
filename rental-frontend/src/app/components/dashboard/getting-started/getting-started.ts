import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable, catchError, forkJoin, of } from 'rxjs';
import { PropertiesService } from '../../../services/properties';
import { UnitsService } from '../../../services/units';
import { CustomersService } from '../../../services/customer';
import { ContractsService } from '../../../services/contract-service';
import { ReceiptService } from '../../../services/receipts';
import { PaymentService } from '../../../services/payments';

interface SetupStep {
  title: string;
  description: string;
  action: string;
  route: string;
  done: boolean;
}

const HIDDEN_KEY = 'getting_started_hidden';

/**
 * Walks a new user through the order the system expects:
 * property -> units -> tenants -> contracts -> receipts -> payments.
 */
@Component({
  selector: 'app-getting-started',
  imports: [CommonModule, RouterModule],
  templateUrl: './getting-started.html',
  styleUrl: './getting-started.css'
})
export class GettingStarted implements OnInit {
  private platformId = inject(PLATFORM_ID);
  private propertiesService = inject(PropertiesService);
  private unitsService = inject(UnitsService);
  private customersService = inject(CustomersService);
  private contractsService = inject(ContractsService);
  private receiptsService = inject(ReceiptService);
  private paymentsService = inject(PaymentService);

  loaded = signal(false);
  hidden = signal(false);

  steps = signal<SetupStep[]>([
    { title: 'Add a property', description: 'A property is a building or plot you manage.', action: 'Add property', route: '/dashboard/properties', done: false },
    { title: 'Add its units', description: 'Units are the houses, rooms or shops you rent out inside a property.', action: 'Add units', route: '/dashboard/units', done: false },
    { title: 'Register tenants', description: 'Save the people who rent from you, with their contacts and ID.', action: 'Add tenant', route: '/dashboard/rental-customers', done: false },
    { title: 'Create a contract', description: 'A contract puts a tenant in a unit and sets the rent and deposit.', action: 'Create contract', route: '/dashboard/contracts', done: false },
    { title: 'Generate invoices', description: 'Each month, generate the rent bill for every active contract.', action: 'Generate invoices', route: '/dashboard/receipts', done: false },
    { title: 'Record payments', description: 'Record what tenants pay so balances stay up to date.', action: 'Record payment', route: '/dashboard/payments', done: false },
  ]);

  doneCount = computed(() => this.steps().filter(step => step.done).length);
  // First step that still needs doing
  currentIndex = computed(() => this.steps().findIndex(step => !step.done));
  visible = computed(() => this.loaded() && !this.hidden() && this.currentIndex() !== -1);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.hidden.set(localStorage.getItem(HIDDEN_KEY) === '1');
    if (this.hidden()) {
      return;
    }

    // A failed call just leaves that step unticked
    const safe = (call: Observable<any>) => call.pipe(catchError(() => of(null)));

    forkJoin([
      safe(this.propertiesService.getProperties()),
      safe(this.unitsService.getUnits()),
      safe(this.customersService.getCustomers()),
      safe(this.contractsService.getContracts()),
      safe(this.receiptsService.getReceipts()),
      safe(this.paymentsService.getPayments()),
    ]).subscribe(results => {
      this.steps.update(steps => steps.map((step, i) => ({ ...step, done: this.count(results[i]) > 0 })));
      this.loaded.set(true);
    });
  }

  hide(): void {
    localStorage.setItem(HIDDEN_KEY, '1');
    this.hidden.set(true);
  }

  private count(res: any): number {
    if (Array.isArray(res)) return res.length;
    const list = res?.results ?? res?.data;
    if (Array.isArray(list)) return list.length;
    return typeof res?.count === 'number' ? res.count : 0;
  }
}
