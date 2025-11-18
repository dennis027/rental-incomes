import { Component, signal, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth'
import { finalize } from 'rxjs';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private route = inject(Router);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef)

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
    if (this.loginForm.invalid) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: res => {
          this.route.navigate(['/dashboard']);
          this.showSuccess('Logged In successfully!');
          this.cdr.detectChanges();
        },
        error: err => {
            this.showError('Check your details.');
          this.errorMessage.set(
            err.error?.message || 'Login failed. Please try again.'
          );
        }
      });
  }
}