import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService, RallyNotification } from '../../services/notification';

@Component({
  selector: 'app-notifications-page',
  imports: [CommonModule, DatePipe],
  templateUrl: './notifications-page.html',
})
export class NotificationsPageComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  notifications = this.notificationService.notifications;
  isLoading = signal(true);
  error = signal<string | null>(null);
  markingId = signal<string | null>(null);

  ngOnInit(): void {
    this.load();
    this.notificationService.initRealtime();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.notificationService.getNotifications().subscribe({
      next: response => {
        this.isLoading.set(false);
      },
      error: err => {
        console.error('Notifications load failed', err);
        this.error.set('Could not load notifications.');
        this.isLoading.set(false);
      },
    });
  }

  icon(notification: RallyNotification): string {
    if (notification.type === 'like') return 'Up';
    if (notification.type === 'comment') return 'Reply';
    if (notification.type === 'lfg_app') return 'LFG';

    return 'New';
  }

  message(notification: RallyNotification): string {
    const actor = notification.data?.actor_name ?? 'Someone';

    if (notification.type === 'like') return `${actor} boosted your post`;
    if (notification.type === 'comment') return `${actor} replied on ${notification.data?.post_title ?? 'your post'}`;
    if (notification.type === 'lfg_app') return `${actor} applied to your LFG`;

    return 'New notification';
  }

  open(notification: RallyNotification): void {
    if (this.markingId() !== null) return;

    this.markingId.set(notification.id);

    this.notificationService.markRead(notification.id).subscribe({
      next: response => {
        this.notifications.update(list =>
          list.map(item => (item.id === notification.id ? response.notification : item))
        );
        this.markingId.set(null);
        this.navigate(notification);
      },
      error: err => {
        console.error('Notification read failed', err);
        this.markingId.set(null);
        this.navigate(notification);
      },
    });
  }

  private navigate(notification: RallyNotification): void {
    const slug = notification.data?.club_slug;
    const postId = notification.data?.post_id;

    if (slug && postId) {
      this.router.navigate(['/clubs', slug, 'posts', postId], {
        fragment: notification.data?.comment_id ? `comment-${notification.data.comment_id}` : undefined,
      });
      return;
    }

    this.router.navigateByUrl('/timeline');
  }
}
