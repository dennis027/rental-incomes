import { Logo } from '../../shared/logo';

// dashboard.component.ts
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { rememberPath } from '../../services/return-path';
import { ChangeDetectorRef, Component, OnInit, OnDestroy, HostListener, Inject, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { MatMenuModule } from '@angular/material/menu';
import { PropertyContext } from '../../services/property-context';
import { ThemeService, ThemePreference } from '../../services/theme';
import { MatDialog } from '@angular/material/dialog';
import { NotificationsService } from '../../services/notifications';
import { openSearchPalette } from './search-palette/search-palette';
import { Shortcut, openShortcuts as showShortcuts } from './shortcuts/shortcuts-dialog';
import { openIdleDialog } from './idle/idle-dialog';
import { AccountService, ROLE_OPTIONS, Role, currentRole, homeFor, rememberRole, roleCanOpen } from '../../services/account';

// Last activity in any tab, and how long the dashboard may sit unused
const ACTIVITY_KEY = 'last_activity';
const IDLE_LIMIT_MS = 30 * 60 * 1000;

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, MatMenuModule, Logo],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class Dashboard implements OnInit, OnDestroy {
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
  { name: 'Team & account', route: '/dashboard/team',          icon: 'fas fa-user-group',     group: 'Manage',
    hint: 'Who can sign in to your account and what each person may do, plus SMS reminders and your paybill link.' },
  // Opened from Tenants and Arrears, so it has a title and tip but no sidebar entry
  { name: 'Tenant statement', route: '/dashboard/statement',   icon: 'fas fa-file-lines',     group: '',
    hint: 'Every invoice and payment of one tenant in date order. Print it or send the balance on WhatsApp.' },
];

  // What the signed-in user's role may open
  role = currentRole();

  // Sidebar sections, in display order, with only the pages this role can open
  groups = this.buildGroups();

  private buildGroups() {
    return ['Overview', 'Set up', 'Rent', 'Manage'].map(name => ({
      name,
      links: this.links.filter(link => link.group === name && roleCanOpen(this.role, link.route))
    })).filter(group => group.links.length > 0);
  }

  private accountService = inject(AccountService);
  private cdr = inject(ChangeDetectorRef);

  /**
   * The role is saved at sign-in, so a session from before roles existed, or
   * someone whose role an owner has since changed, would see the wrong pages.
   * Ask the server, and follow it.
   */
  @HostListener('window:focus')
  refreshRole(): void {
    if (!isPlatformBrowser(this.platformId) || !this.authService.hasSession()) {
      return;
    }
    this.accountService.me().subscribe({
      next: me => {
        if (me.account?.name) {
          this.accountName = me.account.name;
          localStorage.setItem('account_name', me.account.name);
        }
        rememberRole(me.role as Role);
        if (me.role === this.role) {
          this.cdr.markForCheck();
          return;
        }
        this.role = me.role as Role;
        this.groups = this.buildGroups();
        if (!roleCanOpen(this.role, this.router.url)) {
          this.router.navigate([homeFor(this.role)]);
        }
        this.cdr.markForCheck();
      },
      // Offline or signed out: the session check deals with it
      error: () => {},
    });
  }

  // The set-up and rent pages form one chain; this is what the "Next" link follows
  private flow = ['Properties', 'Units', 'Tenants', 'Contracts', 'Invoices', 'Payments'];

  showTips = true;

  isSidebarActive = false;

  constructor(private authService : AuthService, private router:Router, @Inject(PLATFORM_ID) private platformId: Object) {}

  // The property every page works in, chosen from the top bar
  propertyContext = inject(PropertyContext);

  theme = inject(ThemeService);
  themeOptions: { value: ThemePreference; label: string; icon: string }[] = [
    { value: 'light', label: 'Light', icon: 'fas fa-sun' },
    { value: 'dark', label: 'Dark', icon: 'fas fa-moon' },
    { value: 'system', label: 'Auto', icon: 'fas fa-circle-half-stroke' },
  ];

  notifications = inject(NotificationsService);
  private dialog = inject(MatDialog);

  // The bell follows the property chosen in the top bar
  private notificationSync = effect(() => {
    const propertyId = this.propertyContext.selectedId();
    untracked(() => this.notifications.load(propertyId));
  });

  // Desktop only: the sidebar shrinks to its icons
  collapsed = false;

  userName = 'Account';
  userEmail = '';
  accountName = '';

  get roleLabel(): string {
    return ROLE_OPTIONS.find(option => option.value === this.role)?.label ?? '';
  }

  get canOpenTeam(): boolean {
    return roleCanOpen(this.role, '/dashboard/team');
  }

  get userInitials(): string {
    return this.userName.replace(/[^A-Za-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'A';
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.showTips = localStorage.getItem('page_tips_hidden') !== '1';
      this.collapsed = localStorage.getItem('sidebar_collapsed') === '1';
      this.userName = localStorage.getItem('user_full_name') || localStorage.getItem('user_name') || 'Account';
      this.accountName = localStorage.getItem('account_name') || '';
      this.userEmail = localStorage.getItem('user_email') || '';
      this.propertyContext.load();
      // The guard only runs on navigation, so a tab left open would keep
      // showing data after the session ran out
      this.noteActivity(true);
      this.refreshRole();
      this.sessionTimer = setInterval(() => this.checkSession(), 30_000);
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.sessionTimer);
  }

  private sessionTimer?: ReturnType<typeof setInterval>;

  /** Back to the login page once neither token can be used any more */
  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  checkSession(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    if (!this.authService.hasSession()) {
      this.authService.expireSession();
      return;
    }
    // Signed out after a stretch without activity in any tab, so an
    // unattended office computer does not stay open on tenants' details
    if (this.idle() && !this.dialog.getDialogById('idle')) {
      this.dialog.closeAll();
      openIdleDialog(this.dialog, { stillIdle: () => this.idle() }).subscribe(stay => {
        if (stay) {
          this.noteActivity(true);
        } else {
          this.authService.expireSession();
        }
      });
    }
  }

  /** No activity in any tab for the idle limit */
  private idle(): boolean {
    let last: string | null = null;
    try {
      last = localStorage.getItem(ACTIVITY_KEY);
    } catch {
      return false;
    }
    return Date.now() - Number(last || Date.now()) > IDLE_LIMIT_MS;
  }

  /** Remembers the last mouse, key or touch use; shared by every open tab */
  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  @HostListener('document:click')
  @HostListener('document:wheel')
  @HostListener('document:touchstart')
  noteActivity(force = false): void {
    const now = Date.now();
    // Writing on every mouse move would be wasteful; once every few seconds is plenty
    if (!force && now - this.lastActivityWrite < 5_000) {
      return;
    }
    this.lastActivityWrite = now;
    try {
      localStorage.setItem(ACTIVITY_KEY, String(now));
    } catch {
      // Storage blocked: the idle check simply never fires
    }
  }

  private lastActivityWrite = 0;

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

  toggleCollapsed(): void {
    this.collapsed = !this.collapsed;
    localStorage.setItem('sidebar_collapsed', this.collapsed ? '1' : '0');
  }

  refreshNotifications(): void {
    this.notifications.load(this.propertyContext.selectedId());
  }

  openSearch(): void {
    openSearchPalette(this.dialog, this.links.filter(link => link.group && roleCanOpen(this.role, link.route)));
  }

  // "g" then a letter opens a page, like many web apps
  private goKeys: Record<string, string> = {
    d: '/dashboard/home', p: '/dashboard/properties', u: '/dashboard/units', t: '/dashboard/rental-customers',
    c: '/dashboard/contracts', i: '/dashboard/receipts', m: '/dashboard/payments', a: '/dashboard/arrears',
    e: '/dashboard/expensesmaintain', r: '/dashboard/reports', s: '/dashboard/settings',
  };
  private goPressedAt = 0;

  get shortcuts(): Shortcut[] {
    const pages = Object.entries(this.goKeys)
      .filter(([, route]) => roleCanOpen(this.role, route))
      .map(([key, route]) => ({ keys: ['G', key.toUpperCase()], label: `Go to ${this.links.find(l => l.route === route)?.name ?? route}` }));
    return [
      { keys: ['Ctrl', 'K'], label: 'Search tenants, units and invoices', together: true },
      { keys: ['?'], label: 'Show these shortcuts' },
      ...pages,
    ];
  }

  openShortcuts(): void {
    showShortcuts(this.dialog, this.shortcuts);
  }

  @HostListener('document:keydown', ['$event'])
  onShortcut(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.openSearch();
      return;
    }
    // Leave typing alone: fields, editable text and open dialogs keep their keys
    const target = event.target as HTMLElement | null;
    if (event.ctrlKey || event.metaKey || event.altKey || this.dialog.openDialogs.length ||
        (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === '?') {
      event.preventDefault();
      this.openShortcuts();
    } else if (key === 'g') {
      this.goPressedAt = Date.now();
    } else if (Date.now() - this.goPressedAt < 1500 && this.goKeys[key]) {
      this.goPressedAt = 0;
      const route = this.goKeys[key];
      if (roleCanOpen(this.role, route)) {
        event.preventDefault();
        this.router.navigateByUrl(route);
      }
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
  // Signing in again opens the page the user left from
  rememberPath(this.router.url);
  this.router.navigate(['/login']);
}

}
