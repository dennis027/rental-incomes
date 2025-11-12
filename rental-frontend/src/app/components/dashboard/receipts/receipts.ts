import { Component, OnInit, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SharedImports } from '../../../shared-imports/imports';
import { ReceiptService } from '../../../services/receipts';
import { PropertiesService } from '../../../services/properties';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

export interface Receipt {
  id: number;
  receipt_number: string;
  contract: number;
  contract_number: string;
  property: string;
  property_id: string;
  unit: string;
  customer: string;
  issue_date: string;
  monthly_rent: string;
  rental_deposit: string;
  electricity_deposit: string;
  electricity_bill: string;
  water_deposit: string;
  water_bill: string;
  service_charge: string;
  security_charge: string;
  previous_balance: string;
  other_charges: string;
  previous_water_reading: string;
  current_water_reading: string;
  total_amount: string;
}

export interface Property {
  id: number;
  name: string;
  address: string;
  description: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface MonthYear {
  year: number;
  month: number;
  display: string;
  value: string;
}

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './receipts.html',
  styleUrl: './receipts.css'
})
export class Receipts implements OnInit, AfterViewInit {
  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private receiptService = inject(ReceiptService);
  private propertyService = inject(PropertiesService); // Add this

  displayedColumns: string[] = [
    'receipt_number', 'contract_number', 'property', 'unit', 'customer', 'issue_date', 
    'monthly_rent', 'electricity_bill', 'water_bill', 'service_charge', 'total_amount', 'actions'
  ];
  dataSource = new MatTableDataSource<Receipt>([]);
  receipts: Receipt[] = [];
  filteredReceipts: Receipt[] = [];
  properties: Property[] = [];
  availableMonths: MonthYear[] = [];
  selectedMonth = new FormControl<string>('');
  selectedProperty = new FormControl<string>('');

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('addReceiptDialog') addReceiptDialog!: TemplateRef<any>;
  @ViewChild('updateReceiptDialog') updateReceiptDialog!: TemplateRef<any>;
  @ViewChild('generateMonthlyDialog') generateMonthlyDialog!: TemplateRef<any>;

  addReceiptForm!: FormGroup;
  updateReceiptForm!: FormGroup;
  generateMonthlyForm!: FormGroup;
  loadAdding = false;
  loadGenerating = false;
  selectedReceiptId: number | null = null;

