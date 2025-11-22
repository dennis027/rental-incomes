import { Component, OnInit, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  private platformId = inject(PLATFORM_ID);

  displayedColumns: string[] = ['amount', 'payment_date', 'method', 'reference', 'unit_number', 'notes', 'receipt', 'actions'];
  dataSource = new MatTableDataSource<Payment>([]);
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('addPaymentDialog') addPaymentDialog!: TemplateRef<any>;

  addPaymentForm!: FormGroup;
  loadAdding = false;
  isLoading = false;

  properties: any[] = [];
  selectedProperty = new FormControl('');

  ngOnInit() {
    this.initializeForm();
    this.loadAdding = false;
    this.isLoading = false;
    
    if (isPlatformBrowser(this.platformId)) {
      console.log('🔍 Payments component running in browser');
      
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token status:', token ? 'Token exists' : '❌ NO TOKEN!');
      
      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }
      
      this.getProperties();
    } else {
      console.log('⚠️ Payments component running on server, skipping API calls');
    }
  }

  getProperties() {
    console.log('📡 Loading properties...');
    this.isLoading = true;
    
    this.propertyService.getProperties().subscribe({
      next: (res) => {
        console.log('✅ Properties loaded:', res);
        this.properties = res;
        if (this.properties.length > 0) {
          this.selectedProperty.setValue(this.properties[0].id.toString());
          this.getPayments();
        } else {
          this.isLoading = false;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);
        this.isLoading = false;
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      }
    });
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId) && this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
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
    console.log('📡 Loading payments...');

    this.PaymentsService.getPayments().subscribe({
      next: (res: Payment[]) => {
        console.log('✅ Payments loaded:', res);
        this.payments = res;
        this.filterPaymentsByProperty();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Error fetching payments:', err);
        this.isLoading = false;

        if (err.status === 401) {
          console.log('🔒 Unauthorized → redirect to login');
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          this.showError('Failed to load payments');
        }
      }
    });
  }

  filterPaymentsByProperty() {
    const propertyId = this.selectedProperty.value;
    
    console.log('🔍 Filtering payments by property:', propertyId);
    console.log('📊 Total payments:', this.payments.length);
    
    if (propertyId) {
      // ✅ Fixed: Added null/undefined checks
      this.filteredPayments = this.payments.filter(payment => {
        // Check if property_id exists and is not null/undefined
        if (payment.property_id === null || payment.property_id === undefined) {
          console.warn('⚠️ Payment missing property_id:', payment);
          return false;
        }
        return payment.property_id.toString() === propertyId;
      });
      
      console.log('✅ Filtered payments:', this.filteredPayments.length);
    } else {
      this.filteredPayments = this.payments;
    }

    this.dataSource.data = this.filteredPayments;
    
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
      });
    }
    
    this.cdr.detectChanges();
  }

  getPropertyName(propertyId: string): string {
    // ✅ Added null check
    if (!propertyId) return 'All Properties';
    
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

    console.log('📤 Submitting payment:', newPayment);

    this.PaymentsService.makePayment(newPayment).subscribe({
      next: (res) => {
        console.log('✅ Payment added successfully:', res);
        this.loadAdding = false;
        this.dialog.closeAll();
        this.showSuccess('Payment added successfully!');
        this.getPayments();
        this.addPaymentForm.reset({ method: 'mpesa' });
      },
      error: (err) => {
        console.error('❌ Error adding payment:', err);
        this.loadAdding = false;
        this.cdr.detectChanges();
        
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else {
          this.showError('Failed to add payment. Please try again.');
        }
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