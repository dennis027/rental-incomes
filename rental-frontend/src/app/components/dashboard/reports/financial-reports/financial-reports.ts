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
    }
    this.initializeForms();
  }

  ngOnDestroy(): void {
    this.stopAutoSlide();
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

      // Initialize carousel safely after change detection
      if (this.totalRevenue?.properties?.length > 0) {
        // Use setTimeout to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.currentPropertyIndex = 0;
          this.currentProperty = this.totalRevenue.properties[0];

          // Start auto-slide for carousel
          this.startAutoSlide();

          // Trigger change detection safely
          this.cdr.detectChanges();
        });
      } else {
        // No properties found, ensure currentProperty is null
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
        
        // Reset carousel to first property after search
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
      }, 4000); // Slide every 4 seconds
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

  // Download PDF functionality
  downloadPDF(): void {
    if (!this.totalRevenue) {
      this.snackBar.open('No data available to export', 'Close', { duration: 3000 });
      return;
    }

    try {
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
                  this.totalRevenue.totals?.total_properties || 0,
                  this.totalRevenue.totals?.total_units || 0,
                  this.totalRevenue.totals?.total_occupied || 0,
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
                ...this.totalRevenue.properties?.map((prop: any) => [
                  prop.property_name || 'N/A',
                  prop.units?.total || 0,
                  prop.units?.occupied || 0,
                  prop.units?.vacant || 0,
                  `${prop.units?.occupancy_rate || 0}%`,
                  `KES ${this.formatNumber(prop.financial?.revenue || 0)}`,
                  `KES ${this.formatNumber(prop.financial?.expenses || 0)}`,
                  `KES ${this.formatNumber(prop.financial?.outstanding || 0)}`
                ]) || []
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

      this.cdr.detectChanges();

      // Using pdfmake
      if (typeof window !== 'undefined' && (window as any).pdfMake) {
        (window as any).pdfMake.createPdf(docDefinition).download(`financial_report_${new Date().getTime()}.pdf`);
        this.snackBar.open('PDF downloaded successfully', 'Close', { duration: 3000 });
      } else {
        console.error('pdfMake library not loaded');
        this.snackBar.open('PDF export failed. Library not loaded.', 'Close', { duration: 3000 });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      this.snackBar.open('Failed to generate PDF', 'Close', { duration: 3000 });
    }
  }

  // Download Excel functionality
  downloadExcel(): void {
    if (!this.totalRevenue) {
      this.snackBar.open('No data available to export', 'Close', { duration: 3000 });
      return;
    }

    try {
      // Using XLSX library
      if (typeof window !== 'undefined' && (window as any).XLSX) {
        const XLSX = (window as any).XLSX;

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

        this.totalRevenue.properties?.forEach((prop: any) => {
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
      } else {
        console.error('XLSX library not loaded');
        this.snackBar.open('Excel export failed. Library not loaded.', 'Close', { duration: 3000 });
      }
    } catch (error) {
      console.error('Error generating Excel:', error);
      this.snackBar.open('Failed to generate Excel', 'Close', { duration: 3000 });
    }
  }

  // Helper function to format numbers
  private formatNumber(num: number): string {
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}