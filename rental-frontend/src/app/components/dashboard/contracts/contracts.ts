import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  TemplateRef,
  ViewChild,
  ChangeDetectorRef,
} from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { SharedImports } from '../../../shared-imports/imports';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { ContractsService } from '../../../services/contract-service';
import { CustomersService } from '../../../services/customer';
import { UnitsService } from '../../../services/units';
import { PropertiesService } from '../../../services/properties';


export interface ContractObject {
  id: number;
  customer_name: string;
  customer_phone: string;
  unit_info: string;
  contract_number: string | null;
  start_date: string;
  end_date: string;
  rent_amount: string;
  deposit_amount: string;
  payment_frequency: string;
  is_active: boolean;
  customer: number;
  unit: number;
}

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [SharedImports],
  templateUrl: './contracts.html',
  styleUrl: './contracts.css',
})
export class Contracts implements OnInit, AfterViewInit {


  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private contractsService = inject(ContractsService);
  private customersService = inject(CustomersService);
  private unitsService = inject(UnitsService);
  private propertyService = inject(PropertiesService);
  private fb = inject(FormBuilder);

  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
  @ViewChild('editDialog') editDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  @ViewChild('cancelDialog') cancelDialog!: TemplateRef<any>;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  contracts: ContractObject[] = [];
  dataSource = new MatTableDataSource<ContractObject>([]);
  displayedColumns: string[] = [
    'contract_number',
    'customer_name',
    // 'customer_phone',
    'unit_info',
    'start_date',
    // 'end_date',
    'rent_amount',
    'deposit_amount',
    'payment_frequency',
    'is_active',
    'actions',
  ];



  contractForm!: FormGroup;
  updateContractForm!: FormGroup;
  selectedContractId: number | null = null;
  isEditMode = false;

  isLoading:boolean = false;
  loadAdding = false;
  loadUpdating = false;
  loadDeleting = false;
  loadCancelling = false;
  error: string | null = null;
  
  customers: any[] = [];
  units: any[] = [];
  properties: any[] = [];
  filteredUnits: any[] = [];
  

  searchText = '';

