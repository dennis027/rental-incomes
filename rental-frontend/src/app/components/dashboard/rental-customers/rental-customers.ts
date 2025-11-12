import { Component, inject, AfterViewInit, ViewChild, OnInit, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { CustomersService } from '../../../services/customer';
import { SharedImports } from '../../../shared-imports/imports';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
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
  imports: [SharedImports, A11yModule],
  templateUrl: './rental-customers.html',
  styleUrl: './rental-customers.css',
})
export class RentalCustomers implements OnInit, AfterViewInit {

  apiUrl = environment.apiUrl;
  private snackBar = inject(MatSnackBar);

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
  displayedColumns: string[] = [
    'first_name',
    'last_name',
    'phone_number',
    'email',
    'id_number',
    'actions',
  ];
  dataSource = new MatTableDataSource<CustomerObject>([]);
  
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  private customersService = inject(CustomersService);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  

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
    this.loadCustomers();
    this.initializeForm();
  }

ngAfterViewInit(): void {
  // Defer paginator binding until the view and @if DOM are stable
  setTimeout(() => {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
  });
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
  this.customersService.getCustomers().subscribe({
    next: (res) => {
      this.customers = res;
      this.dataSource.data = this.customers;
      this.isLoading = false;
      console.log('✅ Customers loaded:', this.customers);

      // Safely rebind paginator when data changes
      setTimeout(() => {
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
        this.cdr.detectChanges();
      });
    },
    error: (err) => {
      console.error('❌ Error fetching customers:', err);
      this.error = 'Failed to load customers';
      this.isLoading = false;

      if (err.status === 401) {
        this.router.navigate(['/login']);
        this.dialog.closeAll();
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

  /** Apply search filter */
  applyFilter() {
    const filterValue = this.searchText.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  

  /** Handle front image selection for add form */
  onFrontImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.showError('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showError('Image size should not exceed 5MB');
        return;
      }

      this.selectedFrontImage = file;
      this.customerForm.patchValue({ id_photo_front: file });
      this.customerForm.get('id_photo_front')?.updateValueAndValidity();

      // Create preview
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
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.showError('Please select a valid image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showError('Image size should not exceed 5MB');
        return;
      }

      this.selectedBackImage = file;
      this.customerForm.patchValue({ id_photo_back: file });
      this.customerForm.get('id_photo_back')?.updateValueAndValidity();

      // Create preview
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
    // Reset image selections when opening dialog
    this.selectedFrontImage = null;
    this.selectedBackImage = null;
    this.frontImagePreview = null;
    this.backImagePreview = null;
    this.dialog.open(this.openAddDialog,{ maxWidth: '700px' });
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
        this.showSuccess('Customer added successfully!');
        this.cdr.detectChanges();
      }, 0);
    },
      error: (err) => {
        this.loadAdding = false;

        if (err.status === 0) {
          console.warn('🌐 Network error while adding customer.');
          this.showError('Network error. Please check your internet connection.');
        } 
        else if (err.status === 401) {
          this.dialog.closeAll();
          this.router.navigate(['/login']);
        } 
        else if (err.error && typeof err.error === 'object') {
          // Extract the first available error message from the backend
          const firstKey = Object.keys(err.error)[0];
          const firstMessage = Array.isArray(err.error[firstKey])
            ? err.error[firstKey][0]
            : err.error[firstKey];

          this.showError(firstMessage);
          console.error('❌ Validation error:', firstKey, firstMessage);
        } 
        else {
          this.showError('Failed to add customer. Please try again.');
          console.error('❌ Error adding customer:', err);
        }

        setTimeout(() => this.cdr.detectChanges(), 0);
      }


  });
}


  /** Opens dialog to view customer details */
  openViewDialog(customer: CustomerObject) {
    this.selectedCustomer = customer;
    this.dialog.open(this.viewDialog,{ maxWidth: '700px' });
  }

  /** Opens dialog and pre-fills data for update */
  openUpdateDialog(customer: CustomerObject) {
    this.selectedCustomerId = customer.id;
    this.updateFrontImage = null;
    this.updateBackImage = null;
    this.updateFrontImagePreview = null;
    this.updateBackImagePreview = null;
    
    // Store existing image URLs for display
    this.selectedCustomer = customer;
    
    this.updateCustomerForm.patchValue({
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone_number: customer.phone_number,
      email: customer.email,
      id_number: customer.id_number,
    });
    this.dialog.open(this.updateDialog,{ maxWidth: '700px' });
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

        // ✅ Safely refresh UI after Angular stabilizes
        setTimeout(() => {
          this.loadCustomers(); // Reload data
          this.updateCustomerForm.reset();
          this.updateFrontImage = null;
          this.updateBackImage = null;
          this.updateFrontImagePreview = null;
          this.updateBackImagePreview = null;

          this.dialog.closeAll();
          this.showSuccess('Customer updated successfully!');

          // ✅ Trigger a manual detection after DOM update
          this.cdr.detectChanges();
        }, 0);
      },
      error: (error) => {
        this.loadUpdating = false;
        this.showError('Failed to update customer. Please try again.');

        // 🩵 Force detection just in case
        setTimeout(() => this.cdr.detectChanges(), 0);

        if (error.status === 0) {
          console.warn('🌐 Network error while updating customer.');
        } else if (error.status === 401) {
          this.dialog.closeAll();
          this.router.navigate(['/login']);
        } else {
          console.error('❌ Update failed:', error);
        }
      },
    });
  }

  

  openDeleteDialog(customer: CustomerObject) {
    this.selectedCustomerId = customer.id;
    this.dialog.open(this.deleteDialog);
  }

confirmDelete() {
  this.loadDeleting = true;
  if (!this.selectedCustomerId) return;

  this.customersService.deleteCustomer(this.selectedCustomerId).subscribe({
    next: (response) => {
      this.loadDeleting = false;
      this.loadCustomers();
      this.dialog.closeAll();
      this.showSuccess('Customer deleted successfully!');
      this.cdr.detectChanges(); // ✅ forces a clean recheck
    },
    error: (error) => {
      this.loadDeleting = false;
      this.showError('Failed to delete customer. Please try again.');
      if (error.status === 401) {
        this.router.navigate(['/login']);
        this.dialog.closeAll();
      } else {
        console.error('❌ Delete failed:', error);
      }
    },
  });
}
}