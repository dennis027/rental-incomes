import { Component, OnInit, AfterViewInit, ViewChild, inject, TemplateRef, ChangeDetectorRef, ElementRef } from '@angular/core';
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SystemParametersServices } from '../../../services/system-parameters-services';
import { PaymentService } from '../../../services/payments';

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
  balance:string
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
  private propertyService = inject(PropertiesService);
  private systemParametersSerice = inject(SystemParametersServices)
  private paymentService = inject(PaymentService)

  displayedColumns: string[] = [
    'receipt_number', 'contract_number',  'unit',
    'monthly_rent', 'electricity_bill', 'water_bill', 'service_charge', 'total_amount','balance', 'actions'
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
  @ViewChild('deleteReceiptDial') deleteReceiptDial!: TemplateRef<any>;
  @ViewChild('generateMonthlyDialog') generateMonthlyDialog!: TemplateRef<any>;
  @ViewChild('receiptPreviewDialog') receiptPreviewDialog!: TemplateRef<any>;
  @ViewChild('paymentsDial') paymentsDial!: TemplateRef<any>;
  @ViewChild('receiptPreview', { static: false }) receiptPreview!: ElementRef;

  addReceiptForm!: FormGroup;
  updateReceiptForm!: FormGroup;
  generateMonthlyForm!: FormGroup;
  paymentForm!:FormGroup
  loadAdding = false;
  loadGenerating = false;
  selectedReceiptId: number | null = null;
  currentMonth:any
  currentYear:any

  receipt: Receipt | null = null;
  loadMakingPayments=false
  systemParametersObject:any = []
  receiptItems: { label: string; amount: number }[] = [];
  formattedDate: string = '';
  receiptClientName: string = '';
  houseNameNo: string = '';

  ngOnInit() {

    const today = new Date();
    this.currentMonth = today.toLocaleString('en-US', { month: 'long' });
    this.currentYear = today.getFullYear();

    this.initializeForms();
    this.loadProperties();
    this.loadData();
    this.setupFilters();

 
 
  }

  getSystemParameters(){
    const propertyId = this.selectedProperty.value;
    this.systemParametersSerice.getSystemParams( propertyId?  Number(propertyId) : this.properties[0].id ).subscribe(
      (res)=>{
        this.systemParametersObject =res
      },
      (err)=>{
        console.log
      }
    )
  }


  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
  }

  loadProperties() {
    this.propertyService.getProperties().subscribe(
      (res) => {
        this.properties = res;
        if (this.properties && this.properties.length > 0) {
          this.selectedProperty.setValue(String(this.properties[0].id));
        }
        this.getSystemParameters()
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

    this.paymentForm = this.fb.group({
      amount: ['', Validators.required],
      method: ['', Validators.min(0)],
      reference: ['', Validators.required],
      notes: [`Payment for ${this.currentMonth} ${this.currentYear}`, [Validators.required]]
    })
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

      let dialogRef = this.dialog.open(this.deleteReceiptDial);
        dialogRef.afterClosed().subscribe(result => {
            // Note: If the user clicks outside the dialog or presses the escape key, there'll be no result
            if (result !== undefined) {
                if (result === 'yes') {
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
                } else if (result === 'no') {
                    // TODO: Replace the following line with your code.
                    console.log('User clicked no.');
                }
            }
        })



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

  // Receipt Preview and PDF Generation
  generateReceipt(receipt: Receipt) {
    console.log('Generating receipt for:', receipt);
    
    // Set the main receipt object
    this.receipt = receipt;
    
    // Set client information
    this.receiptClientName = receipt.customer;
    this.houseNameNo = receipt.unit;
    
    // Format date correctly
    this.formattedDate = new Date(receipt.issue_date).toLocaleDateString();
    
    // Format the receipt items dynamically (excluding total - shown separately)
    this.receiptItems = [
      { label: 'Monthly Rent', amount: parseFloat(receipt.monthly_rent) || 0 },
      { label: 'Rental Deposit', amount: parseFloat(receipt.rental_deposit) || 0 },
      { label: 'Electricity Deposit', amount: parseFloat(receipt.electricity_deposit) || 0 },
      { label: 'Electricity Bill', amount: parseFloat(receipt.electricity_bill) || 0 },
      { label: 'Water Deposit', amount: parseFloat(receipt.water_deposit) || 0 },
      { label: 'Water Bill', amount: parseFloat(receipt.water_bill) || 0 },
      { label: 'Service Charge', amount: parseFloat(receipt.service_charge) || 0 },
      { label: 'Security Charge', amount: parseFloat(receipt.security_charge) || 0 },
      { label: 'Previous Balance', amount: parseFloat(receipt.previous_balance) || 0 },
      { label: 'Other Charges', amount: parseFloat(receipt.other_charges) || 0 }
    ].filter(item => item.amount > 0); // Only show non-zero amounts
  }

   openPaymentDial() {
        let dialogRef = this.dialog.open(this.paymentsDial);
        dialogRef.afterClosed().subscribe(result => {
            // Note: If the user clicks outside the dialog or presses the escape key, there'll be no result
            if (result !== undefined) {
                if (result === 'yes') {
        
                } else if (result === 'no') {
       
                }
            }
        })
    }


    addPayment(){
      this.loadMakingPayments = true
      const data ={
        receipt: this.receipt?.id,
        amount:this.paymentForm.value.amount ,
        method:this.paymentForm.value.method ,
        reference:this.paymentForm.value.reference ,
        notes:this.paymentForm.value.notes
      }

      this.paymentService.makePayment(data).subscribe(
        (res)=>{
          this.loadMakingPayments=false
          this.showSuccess("Payment Made successfuly");
          this.getReceipts();
          this.dialog.closeAll();
          this.paymentForm.reset();
          this.cdr.detectChanges;

        },
        (err)=>{
          this.loadMakingPayments=false
          this.cdr.detectChanges();
          this.showError("Kindly check your details")
        }
      )
    }






  openReceiptReview() {
    const dialogRef = this.dialog.open(this.receiptPreviewDialog, {
      width: '800px',
      height: 'auto',
      panelClass: 'receipt-preview-dialog'
    });
    
    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        if (result === 'yes') {
          // Handle yes action if needed
        } else if (result === 'no') {
          // Handle no action if needed
        }
      }
    });
  }

  generatePDF() {
    const element = this.receiptPreview.nativeElement;
    html2canvas(element, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      
      // A5 dimensions in portrait mode (148mm x 210mm)
      const pdf = new jsPDF('p', 'mm', 'a5');
      const pageWidth = 148;
      const pageHeight = 210;
      const margin = 10;
      const contentWidth = pageWidth - (2 * margin);
      
      // Calculate the height of the content
      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Available height per page (minus margins)
      const availableHeight = pageHeight - (2 * margin);
      
      let position = margin;
      let remainingHeight = imgHeight;
      
      // If content fits on one page
      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      } else {
        // Content spans multiple pages
        let currentPage = 0;
        
        while (remainingHeight > 0) {
          if (currentPage > 0) {
            pdf.addPage();
          }
          
          // Calculate how much of the image to show on this page
          const heightToShow = Math.min(availableHeight, remainingHeight);
          
          // Calculate the source Y position (which part of the image to capture)
          const sourceY = currentPage * availableHeight * (canvas.height / imgHeight);
          const sourceHeight = heightToShow * (canvas.height / imgHeight);
          
          // Create a temporary canvas for this page's content
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          const pageCtx = pageCanvas.getContext('2d');
          
          if (pageCtx) {
            pageCtx.drawImage(
              canvas,
              0, sourceY, canvas.width, sourceHeight,
              0, 0, canvas.width, sourceHeight
            );
            
            const pageImgData = pageCanvas.toDataURL('image/png');
            pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, heightToShow);
          }
          
          remainingHeight -= availableHeight;
          currentPage++;
        }
      }
      
      pdf.save(`receipt_${this.receipt?.receipt_number}.pdf`);
    });
  }
}