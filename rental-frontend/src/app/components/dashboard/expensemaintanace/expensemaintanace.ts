import {
  Component,
  AfterViewInit,
  ViewChild,
  inject,
  TemplateRef,
  ChangeDetectorRef,
  PLATFORM_ID,
  OnInit
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SharedImports } from '../../../shared-imports/imports';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ExpensesService } from '../../../services/expense-service';
import { MaintenanceService } from '../../../services/maintanance-service';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { PropertiesService } from '../../../services/properties';
import { UnitsService } from '../../../services/units';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CustomersService } from '../../../services/customer';
import { PaymentService } from '../../../services/payments';

export interface expensesObject {
  description: string;
  amount: string;
  expense_date: string;
}

export interface maintanceObject {
  unit_number: string;
  description: string;
  status: string;
  reported_date: string;
}

@Component({
  selector: 'app-expensemaintanace',
  imports: [SharedImports],
  templateUrl: './expensemaintanace.html',
  styleUrl: './expensemaintanace.css'
})
export class Expensemaintanace implements OnInit, AfterViewInit {

  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private expenseService = inject(ExpensesService);
  private maintanaceService = inject(MaintenanceService);
  private propertyService = inject(PropertiesService);
  private unitsService = inject(UnitsService);
  private fb = inject(FormBuilder);
  private cdr = inject(ChangeDetectorRef);
  private customerService = inject(CustomersService);
  private platformId = inject(PLATFORM_ID);
  private paymentService = inject(PaymentService);

  today = new Date();

  expensePaymentForm!: FormGroup;
  maintanancePaymentForm!: FormGroup;

  expenseIDP: any;
  maintananceIDP: any;

  loadMakingPayments:boolean = false;

  //expenses dialogs
  @ViewChild('addExpeDial') addExpeDial!: TemplateRef<any>;
  @ViewChild('updateExpenseDial') updateExpenseDial!: TemplateRef<any>;
  @ViewChild('deleteExpensDial') deleteExpensDial!: TemplateRef<any>;

  // maintanance dialogs
  @ViewChild('addMaintanceDial') addMaintanceDial!: TemplateRef<any>;
  @ViewChild('updateMaintanceDial') updateMaintanceDial!: TemplateRef<any>;
  @ViewChild('deleteMaintanceDial') deleteMaintanceDial!: TemplateRef<any>;

  @ViewChild('maintananceChangeState') maintananceChangeState!: TemplateRef<any>;

  @ViewChild('expensesPaymentsDial') expensesPaymentsDial!: TemplateRef<any>;
  @ViewChild('maintancePaymentsDial') maintancePaymentsDial!: TemplateRef<any>;

  expenseForm!: FormGroup;
  updateExpenseForm!: FormGroup;
  maintanaceForm!: FormGroup;
  updateMaintanaceForm!: FormGroup;
  properties: any[] = [];
  isSubmitting = false;
  isUpdateExpenseSubmit = false;
  isLoading = false;
  expenseId: any;
  expenseName: any;
  filteredUnits: any[] = [];
  units: any[] = [];
  propertiesList: any[] = [];
  customers: any[] = [];
  maintananceId: any;
  maintanaceName: any;
  selectedPropertyId: any = null;
  allExpenses: any[] = [];
  allMaintenance: any[] = [];
  startDate: Date | null = null;
  endDate: Date | null = null;
  selectedProperty: any;
  isUpdateSubmitting = false;

  expenseObject: expensesObject[] = [];
  displayedExpensesColumns: string[] = ['description', 'amount', 'expense_date', 'actions'];
  dataExpenseSource = new MatTableDataSource<expensesObject>(this.expenseObject);

  maintainanceObject: maintanceObject[] = [];
  displayedMaintanceColumns: string[] = ['unit_number', 'description', 'status', 'reported_date', 'actions'];
  dataMaintanceSource = new MatTableDataSource<maintanceObject>(this.maintainanceObject);

