import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  TemplateRef,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { SharedImports } from '../../../shared-imports/imports';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { ContractsService } from '../../../services/contract-service';
import { CustomersService } from '../../../services/customer';
import { UnitsService } from '../../../services/units';

export interface ContractObject {
  id: number;
  customer_name: string;
  customer_phone: string;
  unit_info: string;
  contract_number: string | null;
  start_date: string;
  end_date: string;
  rent_amount: string;
  deposit_amount: string;
  payment_frequency: string;
  is_active: boolean;
  customer: number;
  unit: number;
}

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './contracts.html',
  styleUrl: './contracts.css',
})
export class Contracts implements OnInit, AfterViewInit {
  apiUrl = environment.apiUrl;

  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private contractsService = inject(ContractsService);
  private customersService = inject(CustomersService);
  private unitsService = inject(UnitsService);
  private propertyService = inject(UnitsService);
  private fb = inject(FormBuilder);

  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
  @ViewChild('editDialog') editDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  @ViewChild('cancelDialog') cancelDialog!: TemplateRef<any>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  contracts: ContractObject[] = [];
  dataSource = new MatTableDataSource<ContractObject>([]);
  displayedColumns: string[] = [
    'contract_number',
    'customer_name',
    'customer_phone',
    'unit_info',
    'start_date',
    'end_date',
    'rent_amount',
    'deposit_amount',
    'payment_frequency',
    'is_active',
    'actions',
  ];

  contractForm!: FormGroup;
  updateContractForm!: FormGroup;
  selectedContractId: number | null = null;
  isEditMode = false;

  isLoading = false;
  loadAdding = false;
  loadUpdating = false;
  loadDeleting = false;
  loadCancelling = false;
  error: string | null = null;
  
  customers: any[] = [];
  units: any[] = [];
  properties: any[] = [];
  filteredUnits: any[] = [];
  

  searchText = '';

  ngOnInit(): void {

    this.initForm();
    this.upContractForm();
    this.loadCustomers();
    this.loadUnits();
    this.loadProperties();
    this.loadContracts();
  }

  ngAfterViewInit(): void {
    // Assign paginator after view is fully initialized
    setTimeout(() => {
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    });
  }

  initForm() {
    this.contractForm = this.fb.group({
      customer: ['', Validators.required],
      property: ['', Validators.required],
      unit: ['', Validators.required],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      rent_amount: ['', Validators.required],
      deposit_amount: ['', Validators.required],
      payment_frequency: ['', Validators.required],
    });
  }

  upContractForm() {
    this.updateContractForm = this.fb.group({
      customer: ['', Validators.required],
      unit: ['', Validators.required],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      rent_amount: ['', Validators.required],
      deposit_amount: ['', Validators.required],
      payment_frequency: ['', Validators.required],
    });
  }

  /** 🔹 Fetch all customers */

