import { Component, inject, AfterViewInit, ViewChild, OnInit, TemplateRef, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { SecureImagePipe } from '../../../shared/secure-image.pipe';
import { isPlatformBrowser } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { CustomersService } from '../../../services/customer';
import { SharedImports } from '../../../shared-imports/imports';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { BillingService } from '../../../services/billing';
import { environment } from '../../../../environments/environment';
import { A11yModule } from "@angular/cdk/a11y";

export interface CustomerObject {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email: string;
  id_number: string;
  id_photo_front?: string;
  id_photo_back?: string;
}

@Component({
  selector: 'app-rental-customers',
  standalone: true,
  imports: [SharedImports, A11yModule, SecureImagePipe],
  templateUrl: './rental-customers.html',
  styleUrl: './rental-customers.css',
})
export class RentalCustomers implements OnInit, AfterViewInit {

  apiUrl = environment.apiUrl;
  private snackBar = inject(MatSnackBar);
  private platformId = inject(PLATFORM_ID); // ✅ Added

  // ViewChild for dialog templates
  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
  @ViewChild('updateDialog') updateDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  @ViewChild('viewDialog') viewDialog!: TemplateRef<any>;

  loadAdding = false;
  loadUpdating = false;
  loadDeleting = false;

  customerForm!: FormGroup;
  updateCustomerForm!: FormGroup;
  selectedCustomerId: string | null = null;
  selectedCustomer: CustomerObject | null = null;

  // Image file storage
  selectedFrontImage: File | null = null;
  selectedBackImage: File | null = null;
  frontImagePreview: string | null = null;
  backImagePreview: string | null = null;

  // Update image storage
  updateFrontImage: File | null = null;
  updateBackImage: File | null = null;
  updateFrontImagePreview: string | null = null;
  updateBackImagePreview: string | null = null;

  customers: CustomerObject[] = [];
  displayedColumns: string[] = ['tenant', 'contact', 'unit_number', 'balance', 'actions'];
  dataSource = new MatTableDataSource<CustomerObject>([]);
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private customersService = inject(CustomersService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private billing = inject(BillingService);

  isLoading = true;
  error: string | null = null;
  searchText: string = '';

  constructor(private fb: FormBuilder) {
    this.updateCustomerForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      phone_number: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],
      email: ['', [Validators.required, Validators.email]],
      id_number: ['', [Validators.required, Validators.minLength(5)]],
      id_photo_front: [null],
      id_photo_back: [null],
    });
  }

  ngOnInit(): void {
    // Initialize forms first (can run on server)
    this.initializeForm();

    // ✅ CRITICAL: Only load data in browser
    if (isPlatformBrowser(this.platformId)) {

      // Verify token exists
      const token = localStorage.getItem('access_token');

      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      // Search in the top bar can open this page with a name already typed
      this.route.queryParamMap.subscribe(params => {
        this.searchText = params.get('q') ?? '';
        this.applyFilter();
      });

      this.loadCustomers();
    } else {
    }
  }

  ngAfterViewInit(): void {
    // ✅ Only set paginator in browser
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
      });
    }
  }

  initializeForm() {
    this.customerForm = this.fb.group({
      first_name: ['', [Validators.required, Validators.minLength(2)]],
      last_name: ['', [Validators.required, Validators.minLength(2)]],
      phone_number: ['', [Validators.required, Validators.pattern(/^[0-9]{10,15}$/)]],
      email: ['', [Validators.required, Validators.email]],
      id_number: ['', [Validators.required, Validators.minLength(5)]],
      id_photo_front: [null, Validators.required],
      id_photo_back: [null, Validators.required],
    });
  }

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

  loadCustomers(): void {
    this.isLoading = true;
    this.error = null;
    this.loadBalances();
    
    this.customersService.getCustomers().subscribe({
      next: (res) => {
        this.customers = res;
        this.dataSource.data = this.customers;
        this.isLoading = false;

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
        console.error('❌ Error loading customers:', err);
        this.error = 'Failed to load customers';
        this.isLoading = false;
        this.showError('Failed to load tenants.');

        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  ngAfterViewChecked() {
    // Ensure paginator is always set after view checks
    if (this.paginator && this.dataSource.paginator !== this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
  }

  tenantFilter: 'all' | 'owing' | 'unhoused' = 'all';

  /** What each tenant owes across their contracts, by tenant id. Filled from the arrears list. */
  private owed = new Map<number, number>();

  owes(customer: any): number {
    return this.owed.get(Number(customer.id)) ?? 0;
  }

  initials(customer: any): string {
    return `${customer.first_name?.[0] ?? ''}${customer.last_name?.[0] ?? ''}`.toUpperCase();
  }

  /** The figures on the cards above the table. */
  get tenantStats() {
    const housed = this.customers.filter((customer: any) => customer.unit_number).length;
    const owing = this.customers.filter(customer => this.owes(customer) > 0);
    return {
      total: this.customers.length,
      housed,
      unhoused: this.customers.length - housed,
      owing: owing.length,
      owed: owing.reduce((sum, customer) => sum + this.owes(customer), 0),
    };
  }

  loadBalances(): void {
    this.billing.arrears().subscribe({
      next: data => {
        this.owed.clear();
        for (const row of data.rows ?? []) {
          this.owed.set(row.customer_id, (this.owed.get(row.customer_id) ?? 0) + Number(row.outstanding));
        }
        this.cdr.markForCheck();
      },
      // Without the balances the page still lists the tenants
      error: () => {},
    });
  }

  setTenantFilter(filter: 'all' | 'owing' | 'unhoused') {
    this.tenantFilter = filter;
    this.applyFilter();
  }

  /** Apply the search text and the tab together */
  applyFilter() {
    this.dataSource.filterPredicate = (customer: any, filter: string) => {
      const { tab, term } = JSON.parse(filter);
      const inTab = tab === 'all' || (tab === 'owing' ? this.owes(customer) > 0 : !customer.unit_number);
      const text = `${customer.first_name} ${customer.last_name} ${customer.phone_number} ${customer.email ?? ''} ${customer.id_number} ${customer.unit_number ?? ''}`.toLowerCase();
      return inTab && (!term || text.includes(term));
    };
    this.dataSource.filter = JSON.stringify({ tab: this.tenantFilter, term: this.searchText.trim().toLowerCase() });
  }

  /** Handle front image selection for add form */
  onFrontImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.showError('Please select a valid image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.showError('Image size should not exceed 5MB');
        return;
      }

      this.selectedFrontImage = file;
      this.customerForm.patchValue({ id_photo_front: file });
      this.customerForm.get('id_photo_front')?.updateValueAndValidity();

      const reader = new FileReader();
      reader.onload = (e) => {
        this.frontImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  /** Handle back image selection for add form */
  onBackImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.showError('Please select a valid image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.showError('Image size should not exceed 5MB');
        return;
      }

      this.selectedBackImage = file;
      this.customerForm.patchValue({ id_photo_back: file });
      this.customerForm.get('id_photo_back')?.updateValueAndValidity();

      const reader = new FileReader();
      reader.onload = (e) => {
        this.backImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  /** Handle front image selection for update form */
  onUpdateFrontImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.showError('Please select a valid image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.showError('Image size should not exceed 5MB');
        return;
      }

      this.updateFrontImage = file;
      this.updateCustomerForm.patchValue({ id_photo_front: file });

      const reader = new FileReader();
      reader.onload = (e) => {
        this.updateFrontImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  /** Handle back image selection for update form */
  onUpdateBackImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      if (!file.type.startsWith('image/')) {
        this.showError('Please select a valid image file');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.showError('Image size should not exceed 5MB');
        return;
      }

      this.updateBackImage = file;
      this.updateCustomerForm.patchValue({ id_photo_back: file });

      const reader = new FileReader();
      reader.onload = (e) => {
        this.updateBackImagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  /** Remove front image preview */
  removeFrontImage() {
    this.selectedFrontImage = null;
    this.frontImagePreview = null;
    this.customerForm.patchValue({ id_photo_front: null });
    this.customerForm.get('id_photo_front')?.updateValueAndValidity();
  }

  /** Remove back image preview */
  removeBackImage() {
    this.selectedBackImage = null;
    this.backImagePreview = null;
    this.customerForm.patchValue({ id_photo_back: null });
    this.customerForm.get('id_photo_back')?.updateValueAndValidity();
  }

  /** Remove update front image preview */
  removeUpdateFrontImage() {
    this.updateFrontImage = null;
    this.updateFrontImagePreview = null;
    this.updateCustomerForm.patchValue({ id_photo_front: null });
  }

  /** Remove update back image preview */
  removeUpdateBackImage() {
    this.updateBackImage = null;
    this.updateBackImagePreview = null;
    this.updateCustomerForm.patchValue({ id_photo_back: null });
  }

  openAddCustomerDialog() {
    this.selectedFrontImage = null;
    this.selectedBackImage = null;
    this.frontImagePreview = null;
    this.backImagePreview = null;
    this.dialog.open(this.openAddDialog, { maxWidth: '700px' });
  }

  /** Add customer using FormData */
  addCustomer() {
    if (this.customerForm.invalid) {
      this.customerForm.markAllAsTouched();
      return;
    }

    if (!this.selectedFrontImage || !this.selectedBackImage) {
      this.showError('Please upload both front and back images of ID');
      return;
    }

    this.loadAdding = true;

    const formData = new FormData();
    const formValues = this.customerForm.value;

    // Append text fields
    Object.keys(formValues).forEach(key => {
      if (key !== 'id_photo_front' && key !== 'id_photo_back') {
        formData.append(key, formValues[key]);
      }
    });

    // Append images
    if (this.selectedFrontImage) formData.append('id_photo_front', this.selectedFrontImage);
    if (this.selectedBackImage) formData.append('id_photo_back', this.selectedBackImage);

    this.customersService.addCustomer(formData).subscribe({
      next: (res) => {
        this.loadAdding = false;

        // Reload customers AFTER Angular stabilizes
        setTimeout(() => {
          this.loadCustomers();
          this.customerForm.reset();
          this.selectedFrontImage = null;
          this.selectedBackImage = null;
          this.frontImagePreview = null;
          this.backImagePreview = null;

          this.dialog.closeAll();
          this.showSuccess('Tenant added successfully!');
          this.cdr.detectChanges();
        }, 0);
      },
      error: (err) => {
        console.error('❌ Error adding customer:', err);
        this.loadAdding = false;

        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } else if (err.error && typeof err.error === 'object') {
          // Extract the first available error message from the backend
          const firstKey = Object.keys(err.error)[0];
          const firstMessage = Array.isArray(err.error[firstKey])
            ? err.error[firstKey][0]
            : err.error[firstKey];

          this.showError(firstMessage);
          console.error('Validation error:', firstKey, firstMessage);
        } else {
          this.showError('Failed to add tenant. Please try again.');
        }

        setTimeout(() => this.cdr.detectChanges(), 0);
      }
    });
  }

  /** Opens dialog to view customer details */
  openStatement(customer: CustomerObject) {
    this.router.navigate(['/dashboard/statement'], { queryParams: { tenant: customer.id } });
  }

  openViewDialog(customer: CustomerObject) {
    this.selectedCustomer = customer;
    this.dialog.open(this.viewDialog, { maxWidth: '700px' });
  }

  /** Opens dialog and pre-fills data for update */
  openUpdateDialog(customer: CustomerObject) {
    this.selectedCustomerId = customer.id;
    this.updateFrontImage = null;
    this.updateBackImage = null;
    this.updateFrontImagePreview = null;
    this.updateBackImagePreview = null;
    
    this.selectedCustomer = customer;
    
    this.updateCustomerForm.patchValue({
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone_number: customer.phone_number,
      email: customer.email,
      id_number: customer.id_number,
    });
    this.dialog.open(this.updateDialog, { maxWidth: '700px' });
  }

  /** Update customer using FormData */
  updateCustomer() {
    if (!this.selectedCustomerId || this.updateCustomerForm.invalid) return;
    
    this.loadUpdating = true;

    const formData = new FormData();
    const formValues = this.updateCustomerForm.value;

    // Append normal fields
    Object.keys(formValues).forEach(key => {
      if (key !== 'id_photo_front' && key !== 'id_photo_back' && formValues[key] !== null) {
        formData.append(key, formValues[key]);
      }
    });

    // Append images (only if changed)
    if (this.updateFrontImage) formData.append('id_photo_front', this.updateFrontImage);
    if (this.updateBackImage) formData.append('id_photo_back', this.updateBackImage);

    this.customersService.updateCustomer(this.selectedCustomerId, formData).subscribe({
      next: (response) => {
        this.loadUpdating = false;

        // ✅ Only update paginator in browser
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            this.loadCustomers();
            this.updateCustomerForm.reset();
            this.updateFrontImage = null;
            this.updateBackImage = null;
            this.updateFrontImagePreview = null;
            this.updateBackImagePreview = null;

            this.dialog.closeAll();
            this.showSuccess('Tenant updated successfully!');
            this.cdr.detectChanges();
          }, 0);
        }
      },
      error: (err) => {
        console.error('❌ Error updating customer:', err);
        this.loadUpdating = false;
        this.showError('Failed to update tenant. Please try again.');

        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }

        setTimeout(() => this.cdr.detectChanges(), 0);
      },
    });
  }

  openDeleteDialog(customer: CustomerObject) {
    this.selectedCustomerId = customer.id;
    this.dialog.open(this.deleteDialog);
  }

  confirmDelete() {
    if (!this.selectedCustomerId) return;

    this.loadDeleting = true;

    this.customersService.deleteCustomer(this.selectedCustomerId).subscribe({
      next: (response) => {
        this.loadDeleting = false;
        this.dialog.closeAll();
        this.showSuccess('Tenant deleted successfully!');
        this.loadCustomers();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error deleting customer:', err);
        this.loadDeleting = false;
        this.showError('Failed to delete tenant. Please try again.');

        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      },
    });
  }
}