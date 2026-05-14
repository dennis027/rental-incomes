// home.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  mobileMenuOpen = false;
  selectedRole = '';

  roles = [
    {
      id: 'admin',
      title: 'Admin',
      icon: '🛡️',
      description: 'Full control of the entire rental ecosystem from one dashboard',
      features: ['Manage all users', 'Monitor system activity', 'View analytics', 'Global settings control']
    },
    {
      id: 'landlord',
      title: 'Landlord',
      icon: '🏢',
      description: 'Easily manage properties and track rental income in real time',
      features: ['Add properties', 'Track payments', 'Income reports', 'Handle maintenance']
    },
    {
      id: 'tenant',
      title: 'Tenant',
      icon: '👤',
      description: 'Simple, transparent, and convenient renting experience',
      features: ['Pay rent online', 'Track payments', 'Submit requests', 'Receive notices']
    },
    {
      id: 'maintenance',
      title: 'Maintenance',
      icon: '🔧',
      description: 'Fast and organized issue resolution system',
      features: ['Receive tickets', 'Update progress', 'Mark resolved', 'Communicate']
    }
  ];

  features = [
    {
      icon: '📊',
      title: 'Real-time Analytics',
      description: 'Track rent collection, occupancy rates, and revenue at a glance'
    },
    {
      icon: '🔒',
      title: 'Secure Payments',
      description: 'Safe and reliable online payment processing for all transactions'
    },
    {
      icon: '⏰',
      title: 'Automated Reminders',
      description: 'Never miss a payment with smart notification systems'
    },
    {
      icon: '📱',
      title: 'Mobile Friendly',
      description: 'Manage your rentals on the go with our responsive design'
    }
  ];

  stats = [
    { number: '500+', label: 'Properties Managed' },
    { number: '2,000+', label: 'Happy Tenants' },
    { number: '98%', label: 'On-time Payments' },
    { number: '24/7', label: 'Support Available' }
  ];

  constructor(private router: Router) {}

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  selectRole(roleId: string) {
    this.selectedRole = roleId;
    // You can add navigation logic here
    console.log('Selected role:', roleId);
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }

  navigateToSignup() {
    // Navigate to signup page
    this.router.navigate(['/request-demo']);
  }

  requestDemo() {
     this.router.navigate(['/request-demo']);
  }
}