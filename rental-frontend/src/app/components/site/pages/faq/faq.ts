import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SiteIcon } from '../../site-icon';

interface Question {
  q: string;
  a: string;
}

@Component({
  selector: 'app-faq-page',
  standalone: true,
  imports: [RouterLink, SiteIcon],
  templateUrl: './faq.html',
})
export class FaqPage {
  sections: { title: string; questions: Question[] }[] = [
    {
      title: 'Getting started',
      questions: [
        {
          q: 'How do I get an account?',
          a: 'Accounts are set up for you rather than by open sign-up, so strangers can never see your data. Request a demo or send us a message and we will create your account and help you add your first property.',
        },
        {
          q: 'Do I need to install anything?',
          a: 'No. It runs in the web browser on your phone, tablet or computer. There is nothing to download or update.',
        },
        {
          q: 'Can I bring in my existing tenants?',
          a: 'Yes. Add your properties and units, then each tenant with their contract. The getting-started checklist walks you through it, and on larger plans we help you with the import.',
        },
      ],
    },
    {
      title: 'Rent and payments',
      questions: [
        {
          q: 'Can tenants pay with M-Pesa?',
          a: 'Yes. Connect your paybill and tenants pay as usual, using their account number. Each confirmed payment is matched to the right invoice automatically; anything that cannot be matched waits in your Paybill inbox for you to assign with one click.',
        },
        {
          q: 'What about cash and bank payments?',
          a: 'Record them in a few seconds. Every payment, whatever the method, produces a receipt and updates the tenant’s balance straight away.',
        },
        {
          q: 'How are water and electricity billed?',
          a: 'When you generate the month’s invoices you enter each unit’s meter readings. The system charges the units used at the rate you set for that property and adds it to the invoice.',
        },
        {
          q: 'Can I charge a late-payment penalty?',
          a: 'Yes. Set a penalty rate and a grace period for each property; invoices still unpaid after the grace period are charged the penalty.',
        },
        {
          q: 'Do you support quarterly or yearly rent?',
          a: 'Yes. Each contract can be monthly, quarterly or yearly, and rent is only charged in the months it falls due.',
        },
      ],
    },
    {
      title: 'Tenants and move-outs',
      questions: [
        {
          q: 'Can I see what a tenant owes and has paid?',
          a: 'Every tenant has a statement listing each charge and payment with a running balance, and the Arrears page shows everyone who owes money and for how long.',
        },
        {
          q: 'How are deposits handled when a tenant leaves?',
          a: 'The move-out screen works out the settlement for you: the deposit is set against any rent or bills still owed, and you see exactly what is refunded or still due before you confirm.',
        },
        {
          q: 'Do tenants get their own login?',
          a: 'Not yet. Today the system is for landlords and their staff; you share statements and receipts with tenants directly.',
        },
      ],
    },
    {
      title: 'Data and security',
      questions: [
        {
          q: 'Is my data safe?',
          a: 'Connections are encrypted, sign-in is protected against password guessing, and tenant ID photos are only shown to signed-in users of your account. Read more on our Security page.',
        },
        {
          q: 'Who owns the data?',
          a: 'You do. We only use it to run the service for you, and you can ask for a copy or for it to be deleted at any time.',
        },
      ],
    },
  ];
}
