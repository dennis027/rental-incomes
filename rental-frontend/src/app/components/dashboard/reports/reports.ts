import { Component, inject, ViewChild, AfterViewInit, OnInit, ChangeDetectorRef, TemplateRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PropertiesService } from '../../../services/properties';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { SharedImports } from '../../../shared-imports/imports';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { SystemParametersServices } from '../../../services/system-parameters-services';
import { ReportsService } from '../../../services/reports';

@Component({
  selector: 'app-reports',
  imports: [SharedImports],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {
  private reportsService = inject(ReportsService);
  private platformId = inject(PLATFORM_ID); // ✅ Add this

  totalRevenue: number | null = null;

  ngOnInit(): void {
    // Example usage: Fetch total revenue for a property between two dates
    const propertyId = 1; // Replace with actual property ID
    const start_date = '2024-01-01'; // Replace with actual start date
    const end_date = '2025-12-31'; // Replace with actual end date

    if (isPlatformBrowser(this.platformId)) {

    this.fetchTotalRevenue(propertyId, start_date, end_date);

      }
  }

  fetchTotalRevenue(propertyId: any, start_date: any, end_date: any): void {
    this.reportsService.getTotalRevenue(propertyId, start_date, end_date).subscribe(
      (response) => {
        this.totalRevenue = response.total_revenue;
        console.log('Total Revenue:', response);
      },
      (error) => {
        console.error('Error fetching total revenue:', error);
      }

    );
  } 


}