  ngOnInit() {
    this.initializeForms();
    this.loadProperties()
    this.loadData();
    this.setupFilters();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

loadProperties() {
  this.propertyService.getProperties().subscribe(
    (res) => {
      this.properties = res;

      if (this.properties && this.properties.length > 0) {
        this.selectedProperty.setValue(String(this.properties[0].id)); // or the whole object if your <mat-select> binds to object
      }
    },
    (err) => {
      console.error('Failed to load properties', err);
    }
  );
}

  initializeForms() {
    this.addReceiptForm = this.fb.group({
      contract: ['', Validators.required],
      monthly_rent: ['', [Validators.required, Validators.min(0)]],
      rental_deposit: ['0.00', Validators.min(0)],
      electricity_deposit: ['0.00', Validators.min(0)],
      electricity_bill: ['', [Validators.required, Validators.min(0)]],
      water_deposit: ['0.00', Validators.min(0)],
      water_bill: ['', [Validators.required, Validators.min(0)]],
      service_charge: ['0.00', Validators.min(0)],
      security_charge: ['0.00', Validators.min(0)],
      previous_balance: ['0.00'],
      other_charges: ['0.00', Validators.min(0)],
      previous_water_reading: ['', [Validators.required, Validators.min(0)]],
      current_water_reading: ['', [Validators.required, Validators.min(0)]]
    });

    this.updateReceiptForm = this.fb.group({
      contract: ['', Validators.required],
      monthly_rent: ['', [Validators.required, Validators.min(0)]],
      rental_deposit: ['', Validators.min(0)],
      electricity_deposit: ['', Validators.min(0)],
      electricity_bill: ['', [Validators.required, Validators.min(0)]],
      water_deposit: ['', Validators.min(0)],
      water_bill: ['', [Validators.required, Validators.min(0)]],
      service_charge: ['', [Validators.required, Validators.min(0)]],
      security_charge: ['', [Validators.required, Validators.min(0)]],
      previous_balance: ['', Validators.required],
      other_charges: ['', Validators.min(0)],
      previous_water_reading: ['', Validators.min(0)],
      current_water_reading: ['', [Validators.required, Validators.min(0)]]
    });

    this.generateMonthlyForm = this.fb.group({
      year: ['', [Validators.required, Validators.min(2000), Validators.max(2100)]],
      month: ['', [Validators.required, Validators.min(1), Validators.max(12)]]
    });
  }

loadData() {
  forkJoin({
    receipts: this.receiptService.getReceipts(),
    properties: this.propertyService.getProperties()
  }).subscribe({
    next: ({ receipts, properties }) => {
      this.receipts = receipts;
      this.properties = properties.filter((p: Property) => p.is_active);
      this.updateAvailableMonths();
      
      // Apply filters after initial load
      this.applyFilters();
      
      setTimeout(() => {
        this.dataSource.paginator = this.paginator;
      });
      this.cdr.detectChanges();
    },
    error: (err) => {
      if (err.status === 401) this.router.navigate(['/login']);
      console.error('❌ Error loading data:', err);
    }
  });
}
  setupFilters() {
    this.selectedMonth.valueChanges.subscribe(() => {
      this.applyFilters();
    });

    this.selectedProperty.valueChanges.subscribe(() => {
      this.applyFilters();
    });
  }


applyFilters() {
  let filtered = [...this.receipts];

  // Filter by property - FIX: Convert both to strings for comparison
  const propertyId = this.selectedProperty.value;
  if (propertyId) {
    filtered = filtered.filter(receipt => 
      String(receipt.property_id) === String(propertyId)
    );
  }

  // Filter by month
  const monthYear = this.selectedMonth.value;
  if (monthYear) {
    filtered = filtered.filter(receipt => {
      const receiptMonthYear = this.extractMonthYearFromReceipt(receipt);
      return receiptMonthYear === monthYear;
    });
  }

  this.filteredReceipts = filtered;
  this.dataSource.data = filtered;

  if (this.paginator) {
    this.paginator.firstPage();
  }
}
  extractMonthYearFromReceipt(receipt: Receipt): string {
    // Extract from receipt_number: RCT-18-202307-1 -> 202307
    const match = receipt.receipt_number.match(/\d{6}/);
    return match ? match[0] : '';
  }

  getSelectedMonthDisplay(): string {
    const selected = this.availableMonths.find(m => m.value === this.selectedMonth.value);
    return selected ? selected.display : '';
  }

  getPropertyName(propertyId: string): string {
    const property = this.properties.find(p => p.id.toString() === propertyId);
    return property ? property.name : 'Unknown';
  }

updateAvailableMonths(previouslySelected?: any) {
  const monthsSet = new Set<string>();

  this.receipts.forEach(receipt => {
    const monthYear = this.extractMonthYearFromReceipt(receipt);
    if (monthYear) {
      monthsSet.add(monthYear);
    }
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

  // Only set default if no previous value exists or it's invalid
  if (!previouslySelected || !this.availableMonths.some(m => m.value === previouslySelected)) {
    if (this.availableMonths.length > 0) {
      this.selectedMonth.setValue(this.availableMonths[0].value, { emitEvent: false });
    }
  }
}


// Also update getReceipts to handle initial load better
getReceipts() {
  // Store current filter selections before reload
  const prevSelectedMonth = this.selectedMonth.value;
  const prevSelectedProperty = this.selectedProperty.value;

  this.receiptService.getReceipts().subscribe({
    next: (res: Receipt[]) => {
      this.receipts = res;

      // Refresh available months but keep the selected one if it still exists
      this.updateAvailableMonths(prevSelectedMonth);

      // Reapply filters using preserved selections
      // Only set if there was a previous value
      if (prevSelectedMonth) {
        this.selectedMonth.setValue(prevSelectedMonth, { emitEvent: false });
      }
      if (prevSelectedProperty) {
        this.selectedProperty.setValue(prevSelectedProperty, { emitEvent: false });
      }
      
      this.applyFilters();

      setTimeout(() => {
        this.dataSource.paginator = this.paginator;
      });
      this.cdr.detectChanges();
    },
    error: (err) => {
      if (err.status === 401) this.router.navigate(['/login']);
      console.error('❌ Error fetching receipts:', err);
    }
  });
}



  openAddReceiptDialog() {
    this.dialog.open(this.addReceiptDialog);
  }

  openGenerateMonthlyDialog() {
    const now = new Date();
    this.generateMonthlyForm.patchValue({
      year: now.getFullYear(),
      month: now.getMonth() + 1
    });
    this.dialog.open(this.generateMonthlyDialog);
  }

  openUpdateDialog(receipt: Receipt) {
    this.selectedReceiptId = receipt.id;
    this.updateReceiptForm.patchValue(receipt);
    this.dialog.open(this.updateReceiptDialog);
  }

  addReceipt() {
    if (this.addReceiptForm.invalid) {
      this.addReceiptForm.markAllAsTouched();
      return;
    }

    this.loadAdding = true;
    const newReceipt = this.addReceiptForm.value;

    this.receiptService.addReceipt(newReceipt).subscribe({
      next: () => {
        this.loadAdding = false;
        this.dialog.closeAll();
        this.showSuccess('Receipt added successfully!');
        this.getReceipts();
        this.addReceiptForm.reset();
      },
      error: (err) => {
        this.loadAdding = false;
        this.showError('Failed to add receipt. Please try again.');
        console.error('❌ Error adding receipt:', err);
      }
    });
  }

  generateMonthlyReceipts() {
    if (this.generateMonthlyForm.invalid) {
      this.generateMonthlyForm.markAllAsTouched();
      return;
    }

    this.loadGenerating = true;
    const { year, month } = this.generateMonthlyForm.value;
    const formattedMonthYear = `${year}-${month}`;
    const payload = {
       month: formattedMonthYear,
       property_id: this.selectedProperty.value
      };

    this.receiptService.addMonthlyReceipts(payload).subscribe({
      next: (response) => {
        this.loadGenerating = false;
        this.dialog.closeAll();
        this.showSuccess(`Successfully generated ${response.count || 'monthly'} receipts!`);
        this.getReceipts();
        this.generateMonthlyForm.reset();
      },
      error: (err) => {
        this.loadGenerating = false;
        this.showError('Failed to generate monthly receipts. Please try again.');
        console.error('❌ Error generating monthly receipts:', err);
      }
    });
  }

  updateReceipt() {
    if (this.updateReceiptForm.invalid || !this.selectedReceiptId) return;

    const updatedData = this.updateReceiptForm.value;
    this.receiptService.updateReceipt(this.selectedReceiptId, updatedData).subscribe({
      next: () => {
        this.dialog.closeAll();
        this.showSuccess('Receipt updated successfully!');
        this.getReceipts();
      },
      error: (err) => {
        this.showError('Failed to update receipt.');
        console.error('❌ Error updating receipt:', err);
      }
    });
  }

  deleteReceipt(id: number) {
    if (!confirm('Are you sure you want to delete this receipt?')) return;

    this.receiptService.deleteReceipt(id).subscribe({
      next: () => {
        this.showSuccess('Receipt deleted successfully!');
        this.getReceipts();
      },
      error: (err) => {
        this.showError('Failed to delete receipt.');
        console.error('❌ Error deleting receipt:', err);
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