  formatToYMD(dateString: string): string {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

  ngOnInit(): void {

    this.initForm();
    this.upContractForm();
    this.loadCustomers();
    this.loadUnits();
    this.loadProperties();
    this.loadContracts();

      this.isLoading = false;
  }

  ngAfterViewInit(): void {
    // Assign paginator after view is fully initialized
    setTimeout(() => {
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    
    });
  }

  initForm() {
    this.contractForm = this.fb.group({
      customer: ['', Validators.required],
      property: ['', Validators.required],
      unit: ['', Validators.required],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      rent_amount: ['', Validators.required],
      deposit_amount: ['', Validators.required],
      payment_frequency: ['', Validators.required],
    });
  }

  upContractForm() {
    this.updateContractForm = this.fb.group({
      customer: ['', Validators.required],
      unit: ['', Validators.required],
      start_date: ['', Validators.required],
      end_date: ['', Validators.required],
      rent_amount: ['', Validators.required],
      deposit_amount: ['', Validators.required],
      payment_frequency: ['', Validators.required],
    });
  }

  /** 🔹 Fetch all customers */

  loadCustomers() {
    this.customersService.getCustomers().subscribe({
      next: (res) => {
        this.customers = res;
        console.log('✅ Customers loaded:', this.customers);
      },
      error: (err) => {
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  loadUnits() {
    this.unitsService.getUnits().subscribe({
      next: (res) => {
        this.units = res;
        console.log('✅ Units loaded:', this.units);
      },
      error: (err) => {
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  loadProperties() {
      this.propertyService.getProperties().subscribe({
      next: (res) => {
        this.properties = res;
        console.log('✅ Properties loaded:', this.properties);
      },
      error: (err) => {
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

    onPropertyChange(propertyId: number) {
    // 🟢 Filter units based on the selected property

    console.log('Selected Property ID:', propertyId);
    setTimeout(() => {
    this.filteredUnits = this.units.filter(u => u.property === propertyId);
    this.cdr.detectChanges();
    }, 100);
    console.log('All Units:', this.filteredUnits);

    // Optionally reset unit selection
    this.contractForm.patchValue({ unit: '' });
  }

  // onUnitChange(unitId: number) {
  //   console.log('Selected Unit ID:', unitId);
  // }

  /** 🔹 Fetch all contracts */
 loadContracts() {
  this.isLoading = true;
  this.contractsService.getContracts().subscribe({
    next: (res) => {
      setTimeout(() => {
        this.contracts = res;
        this.dataSource.data = this.contracts;
        this.isLoading = false;

        console.log('✅ Contracts loaded:', this.contracts);
        if (this.paginator) {
          this.dataSource.paginator = this.paginator;
        }
      });
    },
    error: (err) => {
      console.error('❌ Error loading contracts:', err);
      setTimeout(() => {
        this.isLoading = false;
        this.error = 'Failed to load contracts.';
      });
      if (err.status === 401) this.router.navigate(['/login']);
    },
  });
}


  /** 🔹 Open Add Contract Dialog */
  openAddDialogForm() {
    this.isEditMode = false;
    this.contractForm.reset();
    this.dialog.open(this.openAddDialog, {
      width: '600px',
      disableClose: true
    });
  }

  /** 🔹 Open Edit Contract Dialog */
  openEditDialog(contract: ContractObject) {
    this.isEditMode = true;
    this.selectedContractId = contract.id;

    // Populate form with existing data
    this.updateContractForm.patchValue({
      customer: contract.customer,
      unit: contract.unit,
      start_date: contract.start_date,
      end_date: contract.end_date,
      rent_amount: contract.rent_amount,
      deposit_amount: contract.deposit_amount,
      payment_frequency: contract.payment_frequency,
    });

    this.dialog.open(this.editDialog, {
      width: '600px',
      disableClose: true
    });
  }

  /** 🔹 Add contract */
  addContract() {
    if (this.contractForm.invalid) {
      this.contractForm.markAllAsTouched();
      return;
    }

    this.loadAdding = true;
    const formValues = this.contractForm.value;

    const payload = {
      customer: formValues.customer,
      unit: formValues.unit,
      start_date: this.formatToYMD(formValues.start_date),
      end_date: this.formatToYMD(formValues.end_date),
      rent_amount: formValues.rent_amount,
      deposit_amount: formValues.deposit_amount,
      payment_frequency: formValues.payment_frequency,
    };

    this.contractsService.addContract(payload).subscribe({
      next: () => {
        this.loadAdding = false;
        this.showSuccess('Contract added successfully!');
        this.dialog.closeAll();
        this.contractForm.reset();
        this.loadContracts();
      },
      error: (err) => {
        this.loadAdding = false;
        console.error('❌ Error adding contract:', err);
        this.showError('Failed to add contract.');
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } 
      },
    });
  }

  /** 🔹 Update contract */
  updateContract() {
    if (this.updateContractForm.invalid) {
      this.updateContractForm.markAllAsTouched();
      return;
    }

    if (!this.selectedContractId) return;

    this.loadUpdating = true;
    const formValues = this.updateContractForm.value;

    const payload = {
      customer: formValues.customer,
      unit: formValues.unit,
      start_date: formValues.start_date,
      end_date: formValues.end_date,
      rent_amount: formValues.rent_amount,
      deposit_amount: formValues.deposit_amount,
      payment_frequency: formValues.payment_frequency,
    };

    this.contractsService.updateContract(this.selectedContractId, payload).subscribe({
      next: () => {
        this.loadUpdating = false;
        this.showSuccess('Contract updated successfully!');
        this.dialog.closeAll();
        this.updateContractForm.reset();
        this.loadContracts();
      },
      error: (err) => {
        this.loadUpdating = false;
        console.error('❌ Error updating contract:', err);
        this.showError('Failed to update contract.');
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        } 
      },
    });
  }

  /** 🔹 Delete contract */
  openDeleteDialog(contract: ContractObject) {
    this.selectedContractId = contract.id;
    this.dialog.open(this.deleteDialog);
  }

  confirmDelete() {
    if (!this.selectedContractId) return;
    this.loadDeleting = true;

    this.contractsService.deleteContract(this.selectedContractId).subscribe({
      next: () => {
        this.loadDeleting = false;
        this.showSuccess('Contract deleted successfully!');
        this.dialog.closeAll();
        this.loadContracts();
      },
      error: (err) => {
        this.loadDeleting = false;
        console.error('❌ Error deleting contract:', err);
        this.showError('Failed to delete contract.');
        if (err.status === 401) this.router.navigate(['/login']);
      },
    });
  }

  /** 🔹 Cancel contract */
  openCancelDialog(contract: ContractObject) {
    this.selectedContractId = contract.id;
    this.dialog.open(this.cancelDialog, {
      width: '500px',
      disableClose: true
    });
  }

confirmCancel() {
  if (!this.selectedContractId) return;
  this.loadCancelling = true;

  const payload = {
    is_active: false,
    cancellation_date: new Date().toISOString().split('T')[0]
  };

  this.contractsService.cancelContract(this.selectedContractId, payload).subscribe({
    next: () => {
   
      this.showSuccess('Contract cancelled successfully!');
      this.dialog.closeAll();

      // 👇 Wait until Angular stabilizes, then reload contracts
      setTimeout(() => {
        this.loadContracts();
      });
      
    },
    error: (err) => {
      this.loadCancelling = false;
      console.error('❌ Error cancelling contract:', err);
      this.showError('Failed to cancel contract.');
      if (err.status === 401) this.router.navigate(['/login']);
    },
  });
}


  /** 🔹 Search filter */
  applyFilter() {
    const filterValue = this.searchText.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  /** 🔹 Snackbar helpers */
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



  printContract(contract: ContractObject) {
  const printContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Rental Contract #${contract.contract_number || 'N/A'}</title>
        <style>
          @page { 
            margin: 15mm 20mm; 
            size: A4;
          }
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #2c3e50;
            line-height: 1.6;
            font-size: 11pt;
          }
          
          .container {
            max-width: 100%;
            margin: 0 auto;
          }
          
          /* Header Styling */
          .header {
            text-align: center;
            padding: 30px 0;
            border-bottom: 4px double #3f51b5;
            margin-bottom: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          .header h1 {
            font-size: 32pt;
            font-weight: 700;
            letter-spacing: 2px;
            margin-bottom: 10px;
            text-transform: uppercase;
          }
          
          .contract-meta {
            display: flex;
            justify-content: space-between;
            margin-top: 15px;
            font-size: 10pt;
            opacity: 0.95;
          }
          
          .contract-number {
            font-size: 14pt;
            font-weight: 600;
            background: rgba(255,255,255,0.2);
            padding: 8px 20px;
            border-radius: 20px;
            display: inline-block;
            margin-top: 10px;
          }
          
          /* Status Badge */
          .status-section {
            text-align: center;
            margin: 25px 0;
          }
          
          .status-badge {
            display: inline-block;
            padding: 12px 30px;
            border-radius: 25px;
            font-weight: 700;
            font-size: 12pt;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.15);
          }
          
          .status-active {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
          }
          
          .status-inactive {
            background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
            color: white;
          }
          
          /* Section Styling */
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          
          .section-title {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            font-size: 14pt;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-radius: 6px;
            margin-bottom: 20px;
            box-shadow: 0 3px 8px rgba(0,0,0,0.15);
          }
          
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 15px;
          }
          
          .info-item {
            background: #f8f9fa;
            padding: 15px;
            border-left: 4px solid #667eea;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
          }
          
          .info-item.full-width {
            grid-column: 1 / -1;
          }
          
          .info-label {
            font-weight: 700;
            color: #6c757d;
            font-size: 9pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 5px;
          }
          
          .info-value {
            font-size: 11pt;
            color: #2c3e50;
            font-weight: 500;
          }
          
          /* Terms & Conditions */
          .terms-list {
            list-style: none;
            padding-left: 0;
          }
          
          .terms-list li {
            padding: 10px 15px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border-left: 3px solid #667eea;
            border-radius: 4px;
            position: relative;
            padding-left: 35px;
          }
          
          .terms-list li:before {
            content: "✓";
            position: absolute;
            left: 12px;
            color: #667eea;
            font-weight: bold;
            font-size: 14pt;
          }
          
          /* Payment Schedule Table */
          .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 8px;
            overflow: hidden;
          }
          
          .payment-table th {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 10pt;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          
          .payment-table td {
            padding: 12px;
            border-bottom: 1px solid #e9ecef;
            background: white;
          }
          
          .payment-table tr:last-child td {
            border-bottom: none;
          }
          
          .payment-table tr:hover td {
            background: #f8f9fa;
          }
          
          /* Signatures */
          .signature-section {
            margin-top: 60px;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 40px;
            page-break-inside: avoid;
          }
          
          .signature-box {
            text-align: center;
            padding: 20px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            background: #f8f9fa;
          }
          
          .signature-line {
            border-top: 2px solid #2c3e50;
            margin-top: 60px;
            padding-top: 10px;
            font-weight: 600;
            color: #2c3e50;
          }
          
          .signature-date {
            margin-top: 15px;
            color: #6c757d;
            font-size: 9pt;
          }
          
          /* Footer */
          .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #e9ecef;
            text-align: center;
            color: #6c757d;
            font-size: 9pt;
          }
          
          .footer-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
          }
          
          /* Important Notice Box */
          .notice-box {
            background: #fff3cd;
            border: 2px solid #ffc107;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .notice-box strong {
            color: #856404;
            font-size: 11pt;
          }
          
          .notice-box p {
            margin-top: 8px;
            color: #856404;
            font-size: 10pt;
          }
          
          /* Print Optimizations */
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            
            .section {
              page-break-inside: avoid;
            }
            
            .signature-section {
              page-break-before: auto;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>Rental Contract Agreement</h1>
            <div class="contract-number">Contract #${contract.contract_number || 'N/A'}</div>
            <div class="contract-meta">
              <span>📅 Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              <span>📄 Legal Document</span>
            </div>
          </div>

          <!-- Status Badge -->
          <div class="status-section">
            <div class="status-badge ${contract.is_active ? 'status-active' : 'status-inactive'}">
              ${contract.is_active ? '✓ Active Contract' : '✗ Inactive Contract'}
            </div>
          </div>

          <!-- Parties Information -->
          <div class="section">
            <div class="section-title">👥 Parties to the Agreement</div>
            
            <h3 style="color: #667eea; margin-bottom: 15px; font-size: 12pt;">Tenant Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Full Name</div>
                <div class="info-value">${contract.customer_name}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Contact Number</div>
                <div class="info-value">${contract.customer_phone}</div>
              </div>
            </div>
          </div>

          <!-- Property Details -->
          <div class="section">
            <div class="section-title">🏠 Property Details</div>
            <div class="info-grid">
              <div class="info-item full-width">
                <div class="info-label">Rental Unit</div>
                <div class="info-value">${contract.unit_info}</div>
              </div>
            </div>
          </div>

          <!-- Contract Period -->
          <div class="section">
            <div class="section-title">📅 Contract Period</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Commencement Date</div>
                <div class="info-value">${new Date(contract.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Expiration Date</div>
                <div class="info-value">${new Date(contract.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              <div class="info-item full-width">
                <div class="info-label">Contract Duration</div>
                <div class="info-value">${this.calculateDuration(contract.start_date, contract.end_date)}</div>
              </div>
            </div>
          </div>

          <!-- Financial Terms -->
          <div class="section">
            <div class="section-title">💰 Financial Terms</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Monthly Rent Amount</div>
                <div class="info-value" style="font-size: 14pt; color: #667eea; font-weight: 700;">KES ${this.formatCurrency(contract.rent_amount)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Security Deposit</div>
                <div class="info-value" style="font-size: 14pt; color: #667eea; font-weight: 700;">KES ${this.formatCurrency(contract.deposit_amount)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Payment Frequency</div>
                <div class="info-value">${contract.payment_frequency.toUpperCase()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Payment Due Date</div>
                <div class="info-value">1st of every month</div>
              </div>
            </div>
            
            <!-- Payment Schedule -->
            <h3 style="color: #667eea; margin: 25px 0 15px 0; font-size: 12pt;">Payment Breakdown</h3>
            <table class="payment-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Amount (KES)</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Monthly Rent</td>
                  <td>${this.formatCurrency(contract.rent_amount)}</td>
                  <td>${contract.payment_frequency === 'monthly' ? 'Monthly' : contract.payment_frequency === 'quarterly' ? 'Quarterly' : 'Yearly'}</td>
                </tr>
                <tr>
                  <td>Security Deposit (Refundable)</td>
                  <td>${this.formatCurrency(contract.deposit_amount)}</td>
                  <td>Upon Contract Signing</td>
                </tr>
                <tr style="background: #f8f9fa; font-weight: 700;">
                  <td>Total Initial Payment</td>
                  <td style="color: #667eea; font-size: 12pt;">KES ${this.formatCurrency((parseFloat(contract.rent_amount) + parseFloat(contract.deposit_amount)).toString())}</td>
                  <td>Before Move-in</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Terms and Conditions -->
          <div class="section">
            <div class="section-title">📋 Terms & Conditions</div>
            <ul class="terms-list">
              <li>The tenant agrees to pay rent on or before the 1st day of each month.</li>
              <li>Late payment charges of 5% will be applied after 5 days from the due date.</li>
              <li>The security deposit will be refunded within 30 days after lease termination, subject to property inspection.</li>
              <li>The tenant is responsible for maintaining the property in good condition.</li>
              <li>Any structural modifications require prior written consent from the landlord.</li>
              <li>The tenant must not sublet the property without landlord's written permission.</li>
              <li>Either party may terminate this agreement by providing 30 days written notice.</li>
              <li>The tenant must maintain adequate insurance for personal belongings.</li>
            </ul>
          </div>

          <!-- Important Notice -->
          <div class="notice-box">
            <strong>⚠️ Important Notice</strong>
            <p>This is a legally binding contract. Both parties should read and understand all terms before signing. It is recommended to seek legal advice if needed.</p>
          </div>

          <!-- Signatures -->
          <div class="signature-section">
            <div class="signature-box">
              <div style="font-weight: 700; color: #667eea; margin-bottom: 10px; font-size: 11pt;">LANDLORD / AGENT</div>
              <div class="signature-line">
                Signature
              </div>
              <div class="signature-date">
                Date: _____________________
              </div>
              <div style="margin-top: 15px; color: #6c757d; font-size: 9pt;">
                Print Name: _____________________
              </div>
            </div>
            
            <div class="signature-box">
              <div style="font-weight: 700; color: #667eea; margin-bottom: 10px; font-size: 11pt;">TENANT</div>
              <div class="signature-line">
                Signature
              </div>
              <div class="signature-date">
                Date: _____________________
              </div>
              <div style="margin-top: 15px; color: #6c757d; font-size: 9pt;">
                Print Name: ${contract.customer_name}
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="footer">
            <div class="footer-content">
              <span>© ${new Date().getFullYear()} Property Management System</span>
              <span>Contract ID: ${contract.contract_number || 'N/A'}</span>
              <span>Page 1 of 1</span>
            </div>
            <p style="margin-top: 15px; font-size: 8pt; color: #adb5bd;">
              This document is computer-generated and valid without signature if electronically signed.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  // Create hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(printContent);
    doc.close();

    // ✅ Wait a short delay to ensure DOM is rendered
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 500);

  } else {
    this.showError('Failed to open print document.');
  }
}

// Helper method to calculate duration
private calculateDuration(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const years = Math.floor(months / 12);
  
  if (years > 0) {
    const remainingMonths = months % 12;
    return `${years} year${years > 1 ? 's' : ''} ${remainingMonths > 0 ? `and ${remainingMonths} month${remainingMonths > 1 ? 's' : ''}` : ''}`;
  } else {
    return `${months} month${months > 1 ? 's' : ''}`;
  }
}

// Helper method to format currency
private formatCurrency(amount: string): string {
  return parseFloat(amount).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
}