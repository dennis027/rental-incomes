import { Component, signal, inject, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { takeReturnPath } from '../../../services/return-path';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { AuthService } from '../../../services/auth'
import { ThemeService } from '../../../services/theme';
import { finalize } from 'rxjs';
import { Router, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  theme = inject(ThemeService);
private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(Router);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef)
  private platformId = inject(PLATFORM_ID);

  showPassword = signal(false);
  sessionExpired = signal(false);

  ngOnInit() {
    // Already signed in: skip the form
    if (this.authService.getAccessToken()) {
      this.route.navigateByUrl(takeReturnPath());
      return;
    }
    if (isPlatformBrowser(this.platformId) && sessionStorage.getItem('session_expired')) {
      sessionStorage.removeItem('session_expired');
      this.sessionExpired.set(true);
    }
  }

  // SMACKBAR MESSAGES

 showSuccess(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 3000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  showError(message: string) {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }

  loginForm: FormGroup = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required]
  });

  loading = signal(false);
  errorMessage = signal<string | null>(null);

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.sessionExpired.set(false);

    this.authService.login(this.loginForm.value)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: res => {
          // Back to the page the user was on when they were signed out
          this.route.navigateByUrl(takeReturnPath());
          this.showSuccess('Logged In successfully!');
          this.cdr.detectChanges();
        },
        error: err => {
          this.errorMessage.set(
            err.status === 0
              ? 'Cannot reach the server. Check your connection and try again.'
              : err.error?.details?.non_field_errors?.[0] || err.error?.message || 'Login failed. Please try again.'
          );
        }
      });
  }
}