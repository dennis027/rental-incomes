import {
  Component,AfterViewInit, ViewChild,inject} from '@angular/core';
import { SharedImports } from '../../../shared-imports/imports';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ExpensesService } from '../../../services/expense-service';
import { MaintenanceService } from '../../../services/maintanance-service';
import {} from '@angular/core';
import {MatPaginator, MatPaginatorModule} from '@angular/material/paginator';
import {MatTableDataSource, MatTableModule} from '@angular/material/table';

export interface expensesObject {
  description: string;
  amount: string;
  expense_date: string;
}


export interface maintanceObject {
  unit: string;
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
export class Expensemaintanace {

    private snackBar = inject(MatSnackBar);
    private dialog = inject(MatDialog);
    private router = inject(Router);
    private expenseService = inject(ExpensesService);
    private maintanaceService = inject(MaintenanceService);




  
  expenseObject: expensesObject[] = [];
  displayedExpensesColumns: string[] = ['description', 'amount', 'expense_date'];
  dataExpenseSource = new MatTableDataSource<expensesObject>(this.expenseObject);


  maintainanceObject: maintanceObject[] = [];
  displayedMaintanceColumns: string[] = ['unit', 'description', 'status', 'reported_date'];
  dataMaintanceSource = new MatTableDataSource<maintanceObject>(this.maintainanceObject);



  // @ViewChild(MatPaginator) paginator!: MatPaginator;

  @ViewChild('expensesPaginator') expensePaginator!: MatPaginator;
   @ViewChild('maintancePaginator') maintancePaginator!: MatPaginator;

  ngAfterViewInit() {
    this.dataExpenseSource.paginator = this.expensePaginator;
    this.dataMaintanceSource.paginator = this.maintancePaginator;

  }

   ngOnInit(): void {
      this.getExpenses();
      this.getMaintanance();
   }

   getExpenses() {
    // Implementation for fetching expenses
    this.expenseService.getExpenses().subscribe(
      {
        next: (data) => {
          console.log('Expenses data:', data);
          this.expenseObject = data;
          this.dataExpenseSource.data = this.expenseObject;
          this.dataExpenseSource.paginator = this.expensePaginator;
        },
        error: (error) => {
          this.showError('Failed to load expenses.');
          console.error('Error fetching expenses:', error);
          if (error.status === 401) {
            this.router.navigate(['/login']);
          }

        }
      }
    )
   }

   getMaintanance() {
    // Implementation for fetching maintenance records
    this.maintanaceService.getMaintenanceRequests().subscribe(
      {
        next: (data) => {
          console.log('Maintenance data:', data);
          this.maintainanceObject = data;
          this.dataMaintanceSource.data = this.maintainanceObject;
          this.dataMaintanceSource.paginator = this.maintancePaginator;
        },
        error: (error) => {
          this.showError('Failed to load maintenance records.');
          console.error('Error fetching maintenance records:', error);
          if (error.status === 401) {
            this.router.navigate(['/login']);   
          }
        }
      }
    ) 
   }

    /** 🔹 Show Success Snackbar */

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
