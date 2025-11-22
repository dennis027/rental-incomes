import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormControl } from '@angular/forms';
import { DashboardSummaryService, DashboardSummary, MonthlyCollection, OccupancyStats } from '../../../services/dashboard-summary-service';
import { PropertiesService } from '../../../services/properties';
import Chart from 'chart.js/auto';
import { SharedImports } from '../../../shared-imports/imports';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dash-home',
  imports: [SharedImports], 
  templateUrl: './dash-home.html',
  styleUrl: './dash-home.css'
})
export class DashHome implements OnInit, AfterViewInit, OnDestroy { 

  private dashboardService = inject(DashboardSummaryService);
  private propertyService = inject(PropertiesService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID); // ✅ Add this
  
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
    // ✅ CRITICAL: Only load data in browser
    if (isPlatformBrowser(this.platformId)) {
      console.log('🔍 Dashboard running in browser');
      this.loadProperties();
    } else {
      console.log('⚠️ Dashboard running on server, skipping data load');
    }
  }

  ngAfterViewInit(): void {
    // Charts will be rendered after data is loaded
  }

  ngOnDestroy(): void {
    this.rentChart?.destroy();
    this.occupancyChart?.destroy();
  }

  loadProperties(): void {
    console.log('📡 Loading properties...');
    
    this.propertyService.getProperties().subscribe({
      next: (res) => {
        console.log('✅ Properties loaded:', res);
        this.properties = res;
        if (this.properties.length > 0) {
          this.selectedProperty.setValue(this.properties[0].id.toString());
          this.loadDashboardData();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);
        if (err.status === 401) {
          console.log('🔒 Unauthorized, redirecting to login...');
          this.router.navigate(['/login']);
        }
      }
    });
  }

  onPropertyChange(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    console.log('📊 Loading dashboard data...');
    this.isLoading = true;
    const propertyId = this.selectedProperty.value || undefined;

    // ✅ Check token before making calls
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      console.log('🔑 Token status:', token ? 'Token exists' : '❌ NO TOKEN!');
      
      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }
    }

    // Load summary
    this.dashboardService.getDashboardSummary(propertyId).subscribe({
      next: (data: DashboardSummary) => {
        console.log('✅ Summary loaded:', data);
        this.summaryCards = [
          { label: 'Total Tenants', value: data.total_tenants.toString(), icon: 'fas fa-user-friends' },
          { label: 'Occupied Units', value: `${data.occupied_units}/${data.total_units}`, icon: 'fas fa-building' },
          { label: 'Pending Rent', value: `KSh ${data.pending_rent.toLocaleString()}`, icon: 'fas fa-money-bill-wave' },
          { label: 'Contracts Expiring', value: data.contracts_expiring.toString(), icon: 'fas fa-file-contract' },
        ];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading summary:', err);
        if (err.status === 401) this.router.navigate(['/login']);
      }
    });

    // Load monthly collection
    this.dashboardService.getMonthlyCollection(propertyId, 6).subscribe({
      next: (data: MonthlyCollection[]) => {
        console.log('✅ Monthly collection loaded:', data);
        this.renderRentChart(data);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading monthly collection:', err);
        if (err.status === 401) this.router.navigate(['/login']);
      }
    });

    // Load occupancy stats
    this.dashboardService.getOccupancyStats(propertyId).subscribe({
      next: (data: OccupancyStats) => {
        console.log('✅ Occupancy loaded:', data);
        this.renderOccupancyChart(data);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading occupancy:', err);
        if (err.status === 401) this.router.navigate(['/login']);
        this.isLoading = false;
      }
    });
  }

  renderRentChart(data: MonthlyCollection[]): void {
    // ✅ Only render charts in browser
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.rentChart) {
      this.rentChart.destroy();
    }

    const canvas = document.getElementById('rentChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('⚠️ rentChart canvas not found');
      return;
    }

    this.rentChart = new Chart(canvas, {
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
    // ✅ Only render charts in browser
    if (!isPlatformBrowser(this.platformId)) return;

    if (this.occupancyChart) {
      this.occupancyChart.destroy();
    }

    const canvas = document.getElementById('occupancyChart') as HTMLCanvasElement;
    if (!canvas) {
      console.warn('⚠️ occupancyChart canvas not found');
      return;
    }

    this.occupancyChart = new Chart(canvas, {
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