import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import { HotToastService } from '@ngxpert/hot-toast';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuthService } from '../auth';

export interface RallyNotification {
  id: string;
  type: 'like' | 'comment' | 'lfg_app' | string;
  data: {
    post_id?: number;
    post_title?: string;
    comment_id?: number;
    application_id?: number;
    club_slug?: string;
    actor_name?: string;
    [key: string]: any;
  } | null;
  read_at: string | null;
  created_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly toast = inject(HotToastService);

  unreadCount = signal(0);
  notifications = signal<RallyNotification[]>([]);
  notificationFlash = signal(false);

  private readonly notificationsSubject = new BehaviorSubject<RallyNotification[]>([]);
  readonly notifications$ = this.notificationsSubject.asObservable();
  private echo: Echo<'reverb'> | null = null;
  private subscribedUserId: number | null = null;

  getNotifications() {
    return this.http.get<{ notifications: RallyNotification[] }>('/api/notifications').pipe(
      tap(response => this.setNotifications(response.notifications))
    );
  }

  getUnreadCount() {
    return this.http.get<{ unread_count: number }>('/api/notifications/unread-count').pipe(
      tap(response => this.unreadCount.set(response.unread_count))
    );
  }

  markRead(notificationId: string) {
    return this.http.patch<{ notification: RallyNotification }>(
      `/api/notifications/${notificationId}/read`,
      {}
    ).pipe(
      tap(response => {
        if (response.notification.read_at) {
          this.unreadCount.update(count => Math.max(0, count - 1));
          this.setNotifications(this.notifications().map(item =>
            item.id === response.notification.id ? response.notification : item
          ));
        }
      })
    );
  }

  initRealtime(): void {
    const user = this.authService.user();
    const token = this.authService.token();

    if (!user?.id || !token) return;
    if (this.echo && this.subscribedUserId === user.id) return;

    this.disconnectRealtime();

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
      .listen('.NotificationSent', (payload: { notification: RallyNotification }) => {
        this.zone.run(() => {
          this.receive(payload.notification);
          this.incrementUnread();
          this.flashBell();
          this.playPing();
          this.toast.success(this.messageFor(payload.notification));
        });
      });
  }

  disconnectRealtime(): void {
    if (this.echo && this.subscribedUserId) {
      this.echo.leave(`users.${this.subscribedUserId}`);
      this.echo.disconnect();
    }

    this.echo = null;
    this.subscribedUserId = null;
  }

  receive(notification: RallyNotification): void {
    const current = this.notifications();

    if (current.some(item => item.id === notification.id)) {
      return;
    }

    this.setNotifications([notification, ...current]);
  }

  incrementUnread(): void {
    this.unreadCount.update(count => count + 1);
  }

  clearUnread(): void {
    this.unreadCount.set(0);
  }

  private setNotifications(notifications: RallyNotification[]): void {
    this.notifications.set(notifications);
    this.notificationsSubject.next(notifications);
  }

  private flashBell(): void {
    this.notificationFlash.set(true);
    window.setTimeout(() => this.notificationFlash.set(false), 900);
  }

  private playPing(): void {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.025;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
    } catch {
      //
    }
  }

  private messageFor(notification: RallyNotification): string {
    const actor = notification.data?.actor_name ?? 'Someone';

    if (notification.type === 'like') return `${actor} boosted your post!`;
    if (notification.type === 'comment') return `${actor} replied on ${notification.data?.post_title ?? 'your post'}`;
    if (notification.type === 'lfg_app') return `${actor} applied to your group!`;

    return 'New Rally notification';
  }
}
