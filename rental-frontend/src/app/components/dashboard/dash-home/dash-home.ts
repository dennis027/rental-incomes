import { PropertyContext } from '../../../services/property-context';
import { Component, OnInit, OnDestroy, AfterViewInit, inject, ChangeDetectorRef, PLATFORM_ID, effect, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormControl } from '@angular/forms';
import { DashboardSummaryService, DashboardSummary, MonthlyCollection, OccupancyStats, PaymentMethodsBreakdown, RevenueExpense } from '../../../services/dashboard-summary-service';
import { PropertiesService } from '../../../services/properties';
import Chart from 'chart.js/auto';
import { SharedImports } from '../../../shared-imports/imports';
import { Router, RouterLink } from '@angular/router';
import { GettingStarted } from '../getting-started/getting-started';
import { ContractsEndingSoon } from '../contracts-ending-soon/contracts-ending-soon';

@Component({
  selector: 'app-dash-home',
  imports: [SharedImports, GettingStarted, RouterLink, ContractsEndingSoon],
  templateUrl: './dash-home.html',
  styleUrl: './dash-home.css'
})
export class DashHome implements OnInit, AfterViewInit, OnDestroy { 

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
    this.selectedProperty.setValue(String(propertyId));
    this.onPropertyChange();
  }

  private dashboardService = inject(DashboardSummaryService);
  private propertyService = inject(PropertiesService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID); // ✅ Add this
  
  // Headline figures; `shown` is what is on screen while the number counts up
  stats = [
    { key: 'tenants',  label: 'Total Tenants',      icon: 'fas fa-user-friends',    tone: 'blue',   value: 0, shown: 0, caption: 'people renting from you' },
    { key: 'occupied', label: 'Occupied Units',     icon: 'fas fa-building',        tone: 'purple', value: 0, shown: 0, caption: 'of 0 units' },
    { key: 'pending',  label: 'Pending Rent',       icon: 'fas fa-money-bill-wave', tone: 'pink',   value: 0, shown: 0, caption: 'still to collect' },
    { key: 'expiring', label: 'Contracts Expiring', icon: 'fas fa-file-contract',   tone: 'navy',   value: 0, shown: 0, caption: 'ending soon' },
  ];

  quickActions = [
    { label: 'Add tenant',        icon: 'fas fa-user-plus',          route: '/dashboard/rental-customers' },
    { label: 'Generate invoices', icon: 'fas fa-file-invoice',       route: '/dashboard/receipts' },
    { label: 'Record payment',    icon: 'fas fa-hand-holding-dollar', route: '/dashboard/payments', query: { record: 1 } },
  ];

  greeting = 'Welcome back';
  today = new Date();
  collectedThisMonth = 0;
  collectedShown = 0;
  occupancyRate = 0;
  hasRentData = false;
  hasOccupancyData = false;
  hasTrendData = false;
  paymentMethods = [
    { label: 'M-Pesa', tone: 'purple', amount: 0, share: 0 },
    { label: 'Cash',   tone: 'blue',   amount: 0, share: 0 },
    { label: 'Bank',   tone: 'pink',   amount: 0, share: 0 },
  ];
  paymentsTotal = 0;

  properties: any[] = [];
  selectedProperty = new FormControl('');
  isLoading = false;

  private rentChart?: Chart;
  private occupancyChart?: Chart;
  private trendChart?: Chart;
  private countFrame?: number;

  ngOnInit(): void {
    // ✅ CRITICAL: Only load data in browser
    if (isPlatformBrowser(this.platformId)) {
      Chart.defaults.font.family = "'Outfit', sans-serif";
      const hour = new Date().getHours();
      this.greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
      this.loadProperties();
    } else {
    }
  }

  ngAfterViewInit(): void {
    // Charts will be rendered after data is loaded
  }

  ngOnDestroy(): void {
    this.rentChart?.destroy();
    this.occupancyChart?.destroy();
    this.trendChart?.destroy();
    if (this.countFrame) {
      cancelAnimationFrame(this.countFrame);
    }
  }

  loadProperties(): void {
    
    this.propertyService.getProperties().subscribe({
      next: (res) => {
        this.properties = res;
        if (this.properties.length > 0) {
          this.selectedProperty.setValue(String(this.propertyContext.resolve(this.properties)));
          this.loadDashboardData();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading properties:', err);
        if (err.status === 401) {
          this.router.navigate(['/login']);
        }
      }
    });
  }

  onPropertyChange(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    this.isLoading = true;
    const propertyId = this.selectedProperty.value || undefined;

    // ✅ Check token before making calls
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        console.error('❌ No access token found, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }
    }

    // Load summary
    this.dashboardService.getDashboardSummary(propertyId).subscribe({
      next: (data: DashboardSummary) => {
        this.setStat('tenants', data.total_tenants);
        this.setStat('occupied', data.occupied_units, `of ${data.total_units ?? 0} units`);
        this.setStat('pending', data.pending_rent);
        this.setStat('expiring', data.contracts_expiring);
        this.collectedThisMonth = Number(data.monthly_collection ?? 0);
        this.occupancyRate = Math.round(Number(data.occupancy_rate ?? 0));
        this.countUp();
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

    // Revenue against expenses
    this.dashboardService.getRevenueVsExpenses(propertyId, 6).subscribe({
      next: (data: RevenueExpense[]) => {
        this.renderTrendChart(data ?? []);
        this.cdr.detectChanges();
      },
      error: () => {}
    });

    // How tenants pay
    this.dashboardService.getPaymentMethodsBreakdown(propertyId).subscribe({
      next: (data: PaymentMethodsBreakdown) => {
        const amounts = [Number(data?.mpesa ?? 0), Number(data?.cash ?? 0), Number(data?.bank ?? 0)];
        this.paymentsTotal = amounts.reduce((sum, amount) => sum + amount, 0);
        this.paymentMethods = this.paymentMethods.map((method, i) => ({
          ...method,
          amount: amounts[i],
          share: this.paymentsTotal > 0 ? Math.round((amounts[i] / this.paymentsTotal) * 100) : 0
        }));
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  private setStat(key: string, value: any, caption?: string): void {
    const stat = this.stats.find(item => item.key === key);
    if (stat) {
      stat.value = Number(value ?? 0);
      if (caption) {
        stat.caption = caption;
      }
    }
  }

  /** Roll every headline number up from zero */
  private countUp(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduceMotion ? 0 : 900;
    const start = performance.now();

    const step = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      this.stats.forEach(stat => (stat.shown = Math.round(stat.value * eased)));
      this.collectedShown = Math.round(this.collectedThisMonth * eased);
      this.cdr.detectChanges();
      if (progress < 1) {
        this.countFrame = requestAnimationFrame(step);
      }
    };
    this.countFrame = requestAnimationFrame(step);
  }

  private canvas(id: string): HTMLCanvasElement | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return document.getElementById(id) as HTMLCanvasElement | null;
  }

  private gradient(canvas: HTMLCanvasElement, from: string, to: string): CanvasGradient | string {
    const ctx = canvas.getContext('2d');
    if (!ctx) return from;
    const fill = ctx.createLinearGradient(0, 0, 0, 280);
    fill.addColorStop(0, from);
    fill.addColorStop(1, to);
    return fill;
  }

  private money(value: any): string {
    return `KSh ${Number(value ?? 0).toLocaleString()}`;
  }

  renderRentChart(data: MonthlyCollection[]): void {
    this.hasRentData = data.some(d => Number(d.amount) > 0);
    const canvas = this.canvas('rentChart');
    if (!canvas) return;

    this.rentChart?.destroy();
    this.rentChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: 'Rent collected',
            data: data.map(d => d.amount),
            backgroundColor: this.gradient(canvas, '#7e33e0', '#465fff'),
            hoverBackgroundColor: '#fb2e86',
            borderRadius: 8,
            borderSkipped: false,
            maxBarThickness: 44,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => this.money(item.parsed.y) } },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#667085' } },
          y: { beginAtZero: true, grid: { color: '#f2f4f7' }, border: { display: false }, ticks: { color: '#98a2b3' } },
        },
      },
    });
  }

  renderOccupancyChart(data: OccupancyStats): void {
    const occupied = Number(data?.occupied ?? 0);
    const vacant = Number(data?.vacant ?? 0);
    this.hasOccupancyData = occupied + vacant > 0;
    if (this.hasOccupancyData) {
      this.occupancyRate = Math.round((occupied / (occupied + vacant)) * 100);
    }

    const canvas = this.canvas('occupancyChart');
    if (!canvas) return;

    this.occupancyChart?.destroy();
    this.occupancyChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Occupied', 'Vacant'],
        datasets: [
          {
            data: this.hasOccupancyData ? [occupied, vacant] : [0, 1],
            backgroundColor: ['#7e33e0', '#ece9fb'],
            hoverBackgroundColor: ['#fb2e86', '#ddd6fb'],
            borderWidth: 0,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        animation: { duration: 1100, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: this.hasOccupancyData },
        },
      },
    });
  }

  renderTrendChart(data: RevenueExpense[]): void {
    this.hasTrendData = data.some(d => Number(d.revenue) > 0 || Number(d.expenses) > 0);
    const canvas = this.canvas('trendChart');
    if (!canvas) return;

    this.trendChart?.destroy();
    this.trendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map(d => d.month),
        datasets: [
          {
            label: 'Revenue',
            data: data.map(d => d.revenue),
            borderColor: '#465fff',
            backgroundColor: this.gradient(canvas, 'rgba(70, 95, 255, 0.28)', 'rgba(70, 95, 255, 0)'),
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2.5,
          },
          {
            label: 'Expenses',
            data: data.map(d => d.expenses),
            borderColor: '#fb2e86',
            backgroundColor: this.gradient(canvas, 'rgba(251, 46, 134, 0.18)', 'rgba(251, 46, 134, 0)'),
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6,
            borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 1100, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: item => `${item.dataset.label}: ${this.money(item.parsed.y)}` } },
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#667085' } },
          y: { beginAtZero: true, grid: { color: '#f2f4f7' }, border: { display: false }, ticks: { color: '#98a2b3' } },
        },
      },
    });
  }
}
