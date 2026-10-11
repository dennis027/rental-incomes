import { PropertyContext } from '../../../services/property-context';
import { CategoryOption, EXPENSE_CATEGORIES, MAINTENANCE_CATEGORIES } from './expense-categories';
import { Component, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef, PLATFORM_ID, OnInit, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SharedImports } from '../../../shared-imports/imports';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
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
    this.onPropertyFilterChange(propertyId);
  }

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
  displayedExpensesColumns: string[] = ['category', 'description', 'expense_date', 'amount', 'amount_paid', 'balance', 'payment_status', 'actions'];
  dataExpenseSource = new MatTableDataSource<expensesObject>(this.expenseObject);

  maintainanceObject: maintanceObject[] = [];
  displayedMaintanceColumns: string[] = ['unit_number', 'category', 'description', 'status', 'reported_date', 'amount', 'payment_status', 'actions'];
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
      
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      // ✅ Load units and properties first, then load data
      this.loadInitialData();
    } else {
    }
  }

  // ✅ NEW: Load data in correct order
loadInitialData() {
    this.isLoading = true;

    // Everything the page needs, requested together instead of one after another
    forkJoin({
      units: this.unitsService.getUnits(),
      properties: this.propertyService.getProperties(),
      expenses: this.expenseService.getExpenses(),
      maintenance: this.maintanaceService.getMaintenanceRequests(),
      customers: this.customerService.getCustomers(),
    }).subscribe({
      next: ({ units, properties, expenses, maintenance, customers }) => {
        this.units = units;
        this.properties = properties;
        this.allExpenses = expenses;
        this.allMaintenance = maintenance;
        this.customers = customers;

        if (this.properties.length) {
          this.selectedPropertyId = this.propertyContext.resolve(this.properties);
          this.onPropertyChange(this.selectedPropertyId);
        }

        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;
        if (error.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        this.showError('The page could not be loaded. Check your connection and try again.');
        this.cdr.detectChanges();
      }
    });
  }

  // ---------- What is on screen ----------

  tab: 'expenses' | 'maintenance' = 'expenses';

  setTab(tab: 'expenses' | 'maintenance') {
    this.tab = tab;
  }

  private sum(rows: any[], field: string): number {
    return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  }

  /** Totals for the property and dates currently selected */
  get totalExpenses(): number {
    return this.sum(this.expenseObject, 'amount');
  }

  get unpaidExpenses(): number {
    return this.sum(this.expenseObject, 'balance');
  }

  get openRequests(): number {
    return this.maintainanceObject.filter((request: any) => request.status !== 'resolved').length;
  }

  get maintenanceCost(): number {
    return this.sum(this.maintainanceObject, 'amount');
  }

  // ---------- Types ----------

  expenseCategories = EXPENSE_CATEGORIES;
  maintenanceCategories = MAINTENANCE_CATEGORIES;
  // '' shows every type; each tab keeps its own choice
  expenseCategory = '';
  maintenanceCategory = '';

  private option(options: CategoryOption[], value: string): CategoryOption {
    return options.find(option => option.value === value) ?? options[options.length - 1];
  }

  expenseType(value: string): CategoryOption {
    return this.option(EXPENSE_CATEGORIES, value);
  }

  maintenanceType(value: string): CategoryOption {
    return this.option(MAINTENANCE_CATEGORIES, value);
  }

  setExpenseCategory(value: string): void {
    this.expenseCategory = this.expenseCategory === value ? '' : value;
    this.filterDataByProperty();
  }

  /** What was spent on each type in the selected property and dates, largest first */
  expenseBreakdown: { option: CategoryOption; total: number }[] = [];

  private buildBreakdown(expenses: any[]): void {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      const key = expense.category || 'other';
      totals.set(key, (totals.get(key) ?? 0) + (Number(expense.amount) || 0));
    }
    this.expenseBreakdown = [...totals.entries()]
      .map(([value, total]) => ({ option: this.expenseType(value), total }))
      .sort((a, b) => b.total - a.total);
  }

  /** Colour of a payment chip, for both expenses and maintenance wording */
  paymentTone(status: string): string {
    const value = (status || '').toLowerCase();
    if (value.includes('partial')) return 'warning';
    if (value === 'paid' || value.includes('fully')) return 'success';
    if (value.includes('unpaid') || value.includes('not paid')) return 'error';
    return 'neutral';
  }

  paymentLabel(status: string): string {
    const labels: Record<string, string> = { paid: 'Paid', unpaid: 'Unpaid', partial: 'Partly paid' };
    return labels[status] ?? status ?? '—';
  }

  getCustomers() {
    this.customerService.getCustomers().subscribe({
      next: (data) => {
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
      category: ['', Validators.required],
      description: ['', Validators.required],
    });
  }

  openUpdateMaintanaceForm(): void {
    this.updateMaintanaceForm = this.fb.group({
      unit: ['', Validators.required],
      customer: ['', Validators.required],
      category: ['', Validators.required],
      description: ['', Validators.required],
    });
  }

  expenseSForm(): void {
    this.expenseForm = this.fb.group({
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    });
  }

  updateExpensesForm(): void {
    this.updateExpenseForm = this.fb.group({
      category: ['', Validators.required],
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: ['', [Validators.required, Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    });
  }

  expensePaymentsFormsInit() : void {  
    this.expensePaymentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      method: ['mpesa', Validators.required],
      reference: [''],
      notes: ['']
    });

  }

  maintanancePaymentsFormsInit() : void {  

    this.maintanancePaymentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      method: ['mpesa', Validators.required],
      reference: [''],
      notes: ['']
    });
  }

  onPropertyChange(propertyId: number) {
    if (!propertyId) return;

    this.selectedPropertyId = propertyId;

    if (this.selectedProperty) {
      this.selectedProperty.setValue(propertyId);
    }

    // Filter matching units
    this.filteredUnits = this.units.filter(
      u => u.property_id === propertyId || u.property === propertyId
    );

    // ✅ CRITICAL: Filter data after property change
    this.filterDataByProperty();
    
    this.cdr.detectChanges();
  }

  getExpenses() {
    this.expenseService.getExpenses().subscribe({
      next: (data) => {
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
      category: this.expenseForm.value.category,
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
    this.expenseId = element.id;
    this.updateExpenseForm.patchValue({
      property: element.property,
      category: element.category || 'other',
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
      category: this.updateExpenseForm.value.category,
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
      category: element.category || 'other',
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
      return;
    }

    // Filter expenses
    let filteredExpenses = this.allExpenses.filter(
      expense => expense.property === this.selectedPropertyId
    );

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

    // The breakdown covers every type, so it stays put while one type is picked
    this.buildBreakdown(filteredExpenses);
    if (this.expenseCategory) {
      filteredExpenses = filteredExpenses.filter(expense => (expense.category || 'other') === this.expenseCategory);
    }

    this.expenseObject = filteredExpenses;

    // Filter maintenance
    let filteredMaintenance = this.allMaintenance.filter(
      maintenance => parseInt(maintenance.property_id) === this.selectedPropertyId
    );

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

    if (this.maintenanceCategory) {
      filteredMaintenance = filteredMaintenance.filter(request => (request.category || 'other') === this.maintenanceCategory);
    }

    this.maintainanceObject = filteredMaintenance;

    // Update table data sources
    if (isPlatformBrowser(this.platformId)) {
      this.dataExpenseSource.data = this.expenseObject;
      this.dataMaintanceSource.data = this.maintainanceObject;
      if (this.expensePaginator) {
        this.dataExpenseSource.paginator = this.expensePaginator;
      }
      if (this.maintancePaginator) {
        this.dataMaintanceSource.paginator = this.maintancePaginator;
      }
      this.cdr.detectChanges();
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
      // References must be unique, so an empty one is sent as "none"
      reference: (this.expensePaymentForm.value.reference || '').trim() || null,
      notes: this.expensePaymentForm.value.notes,
      type:"OUT"
    };

    this.paymentService.makePayment(data).subscribe({
      next: (res) => {
        this.loadMakingPayments = false;
        this.showSuccess("Payment Made successfully");
        this.getExpenses()
        this.dialog.closeAll();
        this.expensePaymentForm.reset({ amount: '', method: 'mpesa', reference: '', notes: '' });
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
      // References must be unique, so an empty one is sent as "none"
      reference: (this.maintanancePaymentForm.value.reference || '').trim() || null,
      notes: this.maintanancePaymentForm.value.notes,
      type:"OUT"
    };

    this.paymentService.makePayment(data).subscribe({
      next: (res) => {
        this.loadMakingPayments = false;
        this.showSuccess("Payment Made successfully");
        this.getMaintanance()
        this.dialog.closeAll();
        this.maintanancePaymentForm.reset({ amount: '', method: 'mpesa', reference: '', notes: '' });
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