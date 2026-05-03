import { Injectable, NgZone, inject } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { AuthService } from '../auth';
import { RallyNotification } from './notification';

interface NotificationPayload {
  notification: RallyNotification;
}

@Injectable({
  providedIn: 'root',
})
export class RealtimeNotificationService {
  private readonly authService = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly toast = inject(HotToastService);

  private echo: Echo<'reverb'> | null = null;
  private subscribedUserId: number | null = null;
  private listeners = new Set<(notification: RallyNotification) => void>();

  onNotification(callback: (notification: RallyNotification) => void): () => void {
    this.listeners.add(callback);

    return () => this.listeners.delete(callback);
  }

  connect(onNotification?: (notification: RallyNotification) => void): void {
    const user = this.authService.user();
    const token = this.authService.token();

    if (!user?.id || !token) return;

    if (this.subscribedUserId === user.id && this.echo) {
      if (onNotification) {
        this.onNotification(onNotification);
      }

      return;
    }

    this.disconnect();

    if (onNotification) {
      this.onNotification(onNotification);
    }

    this.echo = new Echo({
      broadcaster: 'reverb',
      key: 'nnemvhtajzjjh3bj1dqh',
      wsHost: '127.0.0.1',
      wsPort: 8080,
      wssPort: 8080,
      forceTLS: false,
      enabledTransports: ['ws'],
      authEndpoint: '/broadcasting/auth',
      bearerToken: token,
      auth: {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      },
      Pusher,
    });

    this.subscribedUserId = user.id;

    this.echo
      .private(`users.${user.id}`)
      .listen('.NotificationSent', (payload: NotificationPayload) => {
        this.zone.run(() => {
          this.listeners.forEach(listener => listener(payload.notification));
          this.toast.success(this.messageFor(payload.notification));
        });
      });
  }

  disconnect(): void {
    if (this.echo && this.subscribedUserId) {
      this.echo.leave(`users.${this.subscribedUserId}`);
      this.echo.disconnect();
    }

    this.echo = null;
    this.subscribedUserId = null;
    this.listeners.clear();
  }

  private messageFor(notification: RallyNotification): string {
    if (notification.type === 'like') return 'Someone boosted your post!';
    if (notification.type === 'comment') return `New reply on ${notification.data?.post_title ?? 'your post'}`;
    if (notification.type === 'lfg_app') return 'New applicant for your group!';

    return 'New Rally notification';
  }
}
