import { PropertyContext } from '../../../services/property-context';
import { MoveOutDialog } from '../move-out/move-out-dialog';
import { Component, inject, OnInit, AfterViewInit, TemplateRef, ViewChild, ChangeDetectorRef, ElementRef, PLATFORM_ID, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { SharedImports } from '../../../shared-imports/imports';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
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

  // The property chosen in the top bar; this page follows it
  private propertyContext = inject(PropertyContext);
  private propertySync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => this.followProperty(propertyId));
  });

  private followProperty(propertyId: number | null): void {
    if (propertyId === null || this.properties.length === 0 || this.selectedPropertyId === propertyId) {
      return;
    }
    this.selectedPropertyId = propertyId;
    this.onPropertyFilterChange();
  }

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

      // Verify token exists
      const token = localStorage.getItem('access_token');

      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }

      this.loadPage();
    } else {
    }
  }

  // ---------- Page data and the list on screen ----------

  /** Contracts shown in the table: one list, switched between active and ended */
  viewDataSource = new MatTableDataSource<ContractObject>([]);
  tab: 'active' | 'ended' = 'active';
  activeCount = 0;
  endedCount = 0;
  @ViewChild('viewPaginator') viewPaginator!: MatPaginator;

  get viewColumns(): string[] {
    const columns = ['contract_number', 'customer_name', 'unit_info', 'start_date'];
    if (this.tab === 'ended') {
      columns.push('end_date');
    }
    return [...columns, 'rent_amount', 'deposit_amount', 'payment_frequency', 'actions'];
  }

  /** Everything the page needs, requested together instead of one after another */
  loadPage() {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      properties: this.propertyService.getProperties(),
      units: this.unitsService.getUnits(),
      customers: this.customersService.getCustomers(),
      contracts: this.contractsService.getContracts(),
    }).subscribe({
      next: ({ properties, units, customers, contracts }) => {
        this.properties = properties;
        this.units = units;
        this.customers = customers;
        this.setContracts(contracts);

        if (this.properties.length > 0) {
          this.selectedPropertyId = this.propertyContext.resolve(this.properties);
        }
        if (this.selectedPropertyId) {
          this.getSystemParameters(this.selectedPropertyId);
          this.filteredUnits = this.units.filter(u => u.property === this.selectedPropertyId);
        }

        this.isLoading = false;
        this.applyView();
      },
      error: (err) => {
        this.isLoading = false;
        if (err.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        this.error = 'Contracts could not be loaded. Check your connection and try again.';
        this.cdr.detectChanges();
      },
    });
  }

  private setContracts(contracts: any[]) {
    // unit_info is what the table and the printed agreement show
    this.contracts = (contracts ?? []).map(contract => ({
      ...contract,
      unit_info: contract.unit_info || [contract.unit_number, contract.property_name].filter(Boolean).join(' · '),
    }));
  }

  setTab(tab: 'active' | 'ended') {
    this.tab = tab;
    this.applyView();
  }

  /** Apply the property filter, the search box and the active/ended switch */
  applyView() {
    const propertyOf = new Map<number, number>(this.units.map(u => [u.id, u.property]));
    const search = (this.searchText ?? '').trim().toLowerCase();

    const matching = this.contracts.filter((contract: any) => {
      if (this.selectedPropertyId && propertyOf.size > 0 && propertyOf.get(contract.unit) !== this.selectedPropertyId) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [contract.contract_number, contract.customer_name, contract.customer_phone, contract.unit_info]
        .some(value => String(value ?? '').toLowerCase().includes(search));
    });

    const active = matching.filter(c => c.is_active);
    const ended = matching.filter(c => !c.is_active);
    this.activeCount = active.length;
    this.endedCount = ended.length;
    this.activeDataSource.data = active;
    this.inactiveDataSource.data = ended;
    this.viewDataSource.data = this.tab === 'active' ? active : ended;

    this.cdr.detectChanges();
    // The paginator only exists once the table has been drawn
    if (this.viewPaginator && this.viewDataSource.paginator !== this.viewPaginator) {
      this.viewDataSource.paginator = this.viewPaginator;
    }
    this.viewPaginator?.firstPage();
  }

  onPropertyFilterChange() {
    if (this.selectedPropertyId) {
      this.getSystemParameters(this.selectedPropertyId);
      this.filteredUnits = this.units.filter(u => u.property === this.selectedPropertyId);
    }
    this.applyView();
  }

  goToUnits() {
    this.router.navigate(['/dashboard/units']);
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
    this.customersService.getCustomers().subscribe({
      next: (res) => {
        this.customers = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading customers:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  loadUnits() {
    this.unitsService.getUnits().subscribe({
      next: (res) => {
        this.units = res;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading units:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  onUnitChange(id: number) {
    const test = this.units.find(u => u.id === id);
    this.cdr.detectChanges();
    this.contractForm.patchValue({
      rent_amount: test ? test.rent_amount : '',
      deposit_amount: test ? Number(test.rent_amount) * this.systemParameters.rent_deposit_months : '',
      payment_frequency: 'monthly'
    });
  }

  getSystemParameters(propertyId: number) {
    this.systemParametersService.getSystemParams(propertyId).subscribe({
      next: (res) => {
        this.systemParameters = res;
      },
      error: (err) => {
        console.error('❌ Error loading system parameters:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  loadProperties() {
    this.propertyService.getProperties().subscribe({
      next: (res) => {
        this.systemParameters = res;
        this.properties = res;
        this.selectedPropertyId = this.properties[0]?.id;
        this.onPropertyChange(this.selectedPropertyId);

      setTimeout(() => {
      this.loadContracts();
      }, 200);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      },
    });
  }

  onPropertyChange(propertyId: number) {
    this.getSystemParameters(propertyId);
    setTimeout(() => {
      this.filteredUnits = this.units.filter(u => u.property === propertyId);
      this.cdr.detectChanges();
    }, 100);
    this.contractForm.patchValue({ unit: '' });
  }

  loadContracts() {
    this.contractsService.getContracts().subscribe({
      next: (res) => {
        this.setContracts(res);
        this.applyView();
      },
      error: (err) => {
        if (err.status === 401) {
          this.router.navigate(['/login']);
          return;
        }
        this.showError('Contracts could not be refreshed.');
      },
    });
  }

  filterContractsByProperty() {
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

    this.contractsService.addContract(payload).subscribe({
      next: () => {
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

    this.contractsService.updateContract(this.selectedContractId, payload).subscribe({
      next: () => {
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

    this.contractsService.deleteContract(this.selectedContractId).subscribe({
      next: () => {
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

    this.contractsService.cancelContract(this.selectedContractId, payload).subscribe({
      next: () => {
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
          this.router.navigate(['/login']);
        }
        this.cdr.detectChanges();
      },
    });
  }

  openStatement(contract: ContractObject) {
    this.router.navigate(['/dashboard/statement'], { queryParams: { tenant: contract.customer, contract: contract.id } });
  }

  /** The deposit settlement recorded when the tenant moved out */
  openSettlement(contract: ContractObject) {
    this.dialog.open(MoveOutDialog, { width: '640px', maxWidth: '95vw', data: { contractId: contract.id } });
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

    this.selectedContract = contract;
    this.contractStartDate = new Date(contract.start_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    // A running contract has no end date yet
    if (contract.end_date) {
      this.contractEndDate = new Date(contract.end_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      this.contractDuration = this.calculateDuration(contract.start_date, contract.end_date);
    } else {
      this.contractEndDate = 'further notice';
      this.contractDuration = 'Open-ended';
    }
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
      }
    });
  }

  generateContractPDF() {
    this.isGeneratingPDF = true;

    const element: HTMLElement = this.contractPreview.nativeElement;

    // Lay the sheet out at a fixed A4-like width, so the PDF looks the same
    // whatever the size of the preview window
    const previousStyle = element.getAttribute('style');
    element.style.width = '700px';
    element.style.maxWidth = 'none';
    const restore = () => {
      if (previousStyle === null) {
        element.removeAttribute('style');
      } else {
        element.setAttribute('style', previousStyle);
      }
    };

    html2canvas(element, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
      // A4 in millimetres
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 15;
      const footer = 8; // room for the page number
      const contentWidth = pageWidth - 2 * margin;
      const contentHeight = pageHeight - 2 * margin - footer;

      // The sheet is drawn `scale` times larger than it is on screen
      const scale = canvas.width / element.offsetWidth;
      const pxPerMm = canvas.width / contentWidth;
      const pageHeightPx = Math.floor(contentHeight * pxPerMm);

      // Each page ends between two blocks of text, never through a line
      const breaks = this.pageBreaks(element, scale, canvas.height, pageHeightPx);
      restore();

      for (let i = 0; i < breaks.length - 1; i++) {
        const top = breaks[i];
        const sliceHeight = breaks[i + 1] - top;

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const ctx = pageCanvas.getContext('2d');
        if (!ctx) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(canvas, 0, top, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        if (i > 0) {
          pdf.addPage();
        }
        // JPEG keeps the file small; at this scale the text stays sharp
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, contentWidth, sliceHeight / pxPerMm);

        pdf.setFontSize(9);
        pdf.setTextColor(120);
        pdf.text(`Page ${i + 1} of ${breaks.length - 1}`, pageWidth / 2, pageHeight - margin + 4, { align: 'center' });
      }

      pdf.save(`contract_${this.selectedContract?.contract_number}.pdf`);

      this.isGeneratingPDF = false;
      this.dialog.closeAll();

      this.showSuccess('PDF downloaded successfully!');

    }).catch(error => {
      console.error('Error generating PDF:', error);
      restore();
      this.isGeneratingPDF = false;

      this.showError('Failed to generate PDF. Please try again.');
    });
  }

  /**
   * Where to cut the rendered sheet into pages, in canvas pixels.
   * A cut is only allowed in the gap between two blocks (a paragraph, a table
   * row, a heading...), so no line of text is ever split across pages.
   */
  private pageBreaks(element: HTMLElement, scale: number, totalHeight: number, pageHeight: number): number[] {
    const origin = element.getBoundingClientRect().top;
    const isInline = (el: Element) => getComputedStyle(el).display.startsWith('inline');

    // The smallest blocks: elements that hold text or inline content only
    const blocks = Array.from(element.querySelectorAll<HTMLElement>('*'))
      .filter(el => !isInline(el) && el.offsetHeight > 0 && !Array.from(el.children).some(child => !isInline(child)))
      .map(el => {
        const rect = el.getBoundingClientRect();
        return {
          top: (rect.top - origin) * scale,
          bottom: (rect.bottom - origin) * scale,
          heading: el.matches('h1, h2, h3, h4, h5, h6, .legal-section-title'),
        };
      })
      .sort((a, b) => a.top - b.top);

    // A heading stays with whatever follows it
    blocks.forEach((block, i) => {
      const next = blocks[i + 1];
      if (block.heading && next) {
        block.bottom = Math.max(block.bottom, next.bottom);
      }
    });

    // Nothing but padding below the last block: do not give it a page of its own
    const contentBottom = Math.max(...blocks.map(block => block.bottom), 0);
    totalHeight = Math.min(totalHeight, Math.ceil(contentBottom) + 4);

    const insideBlock = (y: number) => blocks.some(block => y > block.top + 1 && y < block.bottom - 1);
    const candidates = Array.from(new Set(blocks.flatMap(block => [Math.floor(block.top), Math.ceil(block.bottom)])))
      .filter(y => !insideBlock(y))
      .sort((a, b) => a - b);

    const breaks = [0];
    let start = 0;
    while (totalHeight - start > pageHeight) {
      const limit = start + pageHeight;
      // Lowest safe cut on this page; keep at least a third of a page so pages are not left nearly empty
      const safe = candidates.filter(y => y <= limit && y > start + pageHeight / 3).pop();
      start = safe ?? limit;
      breaks.push(start);
    }
    breaks.push(totalHeight);
    return breaks;
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