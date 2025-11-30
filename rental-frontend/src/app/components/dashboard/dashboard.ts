
// dashboard.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit, HostListener } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';



@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
links = [
  { name: 'Dashboard', route: '/dashboard/home', icon: 'fas fa-chart-pie' },
  { name: 'Properties', route: '/dashboard/properties', icon: 'fas fa-building' },
  { name: 'Units', route: '/dashboard/units', icon: 'fas fa-building' },
  { name: 'Rental Customers', route: '/dashboard/rental-customers', icon: 'fas fa-money-bill-wave' },
  { name: 'Receipts', route: '/dashboard/receipts', icon: 'fas fa-receipt' },
  { name: 'Contracts', route: '/dashboard/contracts', icon: 'fas fa-file-signature' },
  {name: 'Expense & Maintenance', route: '/dashboard/expensesmaintain', icon: 'fas fa-tools' },
  { name: 'Payments', route: '/dashboard/payments', icon: 'fas fa-user-friends' },
  { name: 'Reports', route: '/dashboard/reports', icon: 'fas fa-cog' },
  { name: 'Settings', route: '/dashboard/settings', icon: 'fas fa-cog' },
];


  isSidebarActive = false;

  constructor(private authService : AuthService, private router:Router) {}

  ngOnInit(): void {}

  /**
   * Toggle the mobile sidebar visibility
   */
  toggleSidebar(): void {
    this.isSidebarActive = !this.isSidebarActive;
    
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    
    if (sidebar && overlay) {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    }
  
    // Toggle body scroll
    this.toggleBodyScroll();
  }

  /**
   * Close sidebar when clicking outside on mobile
   */
  closeSidebar(): void {
    if (this.isSidebarActive) {
      this.isSidebarActive = false;
      
      const sidebar = document.getElementById('sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      
      if (sidebar && overlay) {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
      }

      this.toggleBodyScroll();
    }
  }

  /**
   * Handle navigation link click
   * Close sidebar on mobile after clicking a link
   */
  onNavLinkClick(): void {
    // Close mobile sidebar after clicking on mobile devices
    if (window.innerWidth <= 992) {
      this.closeSidebar();
    }
  }

  /**
   * Listen for window resize events to handle responsive behavior
   */
  @HostListener('window:resize', ['$event'])
  onResize(event: Event): void {
    const width = (event.target as Window).innerWidth;
    
    // Auto-close sidebar on desktop view
    if (width > 992 && this.isSidebarActive) {
      this.closeSidebar();
    }
  }

  /**
   * Prevent body scroll when mobile sidebar is open
   */
  private toggleBodyScroll(): void {
    if (this.isSidebarActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }


logOut() {
  this.authService.logout().subscribe(() => {
    this.router.navigate(['/login']);
  });
}



}