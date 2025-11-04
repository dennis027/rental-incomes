import { Component, OnInit, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { SharedImports } from '../../../shared-imports/imports';
import { ReceiptService } from '../../../services/receipts';
import { Router } from '@angular/router';

export interface Receipt {
  id: number;
  receipt_number: string;
  contract: number;
  contract_number: string;
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

  displayedColumns: string[] = [
    'receipt_number', 'contract_number', 'issue_date', 'monthly_rent',
    'electricity_bill', 'water_bill', 'service_charge', 'total_amount', 'actions'
  ];
  dataSource = new MatTableDataSource<Receipt>([]);
  receipts: Receipt[] = [];
  filteredReceipts: Receipt[] = [];
  availableMonths: MonthYear[] = [];
  selectedMonth = new FormControl<string>('');

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
    this.getReceipts();
    this.setupMonthFilter();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
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

  setupMonthFilter() {
    this.selectedMonth.valueChanges.subscribe(value => {
      this.filterReceiptsByMonth(value || '');
    });
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

  getAvailableMonths() {
    const monthsSet = new Set<string>();
    
    this.receipts.forEach(receipt => {
      const monthYear = this.extractMonthYearFromReceipt(receipt);
      if (monthYear) {
        monthsSet.add(monthYear);
      }
    });

    this.availableMonths = Array.from(monthsSet)
      .sort((a, b) => b.localeCompare(a)) // Sort descending (newest first)
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

    // Set default to most recent month
    if (this.availableMonths.length > 0) {
      this.selectedMonth.setValue(this.availableMonths[0].value, { emitEvent: false });
      this.filterReceiptsByMonth(this.availableMonths[0].value);
    }
  }

  filterReceiptsByMonth(monthYear: string) {
    if (!monthYear) {
      this.filteredReceipts = [...this.receipts];
    } else {
      this.filteredReceipts = this.receipts.filter(receipt => {
        const receiptMonthYear = this.extractMonthYearFromReceipt(receipt);
        return receiptMonthYear === monthYear;
      });
    }
    
    this.dataSource.data = this.filteredReceipts;
    
    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  getReceipts() {
    this.receiptService.getReceipts().subscribe({
      next: (res: Receipt[]) => {
        this.receipts = res;
        this.getAvailableMonths();
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
    console.log(this.addReceiptForm.value);
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

  const rawValue = this.generateMonthlyForm.value.month;
  let formattedMonthYear = '';

  // 🧠 Handle all possible inputs (Date, string, or number)
  if (typeof rawValue === 'string' && rawValue.includes('-')) {
    // Example: "2025-11" → "2025-11"
    const [year, month] = rawValue.split('-').map((v: string) => v.trim());
    formattedMonthYear = `${parseInt(year, 10)}-${parseInt(month, 10)}`;
  } else if (typeof rawValue === 'object' && rawValue instanceof Date) {
    // Example: Date object → "2025-11"
    const year = rawValue.getFullYear();
    const month = rawValue.getMonth() + 1;
    formattedMonthYear = `${year}-${month}`;
  } else if (typeof rawValue === 'number') {
    // Just a month number, fallback with current year
    const year = new Date().getFullYear();
    formattedMonthYear = `${year}-${rawValue}`;
  } else {
    this.showError('Invalid month format. Please use YYYY-MM.');
    this.loadGenerating = false;
    return;
  }

  const payload = { month: formattedMonthYear };
  console.log('✅ Final payload:', payload);

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
    },
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