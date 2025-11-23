import { Component, inject, ViewChild, AfterViewInit, OnInit, ChangeDetectorRef, TemplateRef, PLATFORM_ID } from '@angular/core';
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
}

@Component({
  selector: 'app-units',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './units.html',
  styleUrl: './units.css'
})
export class Units implements OnInit, AfterViewInit {
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
    @ViewChild('cancelContractDialog') cancelContractDialog!: TemplateRef<any>;

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
  loadCancelling: boolean = false;


  formatToYMD(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }


  displayedColumns: string[] = ['unit_number', 'unit_type', 'rent_amount', 'active_contract_deposit', 'balance', 'status', 'actions'];
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
      console.log('🔍 Units component running in browser');

      // Verify token exists
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token status:', token ? 'Token exists' : '❌ NO TOKEN!');

      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      this.getProperties();
      this.loadCustomers();
      setTimeout(() => { this.initializeForm(); this.intContractForm}, 1000);
    } else {
      console.log('⚠️ Units component running on server, skipping API calls');
    }
  }



  loadCustomers() {
    console.log('📡 Loading customers...');
    this.customersService.getCustomers().subscribe({
      next: (res) => {
        this.customers = res;
        console.log('✅ Customers loaded:', this.customers);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading customers:', err);
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      },
    });
  }


  getSystemParameters(propertyId: number) {
    console.log('📡 Loading system parameters for property:', propertyId);

    this.systemsParamsService.getSystemParams(propertyId).subscribe({
      next: (res) => {
        console.log('✅ System parameters loaded:', res);
        this.systemParameters = res;
        this.showElectricityMeter = this.systemParameters.has_electricity_bill;
        this.showWaterMeter = this.systemParameters.has_water_bill;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading system parameters:', err);
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
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
    console.log('📡 Loading units...');

    this.UnitsService.getUnits().subscribe({
      next: (res: UnitsTable[] | any) => {
        console.log('✅ Units loaded:', res);
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
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          this.showError('Failed to load units.');
        }
      }
    });
  }

  getProperties() {
    console.log('📡 Loading properties...');

    this.PropertiesService.getProperties().subscribe({
      next: (res) => {
        console.log('✅ Properties loaded:', res);
        this.properties = res;

        if (this.properties.length > 0) {
          // Auto-select the first property
          this.selectedPropertyId = this.properties[0].id;
          this.selectedPropertyName = this.properties[0].name;
        }
        // 🔥 Tell Angular to re-run change detection safely
        this.cdr.detectChanges();

        // Fetch units after properties are loaded
        this.getUnits();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);

        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
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
          console.log('User clicked yes.');
        } else if (result === 'no') {
          console.log('User clicked no.');
        }
      }
    });
  }

  testForm() {
    console.log(this.unitForm.value);
  }

  addUnit() {
    if (this.unitForm.invalid) {
      this.unitForm.markAllAsTouched();
      return;
    }

    this.loadAdding = true;
    console.log('📤 Adding unit...');
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
        console.log('✅ Unit added successfully:', res);
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
          console.log('🔒 Unauthorized, redirecting to login...');
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
    console.log('📤 Updating unit:', this.selectedUnitId);
    this.cdr.detectChanges();

    const updatedData = this.updateUnitForm.value;

    this.UnitsService.updateUnit(this.selectedUnitId, updatedData).subscribe({
      next: (response) => {
        console.log('✅ Unit updated successfully:', response);
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
          console.log('🔒 Unauthorized, redirecting to login...');
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
    console.log('🗑️ Deleting unit:', this.selectedUnitId);

    this.UnitsService.deleteUnit(this.selectedUnitId).subscribe({
      next: (response) => {
        console.log('✅ Unit deleted successfully:', response);
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
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      },
    });
  }

  openCreateContractDialog(id: any) {
    this.selectedUnitId= id.id
    console.log(id);
    this.contractForm.patchValue({  
      rent_amount: id.rent_amount,
      deposit_amount: id.rent_amount*this.systemParameters.rent_deposit_months ,
      payment_frequency:'monthly',

    })
  }

  openCancelContractDialog(id: any) {
    console.log(id);
  }


  // add contract here


   openNewContractDial() {

      this.intContractForm();
        let dialogRef = this.dialog.open(this.newContractDialog,{
          maxWidth: '700px',
        });
        dialogRef.afterClosed().subscribe(result => {
            // Note: If the user clicks outside the dialog or presses the escape key, there'll be no result
            if (result !== undefined) {
                if (result === 'yes') {
                } else if (result === 'no') {
                }
            }
        })


    }

    addContract() {
    if (this.contractForm.invalid) {
      this.contractForm.markAllAsTouched();
      return;
    }

    this.loadAdding = true;
    const formValues = this.contractForm.value;

    const payload = {
      customer: formValues.customer,
      unit: this.selectedUnitId,
      start_date: this.formatToYMD(formValues.start_date),
      rent_amount: formValues.rent_amount,
      deposit_amount: formValues.deposit_amount,
      payment_frequency: formValues.payment_frequency,
    };

    console.log('📤 Adding contract:', payload);

    this.contractsService.addContract(payload).subscribe({
      next: () => {
        console.log('✅ Contract added successfully');
        this.loadAdding = false;
        this.showSuccess('Contract added successfully!');
        this.dialog.closeAll();
        this.contractForm.reset();
        this.getUnits();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error adding contract:', err);
        this.loadAdding = false;
        this.showError('Failed to add contract.');
        this.cdr.detectChanges();
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      },
    });
  }

  //cancel contract here

    openCancelDialog(contract: any) {
      this.selectedContractId = contract.contract_id;
      this.dialog.open(this.cancelContractDialog, {
        width: '500px',
        disableClose: true
      });
    }
  
    confirmCancel() {
      if (!this.selectedContractId) return;
      this.loadCancelling = true;
  
      const payload = {
        is_active: false,
        cancellation_date: new Date().toISOString().split('T')[0]
      };
  
      console.log('📤 Cancelling contract:', this.selectedContractId);
  
      this.contractsService.cancelContract(this.selectedContractId, payload).subscribe({
        next: () => {
          console.log('✅ Contract cancelled successfully');
          this.showSuccess('Contract cancelled successfully!');
          this.dialog.closeAll();
          setTimeout(() => {
            this.getUnits();
          });
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('❌ Error cancelling contract:', err);
          this.loadCancelling = false;
          this.showError('Failed to cancel contract.');
          if (err.status === 401) {
            console.log('🔒 Unauthorized, redirecting to login...');
            this.router.navigate(['/login']);
          }
          this.cdr.detectChanges();
        },
      });
    }
  

  
}