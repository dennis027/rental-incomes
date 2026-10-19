import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteIcon } from '../../site-icon';
import { SITE } from '../../site-info';

@Component({
  selector: 'app-about-page',
  standalone: true,
  imports: [RouterLink, SiteIcon],
  templateUrl: './about.html',
})
export class AboutPage {
  site = SITE;

  values = [
    {
      icon: 'target',
      title: 'Built for how rent works here',
      text: 'M-Pesa paybills, water and electricity readings, deposits, quarterly rent: the system is shaped around how Kenyan landlords actually collect rent, not adapted from somewhere else.',
    },
    {
      icon: 'eye',
      title: 'Every shilling accounted for',
      text: 'Every charge and payment lands on the same ledger, so invoices, receipts, arrears and reports always agree with each other.',
    },
    {
      icon: 'heart',
      title: 'Simple enough to use daily',
      text: 'Clear screens, quick search and sensible defaults, so the caretaker, the accountant and the owner can all use it without training manuals.',
    },
    {
      icon: 'lock',
      title: 'Your data stays yours',
      text: 'Tenant records and ID documents are private to your account, protected by secure sign-in and encrypted connections.',
    },
  ];
}
