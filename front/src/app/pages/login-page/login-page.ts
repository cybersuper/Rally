import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-login-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login-page.html',
})
export class LoginPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    if (this.authService.isLoggedIn()) {
      this.router.navigateByUrl('/timeline');
    }
  }

  mode = signal<'signin' | 'signup'>('signin');
  isSubmitting = signal(false);
  error = signal<string | null>(null);

  name = signal('');
  email = signal('');
  password = signal('');

  setMode(mode: 'signin' | 'signup'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  submit(): void {
    this.error.set(null);

    const email = this.email().trim();
    const password = this.password();
    const name = this.name().trim();

    if (!email) {
      this.error.set('Enter your email.');
      return;
    }

    if (!password) {
      this.error.set('Enter your password.');
      return;
    }

    if (this.mode() === 'signup' && !name) {
      this.error.set('Enter a display name.');
      return;
    }

    this.isSubmitting.set(true);

    const request$ =
      this.mode() === 'signup'
        ? this.authService.register(name, email, password)
        : this.authService.login(email, password);

    request$.subscribe({
      next: () => {
        this.authService.me().subscribe({
          next: () => {
            this.isSubmitting.set(false);
            this.router.navigateByUrl('/timeline');
          },
          error: () => {
            this.isSubmitting.set(false);
            this.router.navigateByUrl('/timeline');
          },
        });
      },
      error: err => {
        this.isSubmitting.set(false);

        if (err?.status === 422) {
          this.error.set('Check your details and try again.');
          return;
        }

        if (err?.status === 401) {
          this.error.set('Invalid credentials.');
          return;
        }

        this.error.set('Could not sign in.');
      },
    });
  }
}
