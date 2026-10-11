import { PropertyContext } from '../../../services/property-context';
import { MoveOutDialog } from '../move-out/move-out-dialog';
import { Component, inject, ViewChild, AfterViewInit, OnInit, ChangeDetectorRef, TemplateRef, PLATFORM_ID, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { UnitsService } from '../../../services/units';
import { PropertiesService } from '../../../services/properties';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SharedImports } from '../../../shared-imports/imports';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SystemParametersServices } from '../../../services/system-parameters-services';
import { ContractsService } from '../../../services/contract-service';
import { CustomersService } from '../../../services/customer';

export interface UnitsTable {
  id: string;
  property: number;
  unit_number: string;
  unit_type: string;
  rent_amount: number;
  water_meter_reading: number;
  electricity_meter_reading: number;
  balance: string;
  status: string;
  active_contract_deposit: string;
  tenant_name?: string | null;
  contract_id?: number | null;
  contract_number?: string | null;
}

@Component({
  selector: 'app-units',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './units.html',
  styleUrl: './units.css'
})
export class Units implements OnInit, AfterViewInit {

  // The property chosen in the top bar; this page follows it
  private propertyContext = inject(PropertyContext);
  private propertySync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => this.followProperty(propertyId));
  });

  private followProperty(propertyId: number | null): void {
    if (propertyId === null || this.properties.length === 0 || this.selectedPropertyId === propertyId) {
      return;
    }
    this.selectedPropertyId = propertyId as any;
    this.filterUnitsByProperty();
    this.cdr.detectChanges();
  }

  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private contractsService = inject(ContractsService)
  private customersService = inject(CustomersService);
  private systemsParamsService = inject(SystemParametersServices);
  private platformId = inject(PLATFORM_ID); // ✅ Added

  // ViewChild for the dialog templates
  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
  @ViewChild('updateDialog') updateDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;

    @ViewChild('newContractDialog') newContractDialog!: TemplateRef<any>;

  loadAdding = false;
  loadUpdating = false;
  loadDeleting = false;
  isLoading = true; // ✅ Added

  customers: any[] = [];

  unitForm!: FormGroup;
  updateUnitForm!: FormGroup;
  contractForm!: FormGroup;
  selectedUnitId: string | null = null;
  selectedContractId: string | null = null;
  // Unit the contract dialog (create or end) is open for
  contractUnit: any = null;
  contractError: string | null = null;
  // True once the user types their own deposit, so it is no longer recalculated
  private depositEdited = false;

  formatToYMD(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  displayedColumns: string[] = ['unit_number', 'unit_type', 'tenant_name', 'rent_amount', 'active_contract_deposit', 'balance', 'status', 'actions'];
  unitsObject: UnitsTable[] = [];

  systemParameters: any;

  showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  dataSource = new MatTableDataSource<UnitsTable>(this.unitsObject);

  // ViewChild for the paginator
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  searchText: string = '';
  properties: any[] = [];
  selectedPropertyId: number | null = null;
  selectedPropertyName: string = '';

  showElectricityMeter: boolean = true;
  showWaterMeter: boolean = true;

  constructor(
    private UnitsService: UnitsService,
    private PropertiesService: PropertiesService,
    private dialog: MatDialog,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.updateUnitForm = this.fb.group({
      property: [this.selectedPropertyId, Validators.required],
      unit_number: ['', [Validators.required, Validators.minLength(1)]],
      unit_type: ['', [Validators.required, Validators.minLength(2)]],
      rent_amount: ['', [Validators.required, Validators.min(0)]],
      water_meter_reading: [0, [Validators.required, Validators.min(0)]],
      electricity_meter_reading: [0, [Validators.required, Validators.min(0)]],
    });
  }

  ngOnInit() {
    // ✅ CRITICAL: Only load data in browser
    if (isPlatformBrowser(this.platformId)) {

      // Verify token exists
      const token = localStorage.getItem('access_token');

      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      this.getProperties();
      this.loadCustomers();
      setTimeout(() => { this.initializeForm(); this.intContractForm}, 1000);
    } else {
    }
  }

  loadCustomers() {
    this.customersService.getCustomers().subscribe({
      next: (res) => {
        this.customers = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading customers:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  getSystemParameters(propertyId: number) {

    this.systemsParamsService.getSystemParams(propertyId).subscribe({
      next: (res) => {
        this.systemParameters = res;
        this.showElectricityMeter = this.systemParameters.has_electricity_bill;
        this.showWaterMeter = this.systemParameters.has_water_bill;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading system parameters:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
        this.cdr.detectChanges();
      }
    });
  }

  initializeForm() {
    this.unitForm = this.fb.group({
      property: [this.selectedPropertyId, Validators.required],
      unit_number: ['', [Validators.required, Validators.minLength(1)]],
      unit_type: ['', [Validators.required, Validators.minLength(2)]],
      rent_amount: ['', [Validators.required, Validators.min(0)]],
      water_meter_reading: [0, [Validators.required, Validators.min(0)]],
      electricity_meter_reading: [0, [Validators.required, Validators.min(0)]],
    });

  }

  intContractForm() {
    this.contractForm = this.fb.group({
      customer: ['', Validators.required],
      start_date: ['', Validators.required],
      rent_amount: ['', [Validators.required, Validators.min(0)]],
      deposit_amount: ['', [Validators.required, Validators.min(0)]],
      payment_frequency: ['', Validators.required],
    });
  }

  getUnits() {

    this.UnitsService.getUnits().subscribe({
      next: (res: UnitsTable[] | any) => {
        this.unitsObject = res;
        this.dataSource.data = this.unitsObject;
        this.isLoading = false;

        // Filter after data is loaded if property is selected
        if (this.selectedPropertyId) {
          this.filterUnitsByProperty();
        }

        // ✅ Only update paginator in browser
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            if (this.paginator) {
              this.dataSource.paginator = this.paginator;
            }
            this.cdr.detectChanges();
          });
        }
      },
      error: (err) => {
        console.error('❌ Error loading units:', err);
        this.isLoading = false;

        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          this.showError('Failed to load units.');
        }
      }
    });
  }

  getProperties() {

    this.PropertiesService.getProperties().subscribe({
      next: (res) => {
        this.properties = res;

        if (this.properties.length > 0) {
          // Auto-select the first property
          this.selectedPropertyId = this.propertyContext.resolve(this.properties) as any;
          this.selectedPropertyName = this.properties.find((prop: any) => prop.id === this.selectedPropertyId)?.name || '';
        }
        // 🔥 Tell Angular to re-run change detection safely
        this.cdr.detectChanges();

        // Fetch units after properties are loaded
        this.getUnits();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);

        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          this.showError('Failed to load properties.');
        }
      },
    });
  }

  ngAfterViewInit() {
    // ✅ Only set paginator in browser
    if (isPlatformBrowser(this.platformId)) {
      this.dataSource.paginator = this.paginator;
      this.cdr.detectChanges();
    }
  }

  /** Filter units by selected property */
  filterUnitsByProperty() {
    this.getSystemParameters(this.selectedPropertyId!);
    this.selectedPropertyName = this.properties.find(
      (prop) => prop.id === Number(this.selectedPropertyId)
    )?.name || '';

    if (!this.selectedPropertyId) {
      this.dataSource.data = this.unitsObject;
      return;
    }

    this.dataSource.data = this.unitsObject.filter(
      (unit) => unit.property === Number(this.selectedPropertyId)
    );

    // ✅ Only update paginator in browser
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.paginator) {
          this.paginator.firstPage();
        }
      });
    }
  }

  /** Apply search filter */
  applyFilter() {
    const filterValue = this.searchText.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  openAddUnitDialog() {
    const isMobile = window.innerWidth < 600;
    let dialogRef = this.dialog.open(this.openAddDialog, {
      maxWidth: '700px',
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
        } else if (result === 'no') {
        }
      }
    });
  }

  testForm() {
  }

  addUnit() {
    if (this.unitForm.invalid) {
      this.unitForm.markAllAsTouched();
      return;
    }

    this.loadAdding = true;
    this.cdr.detectChanges();

    const newUnit = {
      property: this.selectedPropertyId,
      unit_number: this.unitForm.value.unit_number,
      unit_type: this.unitForm.value.unit_type,
      rent_amount: this.unitForm.value.rent_amount,
      water_meter_reading: this.unitForm.value.water_meter_reading,
      electricity_meter_reading: this.unitForm.value.electricity_meter_reading,
    };

    this.UnitsService.addUnit(newUnit).subscribe({
      next: (res) => {
        this.loadAdding = false;
        this.getUnits();
        const resetValue = {
          property: this.selectedPropertyId,
          unit_number: '',
          unit_type: '',
          rent_amount: 0,
          water_meter_reading: 0,
          electricity_meter_reading: 0,
        };
        this.unitForm.reset(resetValue);
        this.dialog.closeAll();
        this.showSuccess('Unit added successfully!');
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error adding unit:', err);
        this.loadAdding = false;
        this.showError('Failed to add unit. Please try again.');

        if (err.error?.non_field_errors?.[0] === "The fields property, unit_number must make a unique set.") {
          this.showError("Check Unit Number, It should be unique to the property");
        }

        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }

        this.cdr.detectChanges();
      }
    });
  }

  /** Opens dialog and pre-fills data for update */
  openUpdateDialog(unit: any) {
    this.selectedUnitId = unit.id;
    this.updateUnitForm.patchValue({
      property: unit.property,
      unit_number: unit.unit_number,
      unit_type: unit.unit_type,
      rent_amount: unit.rent_amount,
      water_meter_reading: unit.water_meter_reading,
      electricity_meter_reading: unit.electricity_meter_reading,
      status: unit.status,
    });
    this.dialog.open(this.updateDialog);
  }

  /** Submits update request */
  updateUnit() {
    if (!this.selectedUnitId || this.updateUnitForm.invalid) return;

    this.loadUpdating = true;
    this.cdr.detectChanges();

    const updatedData = this.updateUnitForm.value;

    this.UnitsService.updateUnit(this.selectedUnitId, updatedData).subscribe({
      next: (response) => {
        this.loadUpdating = false;
        this.getUnits();
        this.updateUnitForm.reset();
        this.dialog.closeAll();
        this.showSuccess('Unit updated successfully!');
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('❌ Error updating unit:', error);
        this.loadUpdating = false;
        this.showError('Failed to update unit. Please try again.');

        if (error.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }

        this.cdr.detectChanges();
      },
    });
  }

  openDeleteDialog(unit: any) {
    this.selectedUnitId = unit.id;
    this.dialog.open(this.deleteDialog);
  }

  /** Performs deletion after confirmation */
  confirmDelete() {
    if (!this.selectedUnitId) return;

    this.loadDeleting = true;

    this.UnitsService.deleteUnit(this.selectedUnitId).subscribe({
      next: (response) => {
        this.loadDeleting = false;
        this.getUnits();
        this.dialog.closeAll();
        this.showSuccess('Unit deleted successfully!');
      },
      error: (error) => {
        console.error('❌ Error deleting unit:', error);
        this.loadDeleting = false;
        this.showError('Failed to delete unit. Please try again.');

        if (error.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      },
    });
  }

  /** Tenants who can take a unit: active and not already living in one */
  get availableTenants(): any[] {
    return (this.customers ?? []).filter((customer: any) => customer.is_active !== false && !customer.unit);
  }

  /** Months of rent taken as deposit, from the property's settings */
  get depositMonths(): number {
    return Number(this.systemParameters?.rent_deposit_months ?? 1);
  }

  /** What the tenant owes at move-in; mirrors the first invoice the server creates */
  get moveInLines(): { label: string; amount: number }[] {
    const form = this.contractForm?.value ?? {};
    const params = this.systemParameters ?? {};
    const lines = [
      { label: 'First rent', amount: Number(form.rent_amount) || 0 },
      { label: 'Rent deposit', amount: Number(form.deposit_amount) || 0 },
    ];
    if (params.require_water_deposit) {
      lines.push({ label: 'Water deposit', amount: Number(params.water_deposit_amount) || 0 });
    }
    if (params.require_electricity_deposit) {
      lines.push({ label: 'Electricity deposit', amount: Number(params.electricity_deposit_amount) || 0 });
    }
    if (params.has_service_charge && Number(params.default_service_charge) > 0) {
      lines.push({ label: 'Service charge', amount: Number(params.default_service_charge) });
    }
    return lines;
  }

  get moveInTotal(): number {
    return this.moveInLines.reduce((sum, line) => sum + line.amount, 0);
  }

  openContractDialog(unit: any) {
    this.contractUnit = unit;
    this.selectedUnitId = unit.id;
    this.contractError = null;
    this.depositEdited = false;
    this.loadAdding = false;

    this.intContractForm();
    const rent = Number(unit.rent_amount) || 0;
    this.contractForm.patchValue({
      start_date: new Date(),
      rent_amount: rent,
      deposit_amount: rent * this.depositMonths,
      payment_frequency: 'monthly',
    });

    // The deposit follows the rent until the user sets their own figure
    this.contractForm.get('rent_amount')?.valueChanges.subscribe(value => {
      if (!this.depositEdited) {
        this.contractForm.get('deposit_amount')?.setValue((Number(value) || 0) * this.depositMonths, { emitEvent: false });
      }
      this.cdr.detectChanges();
    });
    this.contractForm.get('deposit_amount')?.valueChanges.subscribe(() => this.cdr.detectChanges());

    // Pick up tenants registered since the page loaded
    this.loadCustomers();

    this.dialog.open(this.newContractDialog, { width: '640px', maxWidth: '95vw' });
  }

  onDepositInput() {
    this.depositEdited = true;
  }

  goToTenants() {
    this.dialog.closeAll();
    this.router.navigate(['/dashboard/rental-customers']);
  }

  addContract() {
    if (this.contractForm.invalid) {
      this.contractForm.markAllAsTouched();
      return;
    }

    this.loadAdding = true;
    this.contractError = null;
    const formValues = this.contractForm.value;

    const payload = {
      customer: formValues.customer,
      unit: this.selectedUnitId,
      start_date: this.formatToYMD(formValues.start_date),
      rent_amount: formValues.rent_amount,
      deposit_amount: formValues.deposit_amount,
      payment_frequency: formValues.payment_frequency,
    };

    this.contractsService.addContract(payload).subscribe({
      next: () => {
        this.loadAdding = false;
        this.showSuccess(`Unit ${this.contractUnit?.unit_number} is now rented out. The first invoice has been created.`);
        this.dialog.closeAll();
        this.contractForm.reset();
        this.getUnits();
        this.loadCustomers();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadAdding = false;
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
          return;
        }
        // Show the server's reason, e.g. the unit or tenant already has a contract
        const details = err.error;
        const firstFieldError = details && typeof details === 'object'
          ? Object.values(details).flat().find(value => typeof value === 'string')
          : null;
        this.contractError = details?.error || (firstFieldError as string) || 'The contract could not be created. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  // End a contract: readings, deductions and the deposit are settled in the move-out dialog

  openCancelDialog(unit: any) {
    if (!unit.contract_id) return;
    this.dialog.open(MoveOutDialog, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      data: { contractId: unit.contract_id },
    }).afterClosed().subscribe(ended => {
      if (ended) {
        this.showSuccess(`Contract ended. Unit ${unit.unit_number} is vacant again.`);
        this.getUnits();
        this.loadCustomers();
        this.cdr.detectChanges();
      }
    });
  }
}
