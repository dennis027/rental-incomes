import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ThemeService } from '../../../services/theme';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SiteFormsService, formErrorMessage } from '../../../services/site-forms';

@Component({
  selector: 'app-request-demo-component',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './request-demo-component.html',
  styleUrl: './request-demo-component.css',
})
export class RequestDemoComponent {
  theme = inject(ThemeService);
  private forms = inject(SiteFormsService);
 
  currentStep = signal(1);
  loading     = signal(false);
  error       = signal('');
  submitted   = false;
 
  progressWidth = computed(() => {
    if (this.submitted)        return '100%';
    if (this.currentStep() === 2) return '66%';
    return '33%';
  });
 
  step1Form: FormGroup;
  step2Form: FormGroup;
 
  constructor(private fb: FormBuilder) {
    this.step1Form = this.fb.group({
      firstName : ['', Validators.required],
      lastName  : ['', Validators.required],
      email     : ['', [Validators.required, Validators.email]],
      phone     : ['', Validators.required],
    });
 
    this.step2Form = this.fb.group({
      role   : ['', Validators.required],
      units  : ['', Validators.required],
      source : [''],
    });
  }
 
  goToStep2(): void {
    if (this.step1Form.invalid) {
      this.step1Form.markAllAsTouched();
      return;
    }
    this.currentStep.set(2);
  }
 
  goToStep1(): void {
    this.currentStep.set(1);
  }
 
  onSubmit(): void {
    if (this.step2Form.invalid) {
      this.step2Form.markAllAsTouched();
      return;
    }
 
    this.loading.set(true);
    this.error.set('');

    const one = this.step1Form.value;
    const two = this.step2Form.value;
    this.forms.requestDemo({
      first_name: one.firstName,
      last_name: one.lastName,
      email: one.email,
      phone: one.phone,
      role: two.role,
      units: two.units,
      source: two.source || '',
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted = true;
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(formErrorMessage(err));
      },
    });
  }
}
