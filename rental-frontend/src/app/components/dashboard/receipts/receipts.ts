import { PropertyContext } from '../../../services/property-context';
import { Component, OnInit, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef, PLATFORM_ID, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { SharedImports } from '../../../shared-imports/imports';
import { ReceiptService } from '../../../services/receipts';
import { PropertiesService } from '../../../services/properties';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { RentDocument, RentDocumentData, invoiceNumber } from '../rent-document/rent-document';
import { openRecordPayment } from '../record-payment/record-payment-dialog';
import { SystemParametersServices } from '../../../services/system-parameters-services';

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
  current_electricity_reading: string;
  previous_electricity_reading: string;
  total_amount: string;
  balance: string;
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

export interface UnitReading {
  unit_id: number;
  unit_number: string;
  contract_id: number;
  customer_name: string;
  previous_balance: number;
  previous_water_reading: number;
  current_water_reading: number;
  previous_electricity_reading: number;
  current_electricity_reading: number;
}

@Component({
  selector: 'app-receipts',
  standalone: true,
  imports: [SharedImports, RentDocument],
  templateUrl: './receipts.html',
  styleUrl: './receipts.css'
})
export class Receipts implements OnInit, AfterViewInit {

  // The property chosen in the top bar; this page follows it
  private propertyContext = inject(PropertyContext);
  private propertySync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => this.followProperty(propertyId));
  });

  private followProperty(propertyId: number | null): void {
    if (propertyId === null || this.properties.length === 0 || this.selectedProperty.value === String(propertyId)) {
      return;
    }
    // The page already reacts to this control changing
    this.selectedProperty.setValue(String(propertyId));
  }

  private dialog = inject(MatDialog);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private receiptService = inject(ReceiptService);
  private propertyService = inject(PropertiesService);
  private systemParametersSerice = inject(SystemParametersServices);
  private platformId = inject(PLATFORM_ID);

  toNumber(value: any): number {
  return Number(value) || 0;
}

  displayedColumns: string[] = [
    'receipt_number', 'unit', 'issue_date',
    'monthly_rent', 'electricity_bill', 'water_bill', 'service_charge', 'total_amount', 'balance', 'status', 'actions'
  ];

  /** Totals for the receipts currently listed */
  private sumOf(field: string): number {
    return this.dataSource.data.reduce((total, receipt: any) => total + (Number(receipt[field]) || 0), 0);
  }

  // Charges only: the balance brought forward was already billed on an earlier invoice
  get totalBilled(): number {
    return this.sumOf('charges');
  }

  get totalCollected(): number {
    return this.sumOf('amount_paid');
  }

  // Each tenant's balance sits on their latest invoice, so nothing is counted twice
  get totalOutstanding(): number {
    return this.sumOf('balance_due');
  }

  get unpaidCount(): number {
    return this.dataSource.data.filter((receipt: any) => Number(receipt.balance_due) > 0).length;
  }
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
  @ViewChild('deleteReceiptDial') deleteReceiptDial!: TemplateRef<any>;
  @ViewChild('generateMonthlyDialog') generateMonthlyDialog!: TemplateRef<any>;
  @ViewChild('meterReadingsDialog') meterReadingsDialog!: TemplateRef<any>;
  @ViewChild('receiptPreviewDialog') receiptPreviewDialog!: TemplateRef<any>;

  addReceiptForm!: FormGroup;
  updateReceiptForm!: FormGroup;
  generateMonthlyForm!: FormGroup;
  meterReadingsForm!: FormGroup;
  loadAdding = false;
  loadGenerating = false;
  loadingUnits = false;
  selectedReceiptId: number | null = null;
  currentMonth: any;
  currentYear: any;

  receipt: Receipt | null = null;
  systemParametersObject: any = null;
  
  // New properties for meter readings
  unitReadings: UnitReading[] = [];
  selectedMonthForGeneration: any = null;

  ngOnInit() {
    const today = new Date();
    this.currentMonth = today.toLocaleString('en-US', { month: 'long' });
    this.currentYear = today.getFullYear();

    this.initializeForms();

    if (isPlatformBrowser(this.platformId)) {

      const token = localStorage.getItem('access_token');

      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      this.loadProperties();
      this.loadData();
      this.setupFilters();
    } else {
    }
  }

  getSystemParameters() {
    const propertyId = this.selectedProperty.value;
    
    this.systemParametersSerice.getSystemParams(propertyId ? Number(propertyId) : this.properties[0].id).subscribe({
      next: (res) => {
        this.systemParametersObject = res;
      },
      error: (err) => {
        console.error('❌ Error loading system parameters:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.dataSource.paginator = this.paginator;
    }
  }

  loadProperties() {
    
    this.propertyService.getProperties().subscribe({
      next: (res) => {
        this.properties = res;
        if (this.properties && this.properties.length > 0) {
          this.selectedProperty.setValue(String(this.propertyContext.resolve(this.properties)));
        }
        this.getSystemParameters();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
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

    this.meterReadingsForm = this.fb.group({
      readings: this.fb.array([])
    });
  }

  get readingsArray(): FormArray {
    return this.meterReadingsForm.get('readings') as FormArray;
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
        this.applyFilters();

        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
          });
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading data:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
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

    const propertyId = this.selectedProperty.value;
    this.getSystemParameters();
    if (propertyId) {
      filtered = filtered.filter(receipt =>
        String(receipt.property_id) === String(propertyId)
      );
    }

    const monthYear = this.selectedMonth.value;
    if (monthYear) {
      filtered = filtered.filter(receipt => {
        const receiptMonthYear = this.extractMonthYearFromReceipt(receipt);
        return receiptMonthYear === monthYear;
      });
    }

    // Newest first: the invoice a tenant pays is their latest one
    filtered.sort((a: any, b: any) => new Date(b.issue_date).getTime() - new Date(a.issue_date).getTime() || b.id - a.id);

    this.filteredReceipts = filtered;
    this.dataSource.data = filtered;

    if (this.paginator) {
      this.paginator.firstPage();
    }
  }

  extractMonthYearFromReceipt(receipt: Receipt): string {
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

    if (!previouslySelected || !this.availableMonths.some(m => m.value === previouslySelected)) {
      if (this.availableMonths.length > 0) {
        this.selectedMonth.setValue(this.availableMonths[0].value, { emitEvent: false });
      }
    }
  }

  getReceipts() {
    const prevSelectedMonth = this.selectedMonth.value;
    const prevSelectedProperty = this.selectedProperty.value;

    this.receiptService.getReceipts().subscribe({
      next: (res: Receipt[]) => {
        this.receipts = res;
        this.updateAvailableMonths(prevSelectedMonth);

        if (prevSelectedMonth) {
          this.selectedMonth.setValue(prevSelectedMonth, { emitEvent: false });
        }
        if (prevSelectedProperty) {
          this.selectedProperty.setValue(prevSelectedProperty, { emitEvent: false });
        }

        this.applyFilters();

        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            this.dataSource.paginator = this.paginator;
          });
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error fetching receipts:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
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

  // NEW: Check if meter readings are needed before generation
  checkAndProceedToGeneration() {
    if (this.generateMonthlyForm.invalid) {
      this.generateMonthlyForm.markAllAsTouched();
      return;
    }

    if (!this.systemParametersObject) {
      this.showError('System parameters not loaded. Please try again.');
      return;
    }

    const { year, month } = this.generateMonthlyForm.value;
    this.selectedMonthForGeneration = { year, month };

    // Check if we need to collect meter readings
    const needsWaterReadings = this.systemParametersObject.has_water_bill;
    const needsElectricityReadings = this.systemParametersObject.has_electricity_bill;

    if (needsWaterReadings || needsElectricityReadings) {
      // Load active units for the property and show meter readings dialog
      this.loadActiveUnitsForReadings();
    } else {
      // Proceed directly to generation without readings
      this.generateMonthlyReceipts();
    }
  }

// NEW: Load active units that need meter readings
loadActiveUnitsForReadings() {
  const propertyId = this.selectedProperty.value;

  if (propertyId === null) {
    this.showError('Please select a property before loading units.');
    return;
  }

  this.loadingUnits = true;

  // GET /api/units/active/?property_id={propertyId}
  this.receiptService.getActiveUnitsForProperty(propertyId).subscribe({
    next: (response: any) => {
      this.loadingUnits = false;

      const units = response.active_units || [];

      // Prepare unit readings array
      this.unitReadings = units.map((unit: any) => ({
        unit_id: unit.id,
        unit_number: unit.unit_number,
        contract_id: unit.contract_id,
        customer_name: unit.customer_name,
        previous_balance: unit.previous_balance || 0,
        previous_water_reading: unit.water_meter_reading || 0,
        current_water_reading: unit.water_meter_reading || 0,
        previous_electricity_reading: unit.electricity_meter_reading || 0,
        current_electricity_reading: unit.electricity_meter_reading || 0,
        service_charge: unit.service_charge || 0,
        security_charge: unit.security_charge || 0,
        other_charges: unit.other_charges || 0
      }));

      // Build form array
      this.buildMeterReadingsForm();

      // Close first dialog and open meter readings dialog
      this.dialog.closeAll();
      this.dialog.open(this.meterReadingsDialog, {
        width: '900px',
        maxHeight: '90vh',
        disableClose: true
      });
    },
    error: (err) => {
      console.error('❌ Error loading units:', err);
      this.loadingUnits = false;
      this.showError('Failed to load units for meter readings.');
      if (err.status === 401) {
        this.router.navigate(['/login']);
      }
    }
  });
}

  // NEW: Build form array for meter readings
  buildMeterReadingsForm() {
    this.readingsArray.clear();
    
    this.unitReadings.forEach(unit => {
      const group = this.fb.group({
        unit_id: [unit.unit_id],
        unit_number: [unit.unit_number],
        contract_id: [unit.contract_id],
        customer_name: [unit.customer_name],
        previous_balance: [unit.previous_balance || 0],
        previous_water_reading: [unit.previous_water_reading],
        current_water_reading: [
          unit.current_water_reading,
          this.systemParametersObject.has_water_bill ? [Validators.required, Validators.min(unit.previous_water_reading)] : []
        ],
        previous_electricity_reading: [unit.previous_electricity_reading],
        current_electricity_reading: [
          unit.current_electricity_reading,
          this.systemParametersObject.has_electricity_bill ? [Validators.required, Validators.min(unit.previous_electricity_reading)] : []
        ],
        service_charge: [
          this.systemParametersObject.has_service_charge ? this.systemParametersObject.default_service_charge : 0,
          this.systemParametersObject.has_service_charge ? [Validators.required, Validators.min(0)] : []
        ],
        security_charge: [
          this.systemParametersObject.has_security_charge ? this.systemParametersObject.default_security_charge : 0,
          this.systemParametersObject.has_security_charge ? [Validators.required, Validators.min(0)] : []
        ],
        other_charges: [
          this.systemParametersObject.has_other_charges ? this.systemParametersObject.default_other_charge : 0,
          this.systemParametersObject.has_other_charges ? [Validators.required, Validators.min(0)] : []
        ]
      });
      
      this.readingsArray.push(group);
    });
  }

  // NEW: Calculate water bill for a unit
  calculateWaterBill(index: number): number {
    const reading = this.readingsArray.at(index).value;
    const units = reading.current_water_reading - reading.previous_water_reading;
    return units * (this.systemParametersObject.water_unit_cost || 0);
  }

  // NEW: Calculate electricity bill for a unit
  calculateElectricityBill(index: number): number {
    const reading = this.readingsArray.at(index).value;
    const units = reading.current_electricity_reading - reading.previous_electricity_reading;
    return units * (this.systemParametersObject.electicity_unit_cost || 0);
  }

  // NEW: Submit meter readings and generate receipts
submitMeterReadingsAndGenerate() {
  if (this.meterReadingsForm.invalid) {
    this.meterReadingsForm.markAllAsTouched();
    this.showError('Please fill in all required meter readings.');
    return;
  }

  const propertyId = this.selectedProperty.value;
  if (propertyId === null) {
    this.showError('Please select a property before generating receipts.');
    return;
  }

  this.loadGenerating = true;
  const { year, month } = this.selectedMonthForGeneration;
  const formattedMonthYear = `${year}-${month}`;

  const payload = {
    month: formattedMonthYear,
    property_id: propertyId, // guaranteed not null now
    meter_readings: this.readingsArray.value.map((reading: any) => ({
      unit_id: reading.unit_id,
      contract_id: reading.contract_id,
      previous_balance: reading.previous_balance || 0,
      current_water_reading: reading.current_water_reading,
      current_electricity_reading: reading.current_electricity_reading,
      water_bill: this.systemParametersObject.has_water_bill
        ? this.calculateWaterBill(this.readingsArray.value.indexOf(reading))
        : 0,
      electricity_bill: this.systemParametersObject.has_electricity_bill
        ? this.calculateElectricityBill(this.readingsArray.value.indexOf(reading))
        : 0,
      service_charge: this.systemParametersObject.has_service_charge
        ? reading.service_charge
        : 0,
      security_charge: this.systemParametersObject.has_security_charge
        ? reading.security_charge
        : 0,
      other_charges: this.systemParametersObject.has_other_charges
        ? reading.other_charges
        : 0,
    }))
  };

  this.receiptService.addMonthlyReceiptsWithReadings(payload).subscribe({
    next: (response) => {
      this.loadGenerating = false;
      this.dialog.closeAll();
      this.showSuccess(`Successfully generated ${response.count || 'monthly'} receipts!`);
      this.getReceipts();
      this.generateMonthlyForm.reset();
      this.meterReadingsForm.reset();
    },
    error: (err) => {
      console.error('❌ Error generating monthly receipts:', err);
      this.loadGenerating = false;
      this.showError('Failed to generate monthly receipts. Please try again.');
      if (err.status === 401) {
        this.router.navigate(['/login']);
        this.dialog.closeAll();
      }
    }
  });
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
        console.error('❌ Error adding receipt:', err);
        this.loadAdding = false;
        this.showError('Failed to add receipt. Please try again.');
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
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
        console.error('❌ Error generating monthly receipts:', err);
        this.loadGenerating = false;
        this.showError('Failed to generate monthly receipts. Please try again.');
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
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
        console.error('❌ Error updating receipt:', err);
        this.showError('Failed to update receipt.');
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      }
    });
  }

  deleteReceipt(id: number) {
    let dialogRef = this.dialog.open(this.deleteReceiptDial);
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          this.receiptService.deleteReceipt(id).subscribe({
            next: () => {
              this.showSuccess('Invoice deleted');
              this.getReceipts();
            },
            error: (err) => {
              console.error('❌ Error deleting receipt:', err);
              this.showError(err.error?.error || 'The invoice could not be deleted.');
              if (err.status === 401) {
                this.router.navigate(['/login']);
              }
            }
          });
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

  // The invoice shown in the preview dialog
  documentData: RentDocumentData | null = null;

  /** Invoices are stored with an RCT- number; they are shown as INV- */
  inv(stored: string): string {
    return invoiceNumber(stored);
  }

  generateReceipt(receipt: Receipt) {
    this.receipt = receipt;

    const data = receipt as any;
    const amount = (value: any) => parseFloat(value) || 0;
    const reading = (from: any, to: any) => `Meter reading ${amount(from)} to ${amount(to)}`;

    const lines = [
      { label: 'Monthly Rent', amount: amount(receipt.monthly_rent) },
      { label: 'Rental Deposit', amount: amount(receipt.rental_deposit) },
      { label: 'Electricity Deposit', amount: amount(receipt.electricity_deposit) },
      { label: 'Electricity Bill', amount: amount(receipt.electricity_bill),
        detail: reading(receipt.previous_electricity_reading, receipt.current_electricity_reading) },
      { label: 'Water Deposit', amount: amount(receipt.water_deposit) },
      { label: 'Water Bill', amount: amount(receipt.water_bill),
        detail: reading(receipt.previous_water_reading, receipt.current_water_reading) },
      { label: 'Service Charge', amount: amount(receipt.service_charge) },
      { label: 'Security Charge', amount: amount(receipt.security_charge) },
      amount(receipt.previous_balance) < 0
        ? { label: 'Credit From Earlier Payments', amount: amount(receipt.previous_balance) }
        : { label: 'Balance Brought Forward', amount: amount(receipt.previous_balance) },
      { label: 'Other Charges', amount: amount(receipt.other_charges) },
      { label: 'Late Payment Penalty', amount: amount(data.late_penalty), detail: 'Earlier invoices were unpaid after the grace period' }
    ].filter(item => item.amount !== 0);

    // Payment is due once the grace period in the property's settings has passed
    const issued = new Date(receipt.issue_date);
    const graceDays = Number(this.systemParametersObject?.grace_period_days);
    const dueDate = Number.isFinite(graceDays) ? new Date(issued.getTime() + graceDays * 86400000) : null;

    this.documentData = {
      kind: 'invoice',
      number: invoiceNumber(receipt.receipt_number),
      date: receipt.issue_date,
      dueDate,
      status: data.status ?? 'unpaid',
      property: { name: receipt.property, address: data.property_address },
      tenant: { name: data.customer_name || receipt.customer, phone: data.customer_phone },
      unit: receipt.unit,
      contractNumber: receipt.contract_number,
      lines,
      total: amount(receipt.total_amount),
      paid: amount(data.amount_paid),
      balance: amount(receipt.balance),
    };
  }

  openPaymentDial(invoice: any) {
    openRecordPayment(this.dialog, {
      invoiceId: invoice.id,
      tenant: invoice.customer_name || invoice.customer,
      unit: invoice.unit,
      owes: parseFloat(invoice.balance_due) || 0,
    }).subscribe(recorded => {
      if (recorded) {
        this.getReceipts();
      }
    });
  }

  openReceiptReview() {
    const dialogRef = this.dialog.open(this.receiptPreviewDialog, {
      width: '800px',
      // Material caps dialogs at 560px unless told otherwise, which cut the sheet off
      maxWidth: '95vw',
      height: 'auto',
      panelClass: 'receipt-preview-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          // Handle yes
        } else if (result === 'no') {
          // Handle no
        }
      }
    });
  }
}
