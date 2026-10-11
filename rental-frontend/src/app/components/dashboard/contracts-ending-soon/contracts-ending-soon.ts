import { ChangeDetectorRef, Component, PLATFORM_ID, TemplateRef, ViewChild, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SharedImports } from '../../../shared-imports/imports';
import { BillingService } from '../../../services/billing';
import { ContractsService } from '../../../services/contract-service';
import { PropertyContext } from '../../../services/property-context';
import { longDate, openWhatsApp } from '../../../shared/share';

/** Dashboard card: contracts that end within 60 days or have already run past their end date. */
@Component({
  selector: 'app-contracts-ending-soon',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './contracts-ending-soon.html',
  styleUrl: './contracts-ending-soon.css'
})
export class ContractsEndingSoon {
  private billing = inject(BillingService);
  private contractsService = inject(ContractsService);
  private propertyContext = inject(PropertyContext);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('renewDialog') renewDialog!: TemplateRef<any>;

  contracts: any[] = [];
  renewing: any = null;
  newEndDate = '';
  saving = false;
  saveError = '';

  private propertySync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => this.load(propertyId));
  });

  load(propertyId: number | null = this.propertyContext.selectedId()): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.billing.contractsEndingSoon(propertyId, 60).subscribe({
      next: contracts => {
        this.contracts = contracts ?? [];
        this.cdr.markForCheck();
      },
      // The card simply stays hidden when the list cannot be fetched
      error: () => {},
    });
  }

  openRenew(contract: any): void {
    this.renewing = contract;
    this.saveError = '';
    this.saving = false;
    // One more year from the current end date
    const end = new Date(contract.end_date);
    end.setFullYear(end.getFullYear() + 1);
    this.newEndDate = end.toISOString().slice(0, 10);
    this.dialog.open(this.renewDialog, { width: '440px', maxWidth: '95vw' });
  }

  renew(): void {
    if (!this.renewing || !this.newEndDate) return;
    if (this.newEndDate <= this.renewing.end_date) {
      this.saveError = 'Choose a date after the current end date.';
      return;
    }
    this.saving = true;
    this.saveError = '';
    this.contractsService.updateContract(this.renewing.id, { end_date: this.newEndDate }).subscribe({
      next: () => {
        // `saving` is reset when the dialog is next opened; changing it while the dialog closes trips Angular's dev check
        this.dialog.closeAll();
        this.snackBar.open(`Contract renewed to ${longDate(this.newEndDate)}`, 'Close', {
          duration: 3000, panelClass: ['success-snackbar'], horizontalPosition: 'right', verticalPosition: 'top',
        });
        this.load();
      },
      error: () => {
        this.saving = false;
        this.saveError = 'The contract could not be renewed. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  ask(contract: any): void {
    const when = contract.days_left < 0 ? `ended on ${longDate(contract.end_date)}` : `ends on ${longDate(contract.end_date)}`;
    openWhatsApp(contract.customer_phone,
      `Hello ${contract.customer_name.split(' ')[0]}, your tenancy for Unit ${contract.unit} at ${contract.property} ${when}. ` +
      `Would you like to renew? Please let us know.`);
  }
}
