import {
  Component,
  inject,
  OnInit,
  AfterViewInit,
  TemplateRef,
  ViewChild,
  ChangeDetectorRef,
  ElementRef,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
import { SystemParametersServices } from '../../../services/system-parameters-services';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { environment } from '../../../../environments/environment';

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
  id_photo_front: any;
  id_photo_back: any;
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
  private systemParametersService = inject(SystemParametersServices);
  private fb = inject(FormBuilder);
  private platformId = inject(PLATFORM_ID); // ✅ Add this

  apiUrl = environment.apiUrl;

  @ViewChild('openAddDialog') openAddDialog!: TemplateRef<any>;
  @ViewChild('editDialog') editDialog!: TemplateRef<any>;
  @ViewChild('deleteDialog') deleteDialog!: TemplateRef<any>;
  @ViewChild('cancelDialog') cancelDialog!: TemplateRef<any>;
  @ViewChild('contractPreviewDialog') contractPreviewDialog!: TemplateRef<any>;
  @ViewChild('contractPreview', { static: false }) contractPreview!: ElementRef;
  @ViewChild('activePaginator') activePaginator!: MatPaginator;
  @ViewChild('inactivePaginator') inactivePaginator!: MatPaginator;

  contracts: ContractObject[] = [];
  activeDataSource = new MatTableDataSource<ContractObject>([]);
  inactiveDataSource = new MatTableDataSource<ContractObject>([]);
  displayedColumns: string[] = [
    'contract_number',
    'customer_name',
    'unit_info',
    'start_date',
    'rent_amount',
    'deposit_amount',
    'payment_frequency',
    'actions',
  ];

  contractForm!: FormGroup;
  updateContractForm!: FormGroup;
  selectedContractId: number | null = null;
  isEditMode = false;

  isLoading: boolean = false;
  loadAdding = false;
  loadUpdating = false;
  loadDeleting = false;
  loadCancelling = false;
  isGeneratingPDF = false;
  selectedPropertyId: any;
  error: string | null = null;

  customers: any[] = [];
  units: any[] = [];
  properties: any[] = [];
  filteredUnits: any[] = [];

  searchText = '';
  systemParameters: any;

  // Contract preview data
  selectedContract: ContractObject | null = null;
  contractStartDate: string = '';
  contractEndDate: string = '';
  contractDuration: string = '';
  totalInitialPayment: string = '';

  formatToYMD(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    // Initialize forms first (can run on server)
    this.initForm();
    this.upContractForm();

    // ✅ CRITICAL: Only load data in browser
    if (isPlatformBrowser(this.platformId)) {
      console.log('🔍 Contracts component running in browser');

      // Verify token exists
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token status:', token ? 'Token exists' : '❌ NO TOKEN!');

      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      this.loadCustomers();
      this.loadUnits();
      this.loadProperties();
      this.loadContracts();
    } else {
      console.log('⚠️ Contracts component running on server, skipping API calls');
    }

    this.isLoading = false;
  }

  ngAfterViewInit(): void {
    // ✅ Only set paginator in browser
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.activePaginator) {
          this.activeDataSource.paginator = this.activePaginator;
        }
        if (this.inactivePaginator) {
          this.inactiveDataSource.paginator = this.inactivePaginator;
        }
      });
    }
  }

  initForm() {
    this.contractForm = this.fb.group({
      customer: ['', Validators.required],
      unit: ['', Validators.required],
      start_date: ['', Validators.required],
      rent_amount: ['', Validators.required],
      deposit_amount: ['', Validators.required],
      payment_frequency: ['monthly', Validators.required],
    });
  }

  upContractForm() {
    this.updateContractForm = this.fb.group({
      customer: ['', Validators.required],
      unit: ['', Validators.required],
      start_date: ['', Validators.required],
      rent_amount: ['', Validators.required],
      deposit_amount: ['', Validators.required],
      payment_frequency: ['', Validators.required],
    });
  }

  loadCustomers() {
    console.log('📡 Loading customers...');
    this.customersService.getCustomers().subscribe({
      next: (res) => {
        this.customers = res;
        console.log('✅ Customers loaded:', this.customers);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading customers:', err);
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      },
    });
  }

  loadUnits() {
    console.log('📡 Loading units...');
    this.unitsService.getUnits().subscribe({
      next: (res) => {
        this.units = res;
        console.log('✅ Units loaded:', this.units);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading units:', err);
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      },
    });
  }

  onUnitChange(id: number) {
    console.log('Selected Unit ID:', id);
    const test = this.units.find(u => u.id === id);
    console.log('Selected Unit Details:', test);
    this.cdr.detectChanges();
    this.contractForm.patchValue({
      rent_amount: test ? test.rent_amount : '',
      deposit_amount: test ? Number(test.rent_amount) * this.systemParameters.rent_deposit_months : '',
      payment_frequency: 'monthly'
    });
  }

  getSystemParameters(propertyId: number) {
    console.log('📡 Loading system parameters for property:', propertyId);
    this.systemParametersService.getSystemParams(propertyId).subscribe({
      next: (res) => {
        console.log('✅ System Parameters loaded:', res);
        this.systemParameters = res;
      },
      error: (err) => {
        console.error('❌ Error loading system parameters:', err);
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      },
    });
  }

  loadProperties() {
    console.log('📡 Loading properties...');
    this.propertyService.getProperties().subscribe({
      next: (res) => {
        this.systemParameters = res;
        this.properties = res;
        console.log('✅ Properties loaded:', this.properties);
        this.selectedPropertyId = this.properties[0]?.id;
        this.onPropertyChange(this.selectedPropertyId);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      },
    });
  }

  onPropertyChange(propertyId: number) {
    this.getSystemParameters(propertyId);
    console.log('🔄 Property changed to:', propertyId);
    setTimeout(() => {
      this.filteredUnits = this.units.filter(u => u.property === propertyId);
      console.log('✅ Filtered Units for Property:', this.filteredUnits);
      this.cdr.detectChanges();
    }, 100);
    this.contractForm.patchValue({ unit: '' });
  }

  loadContracts() {
    console.log('📡 Loading contracts...');
    this.isLoading = true;

    this.contractsService.getContracts().subscribe({
      next: (res) => {
        console.log('✅ Contracts loaded:', res);
        this.contracts = res;

        if (!this.selectedPropertyId && this.properties?.length > 0) {
          this.selectedPropertyId = this.properties[0].id;
          console.log('🔄 Defaulted to first property:', this.selectedPropertyId);
        }

        let filteredContracts = this.contracts;

        if (this.selectedPropertyId) {
          filteredContracts = this.contracts.filter(contract => {
            const unit = this.units.find(u => u.id === contract.unit);
            return unit && unit.property === this.selectedPropertyId;
          });
        }

        const activeContracts = filteredContracts.filter(c => c.is_active);
        const inactiveContracts = filteredContracts.filter(c => !c.is_active);

        this.activeDataSource.data = activeContracts;
        this.inactiveDataSource.data = inactiveContracts;

        this.isLoading = false;

        // ✅ Only update paginator in browser
        if (isPlatformBrowser(this.platformId)) {
          setTimeout(() => {
            if (this.activePaginator) {
              this.activeDataSource.paginator = this.activePaginator;
            }
            if (this.inactivePaginator) {
              this.inactiveDataSource.paginator = this.inactivePaginator;
            }
          }, 100);
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading contracts:', err);
        this.isLoading = false;
        this.error = 'Failed to load contracts.';
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
        this.cdr.detectChanges();
      },
    });
  }

  filterContractsByProperty() {
    console.log('🔍 Filtering contracts for property:', this.selectedPropertyId);
    this.onPropertyChange(this.selectedPropertyId);
    if (!this.selectedPropertyId) {
      const activeContracts = this.contracts.filter(c => c.is_active);
      const inactiveContracts = this.contracts.filter(c => !c.is_active);

      this.activeDataSource.data = activeContracts;
      this.inactiveDataSource.data = inactiveContracts;
      return;
    }

    const filteredContracts = this.contracts.filter(contract => {
      const unit = this.units.find(u => u.id === contract.unit);
      return unit && unit.property === this.selectedPropertyId;
    });

    const activeContracts = filteredContracts.filter(c => c.is_active);
    const inactiveContracts = filteredContracts.filter(c => !c.is_active);

    this.activeDataSource.data = activeContracts;
    this.inactiveDataSource.data = inactiveContracts;

    // ✅ Only update paginator in browser
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        if (this.activePaginator) {
          this.activeDataSource.paginator = this.activePaginator;
        }
        if (this.inactivePaginator) {
          this.inactiveDataSource.paginator = this.inactivePaginator;
        }
      });
    }

    this.cdr.detectChanges();
  }

  openAddDialogForm() {
    this.isEditMode = false;
    this.contractForm.reset();
    this.dialog.open(this.openAddDialog, {
      maxWidth: '700px',
      disableClose: true
    });
  }

  openEditDialog(contract: ContractObject) {
    this.isEditMode = true;
    this.selectedContractId = contract.id;

    this.updateContractForm.patchValue({
      customer: contract.customer,
      unit: contract.unit,
      start_date: contract.start_date,
      rent_amount: contract.rent_amount,
      deposit_amount: contract.deposit_amount,
      payment_frequency: contract.payment_frequency,
    });

    this.dialog.open(this.editDialog, {
      maxWidth: '700px',
      disableClose: true
    });
  }

  testData() {
    console.log(this.contractForm.value);
  }

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
      rent_amount: formValues.rent_amount,
      deposit_amount: formValues.deposit_amount,
      payment_frequency: formValues.payment_frequency,
    };

    console.log('📤 Adding contract:', payload);

    this.contractsService.addContract(payload).subscribe({
      next: () => {
        console.log('✅ Contract added successfully');
        this.loadAdding = false;
        this.showSuccess('Contract added successfully!');
        this.dialog.closeAll();
        this.contractForm.reset();
        this.loadContracts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error adding contract:', err);
        this.loadAdding = false;
        this.showError('Failed to add contract.');
        this.cdr.detectChanges();
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      },
    });
  }

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

    console.log('📤 Updating contract:', this.selectedContractId, payload);

    this.contractsService.updateContract(this.selectedContractId, payload).subscribe({
      next: () => {
        console.log('✅ Contract updated successfully');
        this.loadUpdating = false;
        this.showSuccess('Contract updated successfully!');
        this.dialog.closeAll();
        this.updateContractForm.reset();
        this.loadContracts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error updating contract:', err);
        this.loadUpdating = false;
        this.showError('Failed to update contract.');
        this.cdr.detectChanges();
        if (err.status === 401) {
          this.router.navigate(['/login']);
          this.dialog.closeAll();
        }
      },
    });
  }

  openDeleteDialog(contract: ContractObject) {
    this.selectedContractId = contract.id;
    this.dialog.open(this.deleteDialog);
  }

  confirmDelete() {
    if (!this.selectedContractId) return;
    this.loadDeleting = true;

    console.log('🗑️ Deleting contract:', this.selectedContractId);

    this.contractsService.deleteContract(this.selectedContractId).subscribe({
      next: () => {
        console.log('✅ Contract deleted successfully');
        this.loadDeleting = false;
        this.showSuccess('Contract deleted successfully!');
        this.dialog.closeAll();
        this.loadContracts();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error deleting contract:', err);
        this.loadDeleting = false;
        this.showError('Failed to delete contract.');
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
        this.cdr.detectChanges();
      },
    });
  }

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

    console.log('📤 Cancelling contract:', this.selectedContractId);

    this.contractsService.cancelContract(this.selectedContractId, payload).subscribe({
      next: () => {
        console.log('✅ Contract cancelled successfully');
        this.showSuccess('Contract cancelled successfully!');
        this.dialog.closeAll();
        setTimeout(() => {
          this.loadContracts();
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error cancelling contract:', err);
        this.loadCancelling = false;
        this.showError('Failed to cancel contract.');
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
        this.cdr.detectChanges();
      },
    });
  }

  applyFilter() {
    const filterValue = this.searchText.trim().toLowerCase();
    this.activeDataSource.filter = filterValue;
    this.inactiveDataSource.filter = filterValue;
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

  // Contract Preview and PDF Generation
  printContract(contract: ContractObject) {
    console.log('📄 Generating contract for:', contract);

    this.selectedContract = contract;
    this.contractStartDate = new Date(contract.start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    this.contractEndDate = new Date(contract.end_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    this.contractDuration = this.calculateDuration(contract.start_date, contract.end_date);
    this.totalInitialPayment = this.formatCurrency(
      (parseFloat(contract.rent_amount) + parseFloat(contract.deposit_amount)).toString()
    );

    this.openContractPreview();
  }

  openContractPreview() {
    const dialogRef = this.dialog.open(this.contractPreviewDialog, {
      width: '900px',
      maxHeight: '90vh',
      panelClass: 'contract-preview-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result !== undefined) {
        console.log('Dialog closed with result:', result);
      }
    });
  }

  generateContractPDF() {
    this.isGeneratingPDF = true;

    const element = this.contractPreview.nativeElement;

    html2canvas(element, { scale: 2 }).then(canvas => {
      const imgData = canvas.toDataURL('image/png');

      // A4 dimensions
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const contentWidth = pageWidth - (2 * margin);

      const imgWidth = contentWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const availableHeight = pageHeight - (2 * margin);

      let position = margin;
      let remainingHeight = imgHeight;

      if (imgHeight <= availableHeight) {
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      } else {
        let currentPage = 0;

        while (remainingHeight > 0) {
          if (currentPage > 0) {
            pdf.addPage();
          }

          const heightToShow = Math.min(availableHeight, remainingHeight);
          const sourceY = currentPage * availableHeight * (canvas.height / imgHeight);
          const sourceHeight = heightToShow * (canvas.height / imgHeight);

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

      pdf.save(`contract_${this.selectedContract?.contract_number}.pdf`);

      this.isGeneratingPDF = false;
      this.dialog.closeAll();

      this.showSuccess('PDF downloaded successfully!');

    }).catch(error => {
      console.error('Error generating PDF:', error);
      this.isGeneratingPDF = false;

      this.showError('Failed to generate PDF. Please try again.');
    });
  }

  calculateDuration(startDate: string, endDate: string): string {
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

  formatCurrency(amount: string): string {
    return parseFloat(amount).toLocaleString('en-KE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
}