  @ViewChild('expensesPaginator') expensePaginator!: MatPaginator;
  @ViewChild('maintancePaginator') maintancePaginator!: MatPaginator;

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.dataExpenseSource.paginator = this.expensePaginator;
      this.dataMaintanceSource.paginator = this.maintancePaginator;
    }
  }

  ngOnInit(): void {
    // Initialize forms first
    this.expenseSForm();
    this.updateExpensesForm();
    this.openMaintanaceForm();
    this.openUpdateMaintanaceForm();
    this.expensePaymentsFormsInit();
  

    if (isPlatformBrowser(this.platformId)) {
      console.log('🔍 Expense & Maintenance component running in browser');
      
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token status:', token ? 'Token exists' : '❌ NO TOKEN!');
      
      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      // ✅ Load units and properties first, then load data
      this.loadInitialData();
    } else {
      console.log('⚠️ Expense & Maintenance component running on server, skipping API calls');
    }
  }

  // ✅ NEW: Load data in correct order
  loadInitialData() {
    // Load units first
    this.unitsService.getUnits().subscribe({
      next: (unitData) => {
        console.log('✅ Units loaded:', unitData);
        this.units = unitData;
        
        // Then load properties
        this.propertyService.getProperties().subscribe({
          next: (propData) => {
            console.log('✅ Properties loaded:', propData);
            this.properties = propData;
            
            // Set default property
            if (this.properties.length) {
              this.selectedPropertyId = this.properties[0].id;
              this.onPropertyChange(this.selectedPropertyId);
            }
            
            // Now load expenses and maintenance
            this.getExpenses();
            this.getMaintanance();
            this.getCustomers();
          },
          error: (error) => {
            this.showError('Failed to load properties.');
            console.error('Error fetching properties:', error);
            if (error.status === 401) {
              this.router.navigate(['/login']);
            }
          }
        });
      },
      error: (error) => {
        this.showError('Failed to load units.');
        console.error('Error fetching units:', error);
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  getCustomers() {
    this.customerService.getCustomers().subscribe({
      next: (data) => {
        console.log('✅ Customers loaded:', data);
        this.customers = data;
      },
      error: (error) => {
        this.showError('Failed to load customers.');
        console.error('Error fetching customers:', error);
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  openMaintanaceForm(): void {
    this.maintanaceForm = this.fb.group({
      unit: ['', Validators.required],
      customer: ['', Validators.required],
      description: ['', Validators.required],
    });
  }

  openUpdateMaintanaceForm(): void {
    this.updateMaintanaceForm = this.fb.group({
      unit: ['', Validators.required],
      customer: ['', Validators.required],
      description: ['', Validators.required],
    });
  }

  expenseSForm(): void {
    this.expenseForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    });
  }

  updateExpensesForm(): void {
    this.updateExpenseForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    });
  }


  expensePaymentsFormsInit() : void {  
    this.expensePaymentForm = this.fb.group({
      amount: ['', Validators.required],
      method: ['', Validators.min(0)],
      reference: ['', Validators.required],
      notes: ['', [Validators.required]]
    });


  }

  maintanancePaymentsFormsInit() : void {  

    this.maintanancePaymentForm = this.fb.group({
      amount: ['', Validators.required],
      method: ['', Validators.min(0)],
      reference: ['', Validators.required],
      notes: ['', [Validators.required]]
    });
  }

  onPropertyChange(propertyId: number) {
    if (!propertyId) return;
    
    console.log('🔄 Property changed to:', propertyId);
    console.log('📊 Available units:', this.units.length);

    this.selectedPropertyId = propertyId;

    if (this.selectedProperty) {
      this.selectedProperty.setValue(propertyId);
    }

    // Filter matching units
    this.filteredUnits = this.units.filter(
      u => u.property_id === propertyId || u.property === propertyId
    );

    console.log('✅ Filtered units:', this.filteredUnits.length);
    
    // ✅ CRITICAL: Filter data after property change
    this.filterDataByProperty();
    
    this.cdr.detectChanges();
  }

  getExpenses() {
    this.expenseService.getExpenses().subscribe({
      next: (data) => {
        console.log('✅ Expenses loaded:', data.length);
        this.allExpenses = data;
        this.filterDataByProperty(); // ✅ Filter after loading
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showError('Failed to load expenses.');
        console.error('Error fetching expenses:', error);
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  getMaintanance() {
    this.maintanaceService.getMaintenanceRequests().subscribe({
      next: (data) => {
        console.log('✅ Maintenance loaded:', data.length);
        this.allMaintenance = data;
        this.filterDataByProperty(); // ✅ Filter after loading
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.showError('Failed to load maintenance records.');
        console.error('Error fetching maintenance records:', error);
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  addExpenses(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }

    const data = {
      property: this.selectedPropertyId,
      description: this.expenseForm.value.description,
      amount: this.expenseForm.value.amount,
    };
    this.isSubmitting = true;

    this.expenseService.addExpense(data).subscribe({
      next: (res) => {
        this.showSuccess('Expense added successfully ✅');
        this.getExpenses();
        this.expenseForm.reset();
        this.isSubmitting = false;
        this.dialog.closeAll();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error submitting expense:', err);
        this.showError('Failed to add expense ❌');
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  openAAddExpenseDialog() {
    let dialogRef = this.dialog.open(this.addExpeDial, {
      maxWidth: '700px',
    });
  }

  openUpdateDial() {
    let dialogRef = this.dialog.open(this.updateExpenseDial, {
      maxWidth: '700px',
    });
  }

  openExpensesDialog(element: any) {
    console.log('Open expenses dialog for:', element);
    this.expenseId = element.id;
    this.updateExpenseForm.patchValue({
      property: element.property,
      description: element.description,
      amount: element.amount
    });
  }

  updateExpense() {
    if (this.updateExpenseForm.invalid) {
      this.updateExpenseForm.markAllAsTouched();
      return;
    }

    const data = {
      property: this.selectedPropertyId,
      description: this.updateExpenseForm.value.description,
      amount: this.updateExpenseForm.value.amount,
    };

    this.isUpdateExpenseSubmit = true;

    this.expenseService.updateExpense(this.expenseId, data).subscribe({
      next: (res) => {
        this.showSuccess('Expense updated successfully ✅');
        this.getExpenses();
        this.updateExpenseForm.reset();
        this.isUpdateExpenseSubmit = false;
        this.dialog.closeAll();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error updating expense:', err);
        this.showError('Failed to update expense ❌');
        this.isUpdateExpenseSubmit = false;
        this.cdr.detectChanges();
      }
    });
  }

  openDeleteDialog(element: any) {
    this.expenseId = element.id;
    this.expenseName = element.description;
    let dialogRef = this.dialog.open(this.deleteExpensDial);
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'yes') {
        this.expenseService.deleteExpense(this.expenseId).subscribe({
          next: (res) => {
            this.showSuccess(`Expense ${this.expenseName} deleted successfully ✅`);
            this.getExpenses();
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error deleting expense:', err);
            this.showError('Failed to delete expense ❌');
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  openDeleteMainanceDialog(element: any) {
    this.maintananceId = element.id;
    this.maintanaceName = element.description;
    let dialogRef = this.dialog.open(this.deleteMaintanceDial);
    dialogRef.afterClosed().subscribe(result => {
      if (result === 'yes') {
        this.maintanaceService.deleteMaintenanceRequest(this.maintananceId).subscribe({
          next: (res) => {
            this.showSuccess(`Maintenance ${this.maintanaceName} deleted successfully ✅`);
            this.getMaintanance();
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error deleting maintenance:', err);
            this.showError('Failed to delete maintenance ❌');
            this.cdr.detectChanges();
          }
        });
      }
    });
  }

  addMaintanaceForm() {
    if (this.maintanaceForm.invalid) {
      this.maintanaceForm.markAllAsTouched();
      return;
    }

    this.isSubmitting = true;
    const payload = this.maintanaceForm.value;
    console.log('Submitting maintenance request:', payload);

    this.maintanaceService.addMaintenanceRequest(payload).subscribe({
      next: (res) => {
        this.showSuccess('Maintenance request added successfully ✅');
        this.getMaintanance();
        this.maintanaceForm.reset();
        this.isSubmitting = false;
        this.dialog.closeAll();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error submitting maintenance request:', err);
        this.showError('Failed to add maintenance request ❌');
        this.isSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  openUpdateMaintanaceDialog(element: any) {
    this.maintananceId = element.id;
    this.updateMaintanaceForm.patchValue({
      unit: element.unit,
      customer: element.customer,
      description: element.description
    });
    this.isUpdateSubmitting = false;
    this.dialog.open(this.updateMaintanceDial, { maxWidth: '780px' });
  }

  updateMaintanaceFormSubmit() {
    if (this.updateMaintanaceForm.invalid) {
      this.updateMaintanaceForm.markAllAsTouched();
      return;
    }

    this.isUpdateSubmitting = true;
    const payload = { ...this.updateMaintanaceForm.value, property: this.selectedPropertyId };

    this.maintanaceService.updateMaintenanceRequest(this.maintananceId, payload).subscribe({
      next: () => {
        this.showSuccess('Maintenance request updated successfully ✅');
        this.getMaintanance();
        this.dialog.closeAll();
        this.isUpdateSubmitting = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.showError('Failed to update maintenance request ❌');
        this.isUpdateSubmitting = false;
        this.cdr.detectChanges();
      }
    });
  }

  openAddMaintanaceDialog() {
    this.dialog.open(this.addMaintanceDial, {
      maxWidth: '780px',
    });
  }

  onPropertyFilterChange(propertyId: any) {
    this.selectedPropertyId = propertyId;
    this.filterDataByProperty();
    this.onPropertyChange(propertyId);
  }

  onDateFilterChange() {
    this.filterDataByProperty();
  }

  clearDateFilters() {
    this.startDate = null;
    this.endDate = null;
    this.filterDataByProperty();
  }

  filterDataByProperty() {
    // ✅ CRITICAL: Check if we have data AND a selected property
    if (!this.selectedPropertyId) {
      console.log('⚠️ No property selected, skipping filter');
      return;
    }

    console.log('🔍 Filtering data for property:', this.selectedPropertyId);
    console.log('📊 All Expenses:', this.allExpenses.length);
    console.log('📊 All Maintenance:', this.allMaintenance.length);

    // Filter expenses
    let filteredExpenses = this.allExpenses.filter(
      expense => expense.property === this.selectedPropertyId
    );

    console.log('✅ Filtered Expenses:', filteredExpenses.length);

    // Date filter for expenses
    if (this.startDate || this.endDate) {
      filteredExpenses = filteredExpenses.filter(expense => {
        const expenseDate = new Date(expense.expense_date);

        if (this.startDate && this.endDate) {
          return expenseDate >= this.startDate && expenseDate <= this.endDate;
        } else if (this.startDate) {
          return expenseDate >= this.startDate;
        } else if (this.endDate) {
          return expenseDate <= this.endDate;
        }
        return true;
      });
    }

    this.expenseObject = filteredExpenses;

    // Filter maintenance
    let filteredMaintenance = this.allMaintenance.filter(
      maintenance => parseInt(maintenance.property_id) === this.selectedPropertyId
    );

    console.log('✅ Filtered Maintenance:', filteredMaintenance.length);

    // Date filter for maintenance
    if (this.startDate || this.endDate) {
      filteredMaintenance = filteredMaintenance.filter(maintenance => {
        const reportedDate = new Date(maintenance.reported_date);

        if (this.startDate && this.endDate) {
          return reportedDate >= this.startDate && reportedDate <= this.endDate;
        } else if (this.startDate) {
          return reportedDate >= this.startDate;
        } else if (this.endDate) {
          return reportedDate <= this.endDate;
        }
        return true;
      });
    }

    this.maintainanceObject = filteredMaintenance;

    // Update table data sources
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.dataExpenseSource.data = this.expenseObject;
        this.dataExpenseSource.paginator = this.expensePaginator;

        this.dataMaintanceSource.data = this.maintainanceObject;
        this.dataMaintanceSource.paginator = this.maintancePaginator;
        
        console.log('✅ Tables updated with filtered data');
      });
    }
  }

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



  openChangeStatusDialog(element: any) {
    console.log("Change status for:", element);
    this.maintananceId= element.id;
  }


  // change status dialog

changeMaintanaceStatus() {
  const dialogRef = this.dialog.open(this.maintananceChangeState, {
    maxWidth: '700px',
    panelClass: 'confirm-dialog'
  });

  dialogRef.afterClosed().subscribe(result => {
    if (!result) return;

    const data =
      result === 'yes'
        ? { status: 'in_progress' }
        : { status: 'resolved' };

    this.maintanaceService.updateStatusRequest(this.maintananceId, data).subscribe({
      next: () => {
        this.showSuccess('Maintenance status updated successfully ✅');
        this.getMaintanance();
        this.dialog.closeAll();
        this.cdr.detectChanges();
      },
      error: () => {
        this.showError('Failed to update maintenance status ❌');
        this.cdr.detectChanges();
      }
    });
  });
}


// payments dialogs functions

  openMakeExpensesPaymentDialog(element: any) {
    console.log("Make payment for:", element);
    this.expenseIDP = element.id;

     let dialogRef = this.dialog.open(this.expensesPaymentsDial,{
      maxWidth: '700px',
     });
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          // Handle yes
        } else if (result === 'no') {
          // Handle no
        }
      }
    });
  }

 addExpensePayment() {
    this.loadMakingPayments = true;
    const data = {
      expense: this.expenseIDP,
      amount: this.expensePaymentForm.value.amount,
      method: this.expensePaymentForm.value.method,
      reference: this.expensePaymentForm.value.reference,
      notes: this.expensePaymentForm.value.notes,
      type:"OUT"
    };

    console.log('📤 Making payment:', data);

    this.paymentService.makePayment(data).subscribe({
      next: (res) => {
        console.log('✅ Payment made successfully:', res);
        this.loadMakingPayments = false;
        this.showSuccess("Payment Made successfully");
        this.getExpenses()
        this.dialog.closeAll();
        this.expensePaymentForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error making payment:', err);
        this.loadMakingPayments = false;
        this.cdr.detectChanges();
        this.showError("Kindly check your details");
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      }
    });
  }


  openMakeMaintancePaymentDialog(element: any) {
    console.log("Make payment for:", element);
    this.maintanancePaymentsFormsInit();
    this.maintananceIDP = element.id;

     let dialogRef = this.dialog.open(this.maintancePaymentsDial,{
      maxWidth: '700px',
     });
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          // Handle yes
        } else if (result === 'no') {
          // Handle no
        }
      }
    });
  }


   addMaintancePayment() {
    this.loadMakingPayments = true;
    const data = {
      maintenance_request: this.maintananceIDP ,
      amount: this.maintanancePaymentForm.value.amount,
      method: this.maintanancePaymentForm.value.method,
      reference: this.maintanancePaymentForm.value.reference,
      notes: this.maintanancePaymentForm.value.notes,
      type:"OUT"
    };

    console.log('📤 Making payment:', data);

    this.paymentService.makePayment(data).subscribe({
      next: (res) => {
        console.log('✅ Payment made successfully:', res);
        this.loadMakingPayments = false;
        this.showSuccess("Payment Made successfully");
        this.getMaintanance()
        this.dialog.closeAll();
        this.maintanancePaymentForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error making payment:', err);
        this.loadMakingPayments = false;
        this.cdr.detectChanges();
        this.showError("Kindly check your details");
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      }
    });
  }


}