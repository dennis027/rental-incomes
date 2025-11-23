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
  private platformId = inject(PLATFORM_ID); // ✅ Add this

  today = new Date();

  //expenses dialogs
  @ViewChild('addExpeDial') addExpeDial!: TemplateRef<any>;
  @ViewChild('updateExpenseDial') updateExpenseDial!: TemplateRef<any>;
  @ViewChild('deleteExpensDial') deleteExpensDial!: TemplateRef<any>;

  // maintanance dialogs
  @ViewChild('addMaintanceDial') addMaintanceDial!: TemplateRef<any>;
  @ViewChild('deleteMaintanceDial') deleteMaintanceDial!: TemplateRef<any>;

  expenseForm!: FormGroup;
  updateExpenseForm!: FormGroup;
  maintanaceForm!: FormGroup;
  updateMaintanaceForm!: FormGroup;
  properties: any[] = [];
  isSubmitting = false;
  isUpdateExpenseSubmit = false;
  isLoading = false; // ✅ Add loading state
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

  expenseObject: expensesObject[] = [];
  displayedExpensesColumns: string[] = ['description', 'amount', 'expense_date', 'actions'];
  dataExpenseSource = new MatTableDataSource<expensesObject>(this.expenseObject);

  maintainanceObject: maintanceObject[] = [];
  displayedMaintanceColumns: string[] = ['unit_number', 'description', 'status', 'reported_date', 'actions'];
  dataMaintanceSource = new MatTableDataSource<maintanceObject>(this.maintainanceObject);

  @ViewChild('expensesPaginator') expensePaginator!: MatPaginator;
  @ViewChild('maintancePaginator') maintancePaginator!: MatPaginator;

  ngAfterViewInit() {
    // ✅ Only set paginator in browser
    if (isPlatformBrowser(this.platformId)) {
      this.dataExpenseSource.paginator = this.expensePaginator;
      this.dataMaintanceSource.paginator = this.maintancePaginator;
    }
  }

  ngOnInit(): void {
    // Initialize forms first (can run on server)
    this.expenseSForm();
    this.updateExpensesForm();
    this.openMaintanaceForm();
    this.openUpdateMaintanaceForm();

    // ✅ CRITICAL: Only load data in browser
    if (isPlatformBrowser(this.platformId)) {
      this.getExpenses();
      this.getMaintanance();
      this.getProperties();
      this.getUnits();
      this.getCustomers();

      // ✅ Automatically select the first property after data loads
      setTimeout(() => {
        if (this.properties?.length && !this.selectedProperty?.value) {
          const firstPropertyId = this.properties[0].id;
          this.onPropertyChange(firstPropertyId);
        }
      }, 300);
    }
  }

  getCustomers() {
    this.customerService.getCustomers().subscribe({
      next: (data) => {
        console.log('Customers data:', data);
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

  getProperties() {
    this.propertyService.getProperties().subscribe({
      next: (data) => {
        console.log('Properties data:', data);
        this.properties = data;

        // Set default to first property
        if (this.properties.length > 0 && !this.selectedPropertyId) {
          this.selectedPropertyId = this.properties[0].id;
          this.filterDataByProperty();
        }
      },
      error: (error) => {
        this.showError('Failed to load properties.');
        console.error('Error fetching properties:', error);
        if (error.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  getUnits() {
    this.unitsService.getUnits().subscribe({
      next: (data) => {
        console.log('Units data:', data);
        this.units = data;
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

  onPropertyChange(propertyId?: number) {
    const selectedPropertyId = propertyId || this.properties[0]?.id;

    if (!selectedPropertyId) return;

    if (this.selectedProperty) {
      this.selectedProperty.setValue(selectedPropertyId);
    }

    setTimeout(() => {
      this.filteredUnits = this.units.filter(u => u.property === selectedPropertyId);
    }, 100);
  }

  getExpenses() {
    this.expenseService.getExpenses().subscribe({
      next: (data) => {
        console.log('Expenses data:', data);
        this.allExpenses = data;
        this.filterDataByProperty();
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
        console.log('Maintenance data:', data);
        this.allMaintenance = data;
        this.filterDataByProperty();
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
      },
      error: (err) => {
        console.error('Error submitting expense:', err);
        this.showError('Failed to add expense ❌');
        this.isSubmitting = false;
      }
    });
  }

  openAAddExpenseDialog() {
    let dialogRef = this.dialog.open(this.addExpeDial, {
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

  openUpdateDial() {
    let dialogRef = this.dialog.open(this.updateExpenseDial, {
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
      },
      error: (err) => {
        console.error('Error updating expense:', err);
        this.showError('Failed to update expense ❌');
        this.isUpdateExpenseSubmit = false;
      }
    });
  }

  openDeleteDialog(element: any) {
    this.expenseId = element.id;
    this.expenseName = element.description;
    let dialogRef = this.dialog.open(this.deleteExpensDial);
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          this.expenseService.deleteExpense(this.expenseId).subscribe({
            next: (res) => {
              this.showSuccess(`Expense ${this.expenseName} deleted successfully ✅`);
              this.getExpenses();
            },
            error: (err) => {
              console.error('Error deleting expense:', err);
              this.showError('Failed to delete expense ❌');
            }
          });
        } else if (result === 'no') {

        }
      }
    });
  }

  openMaintanaceDialog(element: any) {
    console.log('Open maintenance dialog for:', element);
  }

  openDeleteMainanceDialog(element: any) {
    this.maintananceId = element.id;
    this.maintanaceName = element.description;
    let dialogRef = this.dialog.open(this.deleteMaintanceDial);
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          this.maintanaceService.deleteMaintenanceRequest(this.maintananceId).subscribe({
            next: (res) => {
              this.showSuccess(`Maintanance ${this.maintanaceName} deleted successfully ✅`);
              this.getMaintanance();
            },
            error: (err) => {
              console.error('Error deleting maintanance:', err);
              this.showError('Failed to delete maintanance ❌');
            }
          });
        } else if (result === 'no') {

        }
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
      },
      error: (err) => {
        console.error('Error submitting maintenance request:', err);
        this.showError('Failed to add maintenance request ❌');
        this.isSubmitting = false;
      }
    });
  }

  openAddMaintanaceDialog() {
    let dialogRef = this.dialog.open(this.addMaintanceDial, {
      maxWidth: '780px',
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {

        } else if (result === 'no') {

        }
      }
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
    if (!this.selectedPropertyId) return;

    let filteredExpenses = this.allExpenses.filter(
      expense => expense.property === this.selectedPropertyId
    );

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

    let filteredMaintenance = this.allMaintenance.filter(
      maintenance => parseInt(maintenance.property_id) === this.selectedPropertyId
    );

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

    // ✅ Only update paginator in browser
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.dataExpenseSource.data = this.expenseObject;
        this.dataExpenseSource.paginator = this.expensePaginator;

        this.dataMaintanceSource.data = this.maintainanceObject;
        this.dataMaintanceSource.paginator = this.maintancePaginator;
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
}