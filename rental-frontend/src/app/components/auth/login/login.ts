import { Component, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../services/auth'
import { finalize } from 'rxjs';
import { Router } from '@angular/router';

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
          console.log("Login success:", res);
          this.route.navigate(['/dashboard']);
        },
        error: err => {
          console.error("Login failed:", err);
          this.errorMessage.set(
            err.error?.message || 'Login failed. Please try again.'
          );
        }
      });
  }
}