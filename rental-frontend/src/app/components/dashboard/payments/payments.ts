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
  unit_name: string;
  property_id: number;
  property_name: string;
  customer_name: string;
  amount: string;
  payment_date: string;
  method: string;
  method_display: string;
  type: 'IN' | 'OUT';
  reference: string;
  notes: string;
  created_at: string;
  receipt_number: string;
}

export interface MonthYear {
  year: number;
  month: number;
  display: string;
  value: string;
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

  displayedColumns: string[] = ['customer_name', 'unit_name', 'amount', 'payment_date', 'method', 'reference', 'receipt_number', 'actions'];
  incomingColumns: string[] = ['customer_name', 'unit_name', 'amount', 'payment_date', 'method', 'reference', 'receipt_number', 'actions'];
  outgoingColumns: string[] = ['notes','amount', 'payment_date', 'method', 'reference',  'actions'];
  
  dataSource = new MatTableDataSource<Payment>([]);
  incomingDataSource = new MatTableDataSource<Payment>([]);
  outgoingDataSource = new MatTableDataSource<Payment>([]);
  
  payments: Payment[] = [];
  filteredPayments: Payment[] = [];
  incomingPayments: Payment[] = [];
  outgoingPayments: Payment[] = [];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('incomingPaginator') incomingPaginator!: MatPaginator;
  @ViewChild('outgoingPaginator') outgoingPaginator!: MatPaginator;
  @ViewChild('addPaymentDialog') addPaymentDialog!: TemplateRef<any>;

  addPaymentForm!: FormGroup;
  loadAdding = false;
  isLoading = false;

  properties: any[] = [];
  selectedProperty = new FormControl('');
  availableMonths: MonthYear[] = [];
  selectedMonth = new FormControl<string>('');

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
      this.setupFilters();
    } else {
      console.log('⚠️ Payments component running on server, skipping API calls');
    }
  }

  setupFilters() {
    this.selectedMonth.valueChanges.subscribe(() => {
      this.filterPaymentsByProperty();
    });

    this.selectedProperty.valueChanges.subscribe(() => {
      this.filterPaymentsByProperty();
    });
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
    if (isPlatformBrowser(this.platformId)) {
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
      if (this.incomingPaginator) {
        this.incomingDataSource.paginator = this.incomingPaginator;
      }
      if (this.outgoingPaginator) {
        this.outgoingDataSource.paginator = this.outgoingPaginator;
      }
    }
  }

  initializeForm() {
    this.addPaymentForm = this.fb.group({
      amount: ['', [Validators.required, Validators.min(1)]],
      payment_date: ['', Validators.required],
      method: ['mpesa', Validators.required],
      type: ['IN', Validators.required],
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
        this.updateAvailableMonths();
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

  updateAvailableMonths(previouslySelected?: any) {
    const monthsSet = new Set<string>();

    this.payments.forEach(payment => {
      const date = new Date(payment.payment_date);
      const monthYear = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthsSet.add(monthYear);
    });

    this.availableMonths = Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a))
      .map(monthYear => {
        const year = parseInt(monthYear.substring(0, 4));
        const month = parseInt(monthYear.substring(4, 6));
        const date = new Date(year, month - 1);
        return {
          year,
          month,
          display: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
          value: monthYear
        };
      });

    if (!previouslySelected || !this.availableMonths.some(m => m.value === previouslySelected)) {
      if (this.availableMonths.length > 0) {
        this.selectedMonth.setValue(this.availableMonths[0].value, { emitEvent: false });
      }
    }
  }

  getSelectedMonthDisplay(): string {
    const selected = this.availableMonths.find(m => m.value === this.selectedMonth.value);
    return selected ? selected.display : '';
  }

  extractMonthYearFromPayment(payment: Payment): string {
    const date = new Date(payment.payment_date);
    return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  filterPaymentsByProperty() {
    const propertyId = this.selectedProperty.value;
    
    console.log('🔍 Filtering payments by property:', propertyId);
    console.log('📊 Total payments:', this.payments.length);
    
    let filtered = [...this.payments];

    if (propertyId) {
      filtered = filtered.filter(payment => {
        if (payment.property_id === null || payment.property_id === undefined) {
          console.warn('⚠️ Payment missing property_id:', payment);
          return false;
        }
        return payment.property_id.toString() === propertyId;
      });
      
      console.log('✅ Filtered by property:', filtered.length);
    }

    // Filter by month
    const monthYear = this.selectedMonth.value;
    if (monthYear) {
      filtered = filtered.filter(payment => {
        const paymentMonthYear = this.extractMonthYearFromPayment(payment);
        return paymentMonthYear === monthYear;
      });
      console.log('✅ Filtered by month:', filtered.length);
    }

    this.filteredPayments = filtered;

    // Separate into incoming and outgoing
    this.incomingPayments = filtered.filter(p => p.type === 'IN');
    this.outgoingPayments = filtered.filter(p => p.type === 'OUT');

    this.dataSource.data = this.filteredPayments;
    this.incomingDataSource.data = this.incomingPayments;
    this.outgoingDataSource.data = this.outgoingPayments;
    
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
        if (this.incomingPaginator) {
          this.incomingDataSource.paginator = this.incomingPaginator;
        }
        if (this.outgoingPaginator) {
          this.outgoingDataSource.paginator = this.outgoingPaginator;
        }
      });
    }
    
    this.cdr.detectChanges();
  }

  getPropertyName(propertyId: string): string {
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
        this.addPaymentForm.reset({ method: 'mpesa', type: 'IN' });
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