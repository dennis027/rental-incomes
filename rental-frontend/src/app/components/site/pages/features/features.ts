import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteIcon } from '../../site-icon';

interface FeatureGroup {
  id: string;
  icon: string;
  title: string;
  summary: string;
  points: string[];
}

@Component({
  selector: 'app-features-page',
  standalone: true,
  imports: [RouterLink, SiteIcon],
  templateUrl: './features.html',
})
export class FeaturesPage {
  // Everything listed here exists in the app today
  groups: FeatureGroup[] = [
    {
      id: 'properties',
      icon: 'building',
      title: 'Properties & units',
      summary: 'Every building and every door, with who is in it and what they owe.',
      points: [
        'Any number of properties, each with its own units, rent and billing rules',
        'Unit types from singles and bedsitters to five-bedroom units, with occupied / vacant status',
        'Per-unit history of tenants, invoices and payments',
        'Occupancy and income at a glance on the dashboard',
      ],
    },
    {
      id: 'tenants',
      icon: 'users',
      title: 'Tenants & contracts',
      summary: 'Leases that know their own deposits, dates and rent frequency.',
      points: [
        'Tenant records with phone, ID number and ID photos (visible only to signed-in staff)',
        'Rent charged monthly, quarterly or yearly per contract',
        'Rent, electricity and water deposits recorded on the first invoice',
        'A list of contracts ending soon so renewals are never missed',
      ],
    },
    {
      id: 'billing',
      icon: 'file-text',
      title: 'Invoices & utilities',
      summary: 'One click bills the whole building for rent and meter readings.',
      points: [
        'Monthly invoices generated for every occupied unit at once',
        'Water and electricity billed from meter readings at your unit cost',
        'Optional service charge per property',
        'Late-payment penalty after a grace period you set per property',
        'Printable invoice and receipt documents',
      ],
    },
    {
      id: 'mpesa',
      icon: 'smartphone',
      title: 'M-Pesa paybill',
      summary: 'Tenants pay to your paybill; the system finds the right invoice.',
      points: [
        'Payments confirmed by Safaricom are matched to the invoice automatically',
        'Anything it cannot match waits in a Paybill inbox for you to assign',
        'Cash and bank transfers recorded alongside M-Pesa',
        'A receipt for every payment, with the balance carried forward',
      ],
    },
    {
      id: 'arrears',
      icon: 'alert',
      title: 'Arrears & statements',
      summary: 'Know exactly who owes what, and for how long.',
      points: [
        'Arrears list with the amount and age of every debt',
        'Ageing buckets (0–30, 31–60, 61–90, 90+ days)',
        'Full tenant statements: every charge and payment with a running balance',
        'Move-out settlement that offsets the deposit against what is owed',
      ],
    },
    {
      id: 'expenses',
      icon: 'wrench',
      title: 'Expenses & maintenance',
      summary: 'Money going out, tracked as carefully as money coming in.',
      points: [
        'Property expenses by category',
        'Maintenance requests per unit with status from reported to resolved',
        'Repair costs recorded against the request',
        'Profit and loss per property, with expenses included',
      ],
    },
    {
      id: 'reports',
      icon: 'bar-chart',
      title: 'Reports',
      summary: 'Over 30 reports covering money, occupancy, tenants and utilities.',
      points: [
        'Revenue, collections, outstanding balances, profit and loss',
        'Occupancy rate, vacancy duration, unit performance and rent pricing',
        'Tenant directory, payment history, retention and new tenants',
        'Utility consumption and revenue, maintenance requests and costs',
      ],
    },
    {
      id: 'everyday',
      icon: 'search',
      title: 'Made for everyday use',
      summary: 'Quick to learn, quick to use, on any screen.',
      points: [
        'Search anything from anywhere with Ctrl / ⌘ + K',
        'A getting-started checklist for new accounts',
        'Light and dark mode',
        'Works on phones, tablets and computers, no app to install',
      ],
    },
  ];
}
