
import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DashboardSummaryService, DashboardSummary, MonthlyCollection, OccupancyStats } from '../../../services/dashboard-summary-service'
import { PropertiesService } from '../../../services/properties';
import Chart from 'chart.js/auto';
import { SharedImports } from '../../../shared-imports/imports';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dash-home',
  // You need to import CommonModule if you use ngIf/ngFor in the template, 
  // but based on the class structure, it seems like a standalone component might require it.
  // Assuming a modern Angular setup, you might need to add CommonModule here 
  // if your template uses directives like *ngFor or *ngIf.
  imports: [SharedImports], 
  templateUrl: './dash-home.html',
  styleUrl: './dash-home.css'
})
// Implement the required lifecycle interfaces for clarity and type-safety
export class DashHome implements OnInit, AfterViewInit, OnDestroy { 

  private dashboardService = inject(DashboardSummaryService);
  private propertyService = inject(PropertiesService);
  private cdr = inject(ChangeDetectorRef)
  private router = inject(Router)
  
    summaryCards = [
    { label: 'Total Tenants', value: '0', icon: 'fas fa-user-friends' },
    { label: 'Occupied Units', value: '0/0', icon: 'fas fa-building' },
    { label: 'Pending Rent', value: 'KSh 0', icon: 'fas fa-money-bill-wave' },
    { label: 'Contracts Expiring', value: '0', icon: 'fas fa-file-contract' },
  ];

  properties: any[] = [];
  selectedProperty = new FormControl('');
  isLoading = false;

  private rentChart?: Chart;
  private occupancyChart?: Chart;

  ngOnInit(): void {
    this.loadProperties();
  }

  ngAfterViewInit(): void {
    // Charts will be rendered after data is loaded
  }

  ngOnDestroy(): void {
    this.rentChart?.destroy();
    this.occupancyChart?.destroy();
  }

  loadProperties(): void {
    this.propertyService.getProperties().subscribe({
      next: (res) => {
        this.properties = res;
        if (this.properties.length > 0) {
          this.selectedProperty.setValue(this.properties[0].id.toString());
          this.loadDashboardData();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading properties:', err);
       if (err.status === 401) this.router.navigate(['/login']);
      }
    });
  }

  onPropertyChange(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    const propertyId = this.selectedProperty.value || undefined;

    // Load summary
    this.dashboardService.getDashboardSummary(propertyId).subscribe({
      next: (data: DashboardSummary) => {
        this.summaryCards = [
          { label: 'Total Tenants', value: data.total_tenants.toString(), icon: 'fas fa-user-friends' },
          { label: 'Occupied Units', value: `${data.occupied_units}/${data.total_units}`, icon: 'fas fa-building' },
          { label: 'Pending Rent', value: `KSh ${data.pending_rent.toLocaleString()}`, icon: 'fas fa-money-bill-wave' },
          { label: 'Contracts Expiring', value: data.contracts_expiring.toString(), icon: 'fas fa-file-contract' },
        ];
      },
      error: (err) => console.error('Error loading summary:', err)
    });

    // Load monthly collection
    this.dashboardService.getMonthlyCollection(propertyId, 6).subscribe({
      next: (data: MonthlyCollection[]) => {
        this.renderRentChart(data);
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error loading monthly collection:', err)
    });

    // Load occupancy stats
    this.dashboardService.getOccupancyStats(propertyId).subscribe({
      next: (data: OccupancyStats) => {
        this.renderOccupancyChart(data);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading occupancy:', err);
        this.isLoading = false;
      }
    });
  }

  renderRentChart(data: MonthlyCollection[]): void {
    if (this.rentChart) {
      this.rentChart.destroy();
    }

    this.rentChart = new Chart('rentChart', {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: 'Rent Collected (KSh)',
            data: data.map(d => d.amount),
            backgroundColor: '#4e73df',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }

  renderOccupancyChart(data: OccupancyStats): void {
    if (this.occupancyChart) {
      this.occupancyChart.destroy();
    }

    this.occupancyChart = new Chart('occupancyChart', {
      type: 'doughnut',
      data: {
        labels: ['Occupied', 'Vacant'],
        datasets: [
          { 
            data: [data.occupied, data.vacant], 
            backgroundColor: ['#4e73df', '#ea2222ff'] 
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }
}
