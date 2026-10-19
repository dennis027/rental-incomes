import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SiteIcon } from '../../site-icon';
import { SITE } from '../../site-info';
import { SiteFormsService, formErrorMessage } from '../../../../services/site-forms';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, SiteIcon],
  templateUrl: './contact.html',
})
export class ContactPage {
  private forms = inject(SiteFormsService);
  site = SITE;

  sending = signal(false);
  sent = signal('');
  error = signal('');

  subjects = ['General enquiry', 'Pricing', 'Book a demo', 'Support with my account', 'Partnership'];

  form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', Validators.maxLength(30)],
    subject: ['General enquiry'],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    website: [''], // hidden trap for bots
  });

  get whatsappLink() {
    return this.site.whatsapp ? `https://wa.me/${this.site.whatsapp}` : '';
  }

  invalid(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    return control.invalid && control.touched;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.sending.set(true);
    this.error.set('');
    this.forms.sendContact(this.form.getRawValue()).subscribe({
      next: (reply) => {
        this.sending.set(false);
        this.sent.set(reply.message || 'Thanks, your message has been sent.');
        this.form.reset();
      },
      error: (err) => {
        this.sending.set(false);
        this.error.set(formErrorMessage(err));
      },
    });
  }
}
