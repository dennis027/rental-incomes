import { Component } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SiteIcon } from '../../site-icon';
import { SITE } from '../../site-info';

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [RouterLink, DecimalPipe, SiteIcon],
  templateUrl: './pricing.html',
})
export class PricingPage {
  plans = SITE.plans;

  included = [
    'Unlimited properties and tenants within your plan',
    'Monthly invoicing with water and electricity readings',
    'M-Pesa paybill payments matched automatically',
    'Arrears, ageing and tenant statements',
    'Move-out deposit settlement',
    'Expenses and maintenance tracking',
    'Over 30 financial and occupancy reports',
    'Secure cloud hosting, usable on any device',
  ];
}
