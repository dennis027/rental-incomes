
// dashboard.component.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, OnInit, HostListener, Inject, PLATFORM_ID, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { MatMenuModule } from '@angular/material/menu';
import { PropertyContext } from '../../services/property-context';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, MatMenuModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard {
// Listed in the order a landlord works through them
links = [
  { name: 'Dashboard',  route: '/dashboard/home',              icon: 'fas fa-chart-pie',      group: 'Overview',
    hint: 'A summary of your tenants, occupancy and rent collection.' },
  { name: 'Properties', route: '/dashboard/properties',        icon: 'fas fa-building',       group: 'Set up',
    hint: 'Start here. A property is a building or plot you manage; everything else belongs to one.' },
  { name: 'Units',      route: '/dashboard/units',             icon: 'fas fa-door-open',      group: 'Set up',
    hint: 'Units are the houses, rooms or shops you rent out inside a property. Add a property first.' },
  { name: 'Tenants',    route: '/dashboard/rental-customers',  icon: 'fas fa-users',          group: 'Set up',
    hint: 'The people who rent from you. Register a tenant before giving them a contract.' },
  { name: 'Contracts',  route: '/dashboard/contracts',         icon: 'fas fa-file-signature', group: 'Rent',
    hint: 'A contract puts a tenant in a unit and sets the rent. You need a unit and a tenant first.' },
  { name: 'Invoices',   route: '/dashboard/receipts',          icon: 'fas fa-file-invoice',   group: 'Rent',
    hint: 'Invoices are the monthly rent bills. Generate them each month for your active contracts.' },
  { name: 'Payments',   route: '/dashboard/payments',          icon: 'fas fa-credit-card',    group: 'Rent',
    hint: 'Money received from tenants and money paid out. Every payment received has a receipt you can print.' },
  { name: 'Arrears',    route: '/dashboard/arrears',           icon: 'fas fa-triangle-exclamation', group: 'Rent',
    hint: 'Tenants with unpaid rent, how long it has been owing, and the quickest way to collect or remind them.' },
  { name: 'Expenses & Maintenance', route: '/dashboard/expensesmaintain', icon: 'fas fa-wrench', group: 'Manage',
    hint: 'Track what you spend on a property and the repair requests for its units.' },
  { name: 'Reports',    route: '/dashboard/reports',           icon: 'fas fa-chart-bar',      group: 'Manage',
    hint: 'Income, occupancy and tenant reports you can export to PDF or Excel.' },
  { name: 'Settings',   route: '/dashboard/settings',          icon: 'fas fa-sliders-h',      group: 'Manage',
    hint: 'Billing rules for a property: deposits, penalties and which charges appear on receipts.' },
  // Opened from Tenants and Arrears, so it has a title and tip but no sidebar entry
  { name: 'Tenant statement', route: '/dashboard/statement',   icon: 'fas fa-file-lines',     group: '',
    hint: 'Every invoice and payment of one tenant in date order. Print it or send the balance on WhatsApp.' },
];

  // Sidebar sections, in display order
  groups = ['Overview', 'Set up', 'Rent', 'Manage'].map(name => ({
    name,
    links: this.links.filter(link => link.group === name)
  }));

  // The set-up and rent pages form one chain; this is what the "Next" link follows
  private flow = ['Properties', 'Units', 'Tenants', 'Contracts', 'Invoices', 'Payments'];

  showTips = true;

  isSidebarActive = false;

  constructor(private authService : AuthService, private router:Router, @Inject(PLATFORM_ID) private platformId: Object) {}

  // The property every page works in, chosen from the top bar
  propertyContext = inject(PropertyContext);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.showTips = localStorage.getItem('page_tips_hidden') !== '1';
      this.propertyContext.load();
    }
  }

  /**
   * Name of the section currently open, shown in the top bar
   */
  get currentLink() {
    return this.links.find(link => this.router.url.startsWith(link.route)) ?? this.links[0];
  }

  get currentTitle(): string {
    return this.currentLink.name;
  }

  /**
   * Position of the current page in the set-up chain (0 when it is not part of it)
   */
  get currentStep(): number {
    return this.flow.indexOf(this.currentLink.name) + 1;
  }

  get flowLength(): number {
    return this.flow.length;
  }

  /**
   * The page that follows the current one in the set-up chain, if any
   */
  get nextLink() {
    const nextName = this.flow[this.currentStep];
    return this.currentStep > 0 && nextName ? this.links.find(link => link.name === nextName) : undefined;
  }

  toggleTips(): void {
    this.showTips = !this.showTips;
    localStorage.setItem('page_tips_hidden', this.showTips ? '0' : '1');
    if (this.showTips) {
      localStorage.removeItem('getting_started_hidden');
    }
  }

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
  // The tokens are cleared at once, so leave without waiting for the server
  this.authService.logout().subscribe({ error: () => {} });
  this.router.navigate(['/login']);
}

}
