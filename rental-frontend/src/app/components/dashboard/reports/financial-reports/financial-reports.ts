import { Component, inject, ViewChild, AfterViewInit, OnInit, OnDestroy, ChangeDetectorRef, TemplateRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PropertiesService } from '../../../../services/properties';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SharedImports } from '../../../../shared-imports/imports';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SystemParametersServices } from '../../../../services/system-parameters-services';
import { ReportsService } from '../../../../services/reports';

// Declare global window objects for libraries
declare global {
  interface Window {
    pdfMake: any;
    XLSX: any;
  }
}

@Component({
  selector: 'app-financial-reports',
  imports: [SharedImports],
  templateUrl: './financial-reports.html',
  styleUrl: './financial-reports.css',
})
export class FinancialReports implements OnInit, OnDestroy {

  private reportsService = inject(ReportsService);
  private platformId = inject(PLATFORM_ID); 
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private propertiesService = inject(PropertiesService);
  private fb = inject(FormBuilder);

  properties: any[] = [];
  revenueForm!: FormGroup;
  totalRevenue: any;
  
  // Carousel properties
  currentPropertyIndex: number = 0;
  currentProperty: any = null;
  private autoSlideInterval: any;
  private isAutoSliding: boolean = true;

  formatToYyyyMmDd(dateString: string): string {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const start_date = '';
      const end_date = '';
      this.fetchTotalRevenue(start_date, end_date);
      this.getPropertiesList();
      this.loadExternalLibraries();
    }
    this.initializeForms();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
  }

  // Load external libraries dynamically
  private loadExternalLibraries(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Load pdfMake
    if (!window.pdfMake) {
      const pdfMakeScript = document.createElement('script');
      pdfMakeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/pdfmake.min.js';
      pdfMakeScript.async = true;
      document.body.appendChild(pdfMakeScript);

      const pdfFontsScript = document.createElement('script');
      pdfFontsScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/vfs_fonts.js';
      pdfFontsScript.async = true;
      document.body.appendChild(pdfFontsScript);
    }

    // Load XLSX
    if (!window.XLSX) {
      const xlsxScript = document.createElement('script');
      xlsxScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      xlsxScript.async = true;
      document.body.appendChild(xlsxScript);
    }
  }

  initializeForms() {
    this.revenueForm = this.fb.group({
      start_date: [null, Validators.required],
      end_date: [null, Validators.required],
    });
  }

  getPropertiesList() {
    this.propertiesService.getProperties().subscribe(
      (response) => {
        this.properties = response;
        this.cdr.detectChanges();
        console.log('Properties fetched:', this.properties);
      },
      (error) => {
        console.error('Error fetching properties:', error);
        this.cdr.detectChanges();
      }
    );
  }

  fetchTotalRevenue(start_date: any, end_date: any): void {
    this.reportsService.getTotalRevenue(start_date, end_date).subscribe(
      (response) => {
        this.totalRevenue = response;
        console.log('Total Revenue:', this.totalRevenue);

        if (this.totalRevenue?.properties?.length > 0) {
          setTimeout(() => {
            this.currentPropertyIndex = 0;
            this.currentProperty = this.totalRevenue.properties[0];
            this.startAutoSlide();
            this.cdr.detectChanges();
          });
        } else {
          this.currentProperty = null;
          this.cdr.detectChanges();
        }
      },
      (error) => {
        console.error('Error fetching total revenue:', error);
        if (error.status === 401) {
          console.log('Unauthorized access - redirecting to login.');
          this.router.navigate(['/login']);
        }
        this.cdr.detectChanges();
      }
    );
  }

  searchData(): void {
    const startDate = this.revenueForm.get('start_date')?.value 
      ? this.formatToYyyyMmDd(this.revenueForm.get('start_date')?.value) 
      : '';
    const endDate = this.revenueForm.get('end_date')?.value 
      ? this.formatToYyyyMmDd(this.revenueForm.get('end_date')?.value) 
      : '';
    
    this.reportsService.getTotalRevenue(startDate, endDate).subscribe(
      (response) => {
        this.totalRevenue = response;
        console.log('Total Revenue:', this.totalRevenue);
        
        if (this.totalRevenue?.properties && this.totalRevenue.properties.length > 0) {
          this.currentPropertyIndex = 0;
          this.currentProperty = this.totalRevenue.properties[0];
          this.stopAutoSlide();
          this.startAutoSlide();
        } else {
          this.currentProperty = null;
          this.stopAutoSlide();
        }
        
        this.cdr.detectChanges();
      },
      (error) => {
        console.error('Error fetching total revenue:', error);
        if (error.status === 401) {
          console.log('Unauthorized access - redirecting to login.');
          this.router.navigate(['/login']);
        }
        this.cdr.detectChanges();
      }
    );
  }

  // Carousel navigation methods
  nextProperty(): void {
    if (this.totalRevenue?.properties && this.totalRevenue.properties.length > 0) {
      this.currentPropertyIndex = (this.currentPropertyIndex + 1) % this.totalRevenue.properties.length;
      this.currentProperty = this.totalRevenue.properties[this.currentPropertyIndex];
      this.cdr.detectChanges();
    }
  }

  previousProperty(): void {
    if (this.totalRevenue?.properties && this.totalRevenue.properties.length > 0) {
      this.currentPropertyIndex = this.currentPropertyIndex === 0 
        ? this.totalRevenue.properties.length - 1 
        : this.currentPropertyIndex - 1;
      this.currentProperty = this.totalRevenue.properties[this.currentPropertyIndex];
      this.cdr.detectChanges();
    }
  }

  goToProperty(index: number): void {
    if (this.totalRevenue?.properties && index >= 0 && index < this.totalRevenue.properties.length) {
      this.currentPropertyIndex = index;
      this.currentProperty = this.totalRevenue.properties[index];
      this.cdr.detectChanges();
    }
  }

  // Auto-slide functionality
  startAutoSlide(): void {
    if (isPlatformBrowser(this.platformId) && this.isAutoSliding) {
      this.stopAutoSlide();
      this.autoSlideInterval = setInterval(() => {
        this.nextProperty();
      }, 4000);
    }
  }

  stopAutoSlide(): void {
    if (this.autoSlideInterval) {
      clearInterval(this.autoSlideInterval);
      this.autoSlideInterval = null;
    }
  }

  pauseAutoSlide(): void {
    this.isAutoSliding = false;
    this.stopAutoSlide();
  }

  resumeAutoSlide(): void {
    this.isAutoSliding = true;
    this.startAutoSlide();
  }

  // Download PDF functionality - FIXED
  downloadPDF(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.totalRevenue) {
      this.snackBar.open('No data available to export', 'Close', { duration: 3000 });
      return;
    }

    // Check if pdfMake is loaded
    if (!window.pdfMake) {
      this.snackBar.open('PDF library is still loading. Please try again in a moment.', 'Close', { duration: 3000 });
      return;
    }

    try {
      // Ensure properties array exists
      const properties = this.totalRevenue.properties || [];
      
      const docDefinition: any = {
        pageSize: 'A4',
        pageOrientation: 'landscape',
        pageMargins: [40, 60, 40, 60],
        content: [
          {
            text: 'Financial Reports',
            style: 'header',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          {
            text: `Period: ${this.totalRevenue.period?.start_date || 'N/A'} to ${this.totalRevenue.period?.end_date || 'N/A'}`,
            style: 'subheader',
            alignment: 'center',
            margin: [0, 0, 0, 20]
          },
          {
            text: 'Summary',
            style: 'sectionHeader',
            margin: [0, 10, 0, 10]
          },
          {
            table: {
              widths: ['*', '*', '*', '*', '*', '*'],
              body: [
                ['Properties', 'Total Units', 'Occupied', 'Revenue', 'Expenses', 'Outstanding'],
                [
                  String(this.totalRevenue.totals?.total_properties || 0),
                  String(this.totalRevenue.totals?.total_units || 0),
                  String(this.totalRevenue.totals?.total_occupied || 0),
                  `KES ${this.formatNumber(this.totalRevenue.totals?.total_revenue || 0)}`,
                  `KES ${this.formatNumber(this.totalRevenue.totals?.total_expenses || 0)}`,
                  `KES ${this.formatNumber(this.totalRevenue.totals?.total_outstanding || 0)}`
                ]
              ]
            },
            style: 'summaryTable'
          },
          {
            text: 'Properties Details',
            style: 'sectionHeader',
            margin: [0, 20, 0, 10]
          },
          {
            table: {
              widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
              headerRows: 1,
              body: [
                ['Property', 'Units', 'Occupied', 'Vacant', 'Occupancy %', 'Revenue', 'Expenses', 'Outstanding'],
                ...properties.map((prop: any) => [
                  prop.property_name || 'N/A',
                  String(prop.units?.total || 0),
                  String(prop.units?.occupied || 0),
                  String(prop.units?.vacant || 0),
                  `${prop.units?.occupancy_rate || 0}%`,
                  `KES ${this.formatNumber(prop.financial?.revenue || 0)}`,
                  `KES ${this.formatNumber(prop.financial?.expenses || 0)}`,
                  `KES ${this.formatNumber(prop.financial?.outstanding || 0)}`
                ])
              ]
            },
            style: 'propertyTable'
          }
        ],
        styles: {
          header: {
            fontSize: 22,
            bold: true,
            color: '#667eea'
          },
          subheader: {
            fontSize: 14,
            color: '#6c757d'
          },
          sectionHeader: {
            fontSize: 16,
            bold: true,
            color: '#2c3e50'
          },
          summaryTable: {
            margin: [0, 5, 0, 15],
            fontSize: 11
          },
          propertyTable: {
            margin: [0, 5, 0, 15],
            fontSize: 9
          }
        }
      };

      window.pdfMake.createPdf(docDefinition).download(`financial_report_${new Date().getTime()}.pdf`);
      this.snackBar.open('PDF downloaded successfully', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.snackBar.open('Failed to generate PDF: ' + (error as Error).message, 'Close', { duration: 5000 });
    }
  }

  // Download Excel functionality - FIXED
  downloadExcel(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    if (!this.totalRevenue) {
      this.snackBar.open('No data available to export', 'Close', { duration: 3000 });
      return;
    }

    // Check if XLSX is loaded
    if (!window.XLSX) {
      this.snackBar.open('Excel library is still loading. Please try again in a moment.', 'Close', { duration: 3000 });
      return;
    }

    try {
      const XLSX = window.XLSX;

      // Summary sheet
      const summaryData = [
        ['Financial Reports Summary'],
        ['Period', `${this.totalRevenue.period?.start_date || 'N/A'} to ${this.totalRevenue.period?.end_date || 'N/A'}`],
        [],
        ['Metric', 'Value'],
        ['Total Properties', this.totalRevenue.totals?.total_properties || 0],
        ['Total Units', this.totalRevenue.totals?.total_units || 0],
        ['Total Occupied', this.totalRevenue.totals?.total_occupied || 0],
        ['Total Revenue', this.totalRevenue.totals?.total_revenue || 0],
        ['Total Expenses', this.totalRevenue.totals?.total_expenses || 0],
        ['Total Outstanding', this.totalRevenue.totals?.total_outstanding || 0]
      ];

      // Properties sheet
      const propertiesData = [
        ['Property Name', 'Address', 'Total Units', 'Occupied', 'Vacant', 'Occupancy Rate %', 'Revenue', 'Expenses', 'Outstanding', 'Expected Monthly', 'Active Contracts']
      ];

      const properties = this.totalRevenue.properties || [];
      properties.forEach((prop: any) => {
        propertiesData.push([
          prop.property_name || 'N/A',
          prop.address || 'N/A',
          prop.units?.total || 0,
          prop.units?.occupied || 0,
          prop.units?.vacant || 0,
          prop.units?.occupancy_rate || 0,
          prop.financial?.revenue || 0,
          prop.financial?.expenses || 0,
          prop.financial?.outstanding || 0,
          prop.financial?.expected_monthly_revenue || 0,
          prop.contracts?.active || 0
        ]);
      });

      // Create workbook
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
      const ws2 = XLSX.utils.aoa_to_sheet(propertiesData);

      XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
      XLSX.utils.book_append_sheet(wb, ws2, 'Properties');

      // Download
      XLSX.writeFile(wb, `financial_report_${new Date().getTime()}.xlsx`);
      this.snackBar.open('Excel downloaded successfully', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error generating Excel:', error);
      this.snackBar.open('Failed to generate Excel: ' + (error as Error).message, 'Close', { duration: 5000 });
    }
  }

  // Helper function to format numbers
  private formatNumber(num: number): string {
    if (num == null || isNaN(num)) return '0.00';
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}