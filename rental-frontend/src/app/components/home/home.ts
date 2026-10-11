// home.component.ts
import { Component, HostListener, AfterViewInit, OnDestroy, ElementRef, PLATFORM_ID, Inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

interface RoleCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  features: string[];
}

interface FeatureCard {
  icon: string;
  title: string;
  description: string;
}

interface StatCard {
  icon: string;
  number: string;
  label: string;
  trend?: string;
  trendLabel?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements AfterViewInit, OnDestroy {
  mobileMenuOpen = false;
  selectedRole = '';
  scrolled = false;

  private io?: IntersectionObserver;
  private countersAnimated = false;
  private isBrowser: boolean;

  // Trust strip shown directly under the hero CTAs
  heroStats = [
    { number: '500+', label: 'Landlords' },
    { number: '2,000+', label: 'Tenants' },
    { number: '98%', label: 'On-time Payments' },
    { number: '24/7', label: 'Support' }
  ];

  roles: RoleCard[] = [
    {
      id: 'admin',
      icon: 'shield',
      title: 'Admin',
      description: 'Full control of the entire rental ecosystem from one dashboard.',
      features: ['Manage all users', 'Monitor system activity', 'View analytics', 'Global settings control']
    },
    {
      id: 'landlord',
      icon: 'building',
      title: 'Landlord',
      description: 'Easily manage properties and track rental income in real time.',
      features: ['Add properties', 'Track payments', 'Income reports', 'Handle maintenance']
    },
    {
      id: 'tenant',
      icon: 'user',
      title: 'Tenant',
      description: 'A simple, transparent, and convenient renting experience.',
      features: ['Pay rent online', 'Track payments', 'Submit requests', 'Receive notices']
    },
    {
      id: 'maintenance',
      icon: 'wrench',
      title: 'Maintenance',
      description: 'A fast and organized issue resolution system.',
      features: ['Receive tickets', 'Update progress', 'Mark resolved', 'Communicate']
    }
  ];

  features: FeatureCard[] = [
    { icon: 'wallet', title: 'Smart Rent Collection', description: 'Automated online rent collection with instant confirmation for every payment.' },
    { icon: 'bar-chart', title: 'Analytics Dashboard', description: 'Track occupancy, revenue, and performance across every property at a glance.' },
    { icon: 'bell', title: 'Automated Reminders', description: 'Tenants get timely nudges before rent is due, so late payments become rare.' },
    { icon: 'receipt', title: 'Digital Receipts', description: 'Every transaction generates a clean, downloadable receipt automatically.' },
    { icon: 'users', title: 'Tenant Portal', description: 'A dedicated space for tenants to pay, message, and track requests.' },
    { icon: 'file-text', title: 'Property Reports', description: 'Export detailed financial and occupancy reports in a couple of clicks.' },
    { icon: 'wrench', title: 'Maintenance Tracking', description: 'Log, assign, and resolve maintenance tickets without losing the thread.' },
    { icon: 'smartphone', title: 'Mobile Friendly', description: 'A fully responsive experience for managing rentals from any device.' }
  ];

  stats: StatCard[] = [
    { icon: 'building', number: '500', label: 'Properties Managed', trend: '+18%', trendLabel: 'this month' },
    { icon: 'users', number: '2000', label: 'Happy Tenants', trend: '+12%', trendLabel: 'this month' },
    { icon: 'check-circle', number: '98', label: 'On-time Payments', trend: '+4%', trendLabel: 'this month' },
    { icon: 'clock', number: '24', label: 'Support Availability', trendLabel: 'hours a day' }
  ];

  constructor(
    private host: ElementRef<HTMLElement>,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  @HostListener('window:scroll')
  onWindowScroll() {
    if (!this.isBrowser) return;
    this.scrolled = (window.scrollY || window.pageYOffset) > 12;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.onWindowScroll();

    this.io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');

            if (entry.target.classList.contains('stats-section') && !this.countersAnimated) {
              this.countersAnimated = true;
              this.animateCounters();
            }
          }
        });
      },
      { threshold: 0.18 }
    );

    this.host.nativeElement.querySelectorAll('.reveal, .stats-section').forEach((el) => {
      this.io?.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.io?.disconnect();
  }

  private animateCounters(): void {
    const els = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-count-to]');
    els.forEach((el) => {
      const target = parseInt(el.getAttribute('data-count-to') || '0', 10);
      const suffix = el.getAttribute('data-count-suffix') || '';
      const duration = 1400;
      const start = performance.now();

      const tick = (now: number) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target).toLocaleString() + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  selectRole(roleId: string) {
    this.selectedRole = this.selectedRole === roleId ? '' : roleId;
  }
}