  loadCustomers() {
    this.customersService.getCustomers().subscribe({
      next: (res) => {
        this.customers = res;
        console.log('✅ Customers loaded:', this.customers);
      },
      error: (err) => {
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  loadUnits() {
    this.unitsService.getUnits().subscribe({
      next: (res) => {
        this.units = res;
        console.log('✅ Units loaded:', this.units);
      },
      error: (err) => {
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  loadProperties() {
    this.propertyService.getUnits().subscribe({
      next: (res) => {
        this.properties = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

    onPropertyChange(propertyId: number) {
    // 🟢 Filter units based on the selected property
    this.filteredUnits = this.units.filter(u => u.property === propertyId);

    // Optionally reset unit selection
    this.contractForm.patchValue({ unit: '' });
  }

  /** 🔹 Fetch all contracts */
  loadContracts() {
    this.isLoading = true;
    this.contractsService.getContracts().subscribe({
      next: (res) => {
        this.contracts = res;
        this.dataSource.data = this.contracts;
        this.isLoading = false;
        console.log('✅ Contracts loaded:', this.contracts);

        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
      },
      error: (err) => {
        console.error('❌ Error loading contracts:', err);
        this.isLoading = false;
        this.error = 'Failed to load contracts.';
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  /** 🔹 Open Add Contract Dialog */
  openAddDialogForm() {
    this.isEditMode = false;
    this.contractForm.reset();
    this.dialog.open(this.openAddDialog, {
      width: '600px',
      disableClose: true
    });
  }

  /** 🔹 Open Edit Contract Dialog */
  openEditDialog(contract: ContractObject) {
    this.isEditMode = true;
    this.selectedContractId = contract.id;

    // Populate form with existing data
    this.updateContractForm.patchValue({
      customer: contract.customer,
      unit: contract.unit,
      start_date: contract.start_date,
      end_date: contract.end_date,
      rent_amount: contract.rent_amount,
      deposit_amount: contract.deposit_amount,
      payment_frequency: contract.payment_frequency,
    });

    this.dialog.open(this.editDialog, {
      width: '600px',
      disableClose: true
    });
  }

  /** 🔹 Add contract */
  addContract() {
    if (this.contractForm.invalid) {
      this.contractForm.markAllAsTouched();
      return;
    }

    this.loadAdding = true;
    const formValues = this.contractForm.value;

    const payload = {
      customer: formValues.customer,
      unit: formValues.unit,
      start_date: formValues.start_date,
      end_date: formValues.end_date,
      rent_amount: formValues.rent_amount,
      deposit_amount: formValues.deposit_amount,
      payment_frequency: formValues.payment_frequency,
    };

    this.contractsService.addContract(payload).subscribe({
      next: () => {
        this.loadAdding = false;
        this.showSuccess('Contract added successfully!');
        this.dialog.closeAll();
        this.contractForm.reset();
        this.loadContracts();
      },
      error: (err) => {
        this.loadAdding = false;
        console.error('❌ Error adding contract:', err);
        this.showError('Failed to add contract.');
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } 
      },
    });
  }

  /** 🔹 Update contract */
  updateContract() {
    if (this.updateContractForm.invalid) {
      this.updateContractForm.markAllAsTouched();
      return;
    }

    if (!this.selectedContractId) return;

    this.loadUpdating = true;
    const formValues = this.updateContractForm.value;

    const payload = {
      customer: formValues.customer,
      unit: formValues.unit,
      start_date: formValues.start_date,
      end_date: formValues.end_date,
      rent_amount: formValues.rent_amount,
      deposit_amount: formValues.deposit_amount,
      payment_frequency: formValues.payment_frequency,
    };

    this.contractsService.updateContract(this.selectedContractId, payload).subscribe({
      next: () => {
        this.loadUpdating = false;
        this.showSuccess('Contract updated successfully!');
        this.dialog.closeAll();
        this.updateContractForm.reset();
        this.loadContracts();
      },
      error: (err) => {
        this.loadUpdating = false;
        console.error('❌ Error updating contract:', err);
        this.showError('Failed to update contract.');
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } 
      },
    });
  }

  /** 🔹 Delete contract */
  openDeleteDialog(contract: ContractObject) {
    this.selectedContractId = contract.id;
    this.dialog.open(this.deleteDialog);
  }

  confirmDelete() {
    if (!this.selectedContractId) return;
    this.loadDeleting = true;

    this.contractsService.deleteContract(this.selectedContractId).subscribe({
      next: () => {
        this.loadDeleting = false;
        this.showSuccess('Contract deleted successfully!');
        this.dialog.closeAll();
        this.loadContracts();
      },
      error: (err) => {
        this.loadDeleting = false;
        console.error('❌ Error deleting contract:', err);
        this.showError('Failed to delete contract.');
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  /** 🔹 Cancel contract */
  openCancelDialog(contract: ContractObject) {
    this.selectedContractId = contract.id;
    this.dialog.open(this.cancelDialog, {
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

  this.contractsService.cancelContract(this.selectedContractId, payload).subscribe({
    next: () => {
   
      this.showSuccess('Contract cancelled successfully!');
      this.dialog.closeAll();

      // 👇 Wait until Angular stabilizes, then reload contracts
      setTimeout(() => {
        this.loadContracts();
      });
      
    },
    error: (err) => {
      this.loadCancelling = false;
      console.error('❌ Error cancelling contract:', err);
      this.showError('Failed to cancel contract.');
      if (err.status === 401) this.router.navigate(['/login']);
    },
  });
}


  /** 🔹 Search filter */
  applyFilter() {
    const filterValue = this.searchText.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  /** 🔹 Snackbar helpers */
  showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }
}