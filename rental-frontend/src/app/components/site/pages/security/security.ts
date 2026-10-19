import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteIcon } from '../../site-icon';

@Component({
  selector: 'app-security-page',
  standalone: true,
  imports: [RouterLink, SiteIcon],
  templateUrl: './security.html',
})
export class SecurityPage {
  // Each item describes a protection that is in place today
  measures = [
    {
      icon: 'lock',
      title: 'Encrypted everywhere',
      text: 'Every connection uses HTTPS, with browsers told to refuse plain HTTP (HSTS). The connection to the database is encrypted too.',
    },
    {
      icon: 'key',
      title: 'Short-lived sign-in sessions',
      text: 'Sign-in tokens expire after 15 minutes and are renewed quietly in the background. Logging out revokes the session so it can never be renewed.',
    },
    {
      icon: 'shield',
      title: 'Protection against password guessing',
      text: 'After five wrong passwords, sign-in for that username is blocked from that address for 15 minutes. Password-reset codes expire after 15 minutes and are destroyed after five wrong tries.',
    },
    {
      icon: 'eye-off',
      title: 'Private tenant documents',
      text: 'Uploaded ID photos are never public links. They are only served to people signed in to the account they belong to.',
    },
    {
      icon: 'users',
      title: 'No open sign-up',
      text: 'Accounts are created by an administrator, so nobody can register themselves and look around your data.',
    },
    {
      icon: 'smartphone',
      title: 'Verified M-Pesa callbacks',
      text: 'Payment notifications are only accepted at a secret address known to Safaricom, and each transaction is recorded once, so a payment can never be counted twice.',
    },
    {
      icon: 'server',
      title: 'Managed hosting',
      text: 'The application and its PostgreSQL database run on managed cloud platforms, so the servers underneath are maintained and patched by the provider.',
    },
    {
      icon: 'file-text',
      title: 'Clear audit trail',
      text: 'Invoices, expenses and move-outs record who created them, and every payment is time-stamped, so figures can be traced back.',
    },
  ];
}
