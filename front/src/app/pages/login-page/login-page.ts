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

  // Form Signals
  name = signal('');
  username = signal(''); // New field
  identifier = signal(''); // Used for Email OR Username in login
  password = signal('');

  setMode(mode: 'signin' | 'signup'): void {
    this.mode.set(mode);
    this.error.set(null);
  }

  submit(): void {
    this.error.set(null);
    const id = this.identifier().trim();
    const pass = this.password();

    if (!id || !pass) {
      this.error.set('Credentials are required.');
      return;
    }

    if (this.mode() === 'signup' && (!this.name() || !this.username())) {
      this.error.set('Please fill in all fields.');
      return;
    }

    this.isSubmitting.set(true);

    const request$ = this.mode() === 'signup'
      ? this.authService.register(this.name(), id, pass, this.username()) // Ensure your service accepts username
      : this.authService.login(id, pass); // Backend should handle id as email/username

    request$.subscribe({
      next: () => {
        this.authService.me().subscribe(() => {
          this.isSubmitting.set(false);
          this.router.navigateByUrl('/timeline');
        });
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.error.set(err?.status === 401 ? 'Identity mismatch. Try again.' : 'Rally encountered an error.');
      }
    });
  }
}