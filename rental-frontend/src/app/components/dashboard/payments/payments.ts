import { Component, OnInit, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SharedImports } from '../../../shared-imports/imports';
import { PaymentService } from '../../../services/payments';
import { Router } from '@angular/router';
import { PropertiesService } from '../../../services/properties';

export interface Payment {
  id: number;
  unit_id: number;
  unit_number: string;
  property_id: number;
  property_name: string;
  amount: string;
  payment_date: string;
  method: string;
  reference: string;
  notes: string;
  created_at: string;
  receipt: number;
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
  private propertyService = inject(PropertiesService);

  displayedColumns: string[] = ['amount', 'payment_date', 'method', 'reference', 'unit_number', 'notes', 'receipt', 'actions'];
  dataSource = new MatTableDataSource<Payment>([]);
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('addPaymentDialog') addPaymentDialog!: TemplateRef<any>;

  addPaymentForm!: FormGroup;
  loadAdding = false;

  properties: any[] = [];
  selectedProperty = new FormControl('');

  ngOnInit() {
    this.initializeForm();
    this.loadAdding = false;
    this.getProperties();
  }

  getProperties() {
    this.propertyService.getProperties().subscribe(
      (res) => {
        this.properties = res;
        if (this.properties.length > 0) {
          // Set first property as default
          this.selectedProperty.setValue(this.properties[0].id.toString());
          this.getPayments();
        }
      },
      (err) => {
        console.error('Error loading properties:', err);
      }
    );
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
        this.filterPaymentsByProperty();
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

  filterPaymentsByProperty() {
    const propertyId = this.selectedProperty.value;
    
    if (propertyId) {
      this.filteredPayments = this.payments.filter(
        payment => payment.property_id.toString() === propertyId
      );
    } else {
      this.filteredPayments = this.payments;
    }

    this.dataSource.data = this.filteredPayments;
    
    setTimeout(() => {
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    });
    
    this.cdr.detectChanges();
  }

  getPropertyName(propertyId: string): string {
    const property = this.properties.find(p => p.id.toString() === propertyId);
    return property ? property.name : 'All Properties';
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