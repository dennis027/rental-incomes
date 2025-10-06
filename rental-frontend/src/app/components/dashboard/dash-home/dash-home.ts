import { Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import Chart from 'chart.js/auto';

@Component({
  selector: 'app-dash-home',
  // You need to import CommonModule if you use ngIf/ngFor in the template, 
  // but based on the class structure, it seems like a standalone component might require it.
  // Assuming a modern Angular setup, you might need to add CommonModule here 
  // if your template uses directives like *ngFor or *ngIf.
  imports: [], 
  templateUrl: './dash-home.html',
  styleUrl: './dash-home.css'
})
// Implement the required lifecycle interfaces for clarity and type-safety
export class DashHome implements OnInit, AfterViewInit, OnDestroy { 
  summaryCards = [
    { label: 'Total Tenants', value: 24, icon: 'fas fa-user-friends' },
    { label: 'Occupied Units', value: 18, icon: 'fas fa-building' },
    { label: 'Pending Rent', value: 'KSh 42,000', icon: 'fas fa-money-bill-wave' },
    { label: 'Contracts Expiring', value: 3, icon: 'fas fa-file-contract' },
  ];

  private rentChart?: Chart;
  private occupancyChart?: Chart;

  // ngOnInit is used for initialization logic that doesn't rely on the view
  ngOnInit(): void {
    // Keep this empty or use it for data fetching/initial variable setup
  }

  // This hook is called *after* Angular initializes the component's view 
  // and child views—this is the correct place to interact with the canvas elements.
  ngAfterViewInit(): void {
    // Since the view is ready, we can safely call renderCharts without a setTimeout
    this.renderCharts();
  }

  ngOnDestroy(): void {
    // Clean up charts when component is destroyed
    this.rentChart?.destroy();
    this.occupancyChart?.destroy();
  }

  renderCharts() {
    // The previous checks and destruction logic inside ngOnInit and renderCharts are
    // now redundant for the initial load because we are using ngAfterViewInit,
    // which runs only once after the view is initialized.

    // If you were calling renderCharts outside of the initial load (e.g., from a button click),
    // you would keep the destroy checks. For this setup, we keep the destroy checks
    // just in case it's called again for some reason, ensuring Chart.js doesn't error.
    if (this.rentChart) {
      this.rentChart.destroy();
    }
    if (this.occupancyChart) {
      this.occupancyChart.destroy();
    }
    
    // Create the charts using the ID of the canvas element in the template
    this.rentChart = new Chart('rentChart', {
      type: 'bar',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Rent Collected (KSh)',
            data: [42000, 53000, 48000, 60000, 55000, 63000],
            backgroundColor: '#4e73df',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    this.occupancyChart = new Chart('occupancyChart', {
      type: 'doughnut',
      data: {
        labels: ['Occupied', 'Vacant'],
        datasets: [
          { data: [75, 25], backgroundColor: ['#4e73df', '#ea2222ff'] },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }
}