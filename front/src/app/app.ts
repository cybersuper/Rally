import { Component, OnInit, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth';
import { ClubDiscoveryComponent } from './components/club-discovery/club-discovery';
import { NotificationService } from './services/notification';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ClubDiscoveryComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  user = this.authService.user;

  isBooting = signal(true);
  unreadNotifications = this.notificationService.unreadCount;
  notificationFlash = this.notificationService.notificationFlash;

  constructor() {
    effect(() => {
      const user = this.authService.user();

      if (user?.id) {
        this.notificationService.initRealtime();
      }
    });
  }

  ngOnInit(): void {
    const existingToken = localStorage.getItem('rally_token');

    if (existingToken) {
      this.authService.me().subscribe({
        next: () => {
          this.loadUnreadNotifications();
          this.notificationService.initRealtime();
          this.isBooting.set(false);
        },
        error: () => {
          localStorage.removeItem('rally_token');
          this.authService.token.set(null);
          this.authService.user.set(null);
          this.notificationService.clearUnread();
          this.notificationService.disconnectRealtime();
          this.isBooting.set(false);
          this.router.navigateByUrl('/login');
        },
      });
      return;
    }

    this.isBooting.set(false);
    this.router.navigateByUrl('/login');
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.notificationService.clearUnread();
        this.notificationService.disconnectRealtime();
        this.router.navigateByUrl('/login');
      },
      error: () => {
          localStorage.removeItem('rally_token');
          this.authService.token.set(null);
          this.authService.user.set(null);
          this.notificationService.clearUnread();
          this.notificationService.disconnectRealtime();
          this.router.navigateByUrl('/login');
      },
    });
  }

  canManageClub(club: any): boolean {
    return ['OWNER', 'ADMIN', 'MODERATOR'].includes(String(club?.membership_role ?? ''));
  }

  loadUnreadNotifications(): void {
    this.notificationService.getUnreadCount().subscribe({
      next: () => {},
      error: () => this.notificationService.clearUnread(),
    });
  }

}
