import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-settings-page',
  imports: [CommonModule],
  templateUrl: './settings-page.html',
})
export class SettingsPageComponent {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  username = signal(this.authService.user()?.username ?? '');
  privateProfile = signal(!!this.authService.user()?.private_profile);
  currentPassword = signal('');
  password = signal('');
  passwordConfirmation = signal('');
  status = signal<string | null>(null);
  error = signal<string | null>(null);
  isSaving = signal(false);

  saveUsername(): void {
    this.mutate(
      this.http.patch<{ user: any }>('/api/settings/account', { username: this.username() }),
      response => {
        this.authService.user.set({ ...this.authService.user(), username: response.user.username });
        this.status.set('Username updated.');
      }
    );
  }

  savePassword(): void {
    this.mutate(
      this.http.patch('/api/settings/password', {
        current_password: this.currentPassword(),
        new_password: this.password(),
        new_password_confirmation: this.passwordConfirmation(),
      }),
      () => {
        this.currentPassword.set('');
        this.password.set('');
        this.passwordConfirmation.set('');
        this.status.set('Password updated.');
      }
    );
  }

  savePrivacy(): void {
    this.mutate(
      this.http.patch<{ private_profile: boolean }>('/api/settings/privacy', {
        private_profile: this.privateProfile(),
      }),
      response => {
        this.authService.user.set({ ...this.authService.user(), private_profile: response.private_profile });
        this.status.set('Privacy updated.');
      }
    );
  }

  deactivate(): void {
    if (!confirm('Deactivate account?')) return;

    this.mutate(this.http.delete('/api/settings/account'), () => {
      localStorage.removeItem('rally_token');
      this.authService.token.set(null);
      this.authService.user.set(null);
      this.router.navigateByUrl('/login');
    });
  }

  private mutate(request$: any, next: (response: any) => void): void {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    this.error.set(null);
    this.status.set(null);

    request$.subscribe({
      next: (response: any) => {
        next(response);
        this.isSaving.set(false);
      },
      error: (err: any) => {
        console.error('Settings save failed', err);
        this.error.set(err?.status === 422 ? 'Check the fields and try again.' : 'Could not save settings.');
        this.isSaving.set(false);
      },
    });
  }
}
