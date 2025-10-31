import { Component, OnInit, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SharedImports } from '../../../shared-imports/imports';
import { PaymentService } from '../../../services/payments';
import { Router } from '@angular/router';

export interface Payment {
  id: number;
  amount: number;
  payment_date: string;
  method: string;
  reference: string;
  notes: string;
  contract: number;
}

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './payments.html',
  styleUrl: './payments.css'
})
export class Payments implements OnInit, AfterViewInit {
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private PaymentsService = inject(PaymentService);

  displayedColumns: string[] = ['amount', 'payment_date', 'method', 'reference', 'notes', 'contract', 'actions'];
  dataSource = new MatTableDataSource<Payment>([]);
  payments: Payment[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('addPaymentDialog') addPaymentDialog!: TemplateRef<any>;

  addPaymentForm!: FormGroup;
  loadAdding = false;

  ngOnInit() {
    this.initializeForm();
    this.getPayments();
        this.loadAdding = false;
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  initializeForm() {
    this.addPaymentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      payment_date: ['', Validators.required],
      method: ['mpesa', Validators.required],
      reference: ['', Validators.required],
      notes: [''],
      contract: ['', Validators.required]
    });
  }

  getPayments() {
    this.PaymentsService.getPayments().subscribe({
      next: (res: Payment[]) => {
        this.payments = res;
        this.dataSource.data = this.payments;
        setTimeout(() => {
          this.dataSource.paginator = this.paginator;
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
        console.error('❌ Error fetching payments:', err);
      }
    });
  }

  openAddPaymentDialog() {
    this.dialog.open(this.addPaymentDialog);
  }

  addPayment() {
    if (this.addPaymentForm.invalid) {
      this.addPaymentForm.markAllAsTouched();
      return;
    }

    const newPayment = this.addPaymentForm.value;
    this.loadAdding = true;

    this.PaymentsService.makePayment(newPayment).subscribe({
      next: (res) => {
        this.loadAdding = false;
        this.dialog.closeAll();
        this.showSuccess('Payment added successfully!');
        this.getPayments();
        this.cdr.detectChanges();
        this.addPaymentForm.reset({ method: 'mpesa' });
      },
      error: (err) => {
        this.loadAdding = false;
        this.cdr.detectChanges();
        this.showError('Failed to add payment. Please try again.');
        console.error('❌ Error adding payment:', err);
      }
    });
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
