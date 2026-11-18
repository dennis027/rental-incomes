import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteIcon } from '../../site-icon';

interface RoadmapItem {
  icon: string;
  title: string;
  summary: string;
}

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
        'Send a pay-now prompt to the tenant\'s phone; they enter their PIN and it is recorded',
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
        'Automatic SMS reminders before rent is due and while it is overdue',
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
        'KRA Monthly Rental Income tax worked out each month, ready for eRITS',
      ],
    },
    {
      id: 'team',
      icon: 'users',
      title: 'Team & roles',
      summary: 'Bring in your caretaker and accountant without handing over everything.',
      points: [
        'Owner, property manager, accountant and caretaker roles',
        'Caretakers see units, tenants and repairs, never the money',
        'Accountants record invoices, payments and expenses',
        'Each landlord\'s data is kept completely separate',
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

  // Not built yet: shown under "Coming soon", never as part of the list above
  roadmap: RoadmapItem[] = [
    { icon: 'smartphone', title: 'Tenant portal',
      summary: 'Tenants see their invoices and receipts, pay, and report repairs with photos from their phone.' },
    { icon: 'bar-chart', title: 'Owner portal & statements',
      summary: 'Monthly statements for the owners whose buildings you manage, including landlords abroad.' },
    { icon: 'file-text', title: 'E-signed leases',
      summary: 'Lease templates that tenants sign online, filed with the contract.' },
    { icon: 'door', title: 'Vacancy listings',
      summary: 'Advertise empty units and take applications online, straight into your tenant list.' },
    { icon: 'shield', title: 'Tenant screening',
      summary: 'ID, employer and previous-landlord checks recorded before you hand over the keys.' },
    { icon: 'key', title: 'Visitor log',
      summary: 'Guards record visitors at the gate, linked to the unit they came to see.' },
    { icon: 'wrench', title: 'Caretaker app',
      summary: 'Repairs closed with before-and-after photos, and petty cash accounted for shilling by shilling.' },
    { icon: 'calendar', title: 'Rent auto-pay',
      summary: 'Tenants set up a standing order once and rent is paid and recorded every month.' },
    { icon: 'wallet', title: 'Client accounting for agents',
      summary: 'Each owner\'s money held and reported separately, with commission worked out for you.' },
    { icon: 'receipt', title: 'Bank reconciliation',
      summary: 'Import bank statements and match deposits to invoices, like M-Pesa already is.' },
  ];
}
