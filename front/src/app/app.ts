import { Component, OnInit, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth';
import { ClubDiscoveryComponent } from './components/club-discovery/club-discovery';
import { ClubChatOverlayComponent } from './components/club-chat-overlay/club-chat-overlay';
import { NotificationService } from './services/notification';
import { ChatMessage, ChatService } from './services/chat';
import { HotToastService } from '@ngxpert/hot-toast';
import { NgZone } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { ClubChatOverlayState } from './services/club-chat-overlay';
import { EchoBridge } from './services/echo-bridge';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, ClubDiscoveryComponent, ClubChatOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(HotToastService);
  private readonly zone = inject(NgZone);
  readonly chatService = inject(ChatService);
  private readonly echoBridge = inject(EchoBridge);
  readonly clubChatOverlay = inject(ClubChatOverlayState);

  user = this.authService.user;

  isBooting = signal(true);
  unreadNotifications = this.notificationService.unreadCount;
  notificationFlash = this.notificationService.notificationFlash;
  private chatEcho: Echo<'reverb'> | null = null;
  private chatUserId: number | null = null;

  totalUnreadCount = computed(() =>
    this.chatService.conversations().reduce(
      (sum, conversation) => sum + Number(conversation.unread_count ?? 0),
      0
    )
  );

  constructor() {
    effect(() => {
      const user = this.authService.user();

      if (user?.id) {
        this.notificationService.initRealtime();
        this.initChatRealtime();
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
          this.initChatRealtime();
          this.isBooting.set(false);
        },
        error: () => {
          localStorage.removeItem('rally_token');
          this.authService.token.set(null);
          this.authService.user.set(null);
          this.notificationService.clearUnread();
          this.notificationService.disconnectRealtime();
          this.disconnectChatRealtime();
          this.chatService.clearUnread();
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
        this.disconnectChatRealtime();
        this.chatService.clearUnread();
        this.router.navigateByUrl('/login');
      },
      error: () => {
          localStorage.removeItem('rally_token');
          this.authService.token.set(null);
          this.authService.user.set(null);
          this.notificationService.clearUnread();
          this.notificationService.disconnectRealtime();
          this.disconnectChatRealtime();
          this.chatService.clearUnread();
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

private initChatRealtime(): void {
    const user = this.authService.user();
    const token = this.authService.token();
    if (!user?.id || !token) return;
    if (this.chatEcho && this.chatUserId === user.id) return;

    (window as any).Pusher = Pusher;

    // Create the instance
    const echoInstance = new Echo({
      broadcaster: 'reverb',
      key: 'nnemvhtajzjjh3bj1dqh',
      wsHost: 'localhost',
      wsPort: 8080,
      forceTLS: false,
      enabledTransports: ['ws', 'wss'],
      authEndpoint: 'http://localhost:8000/broadcasting/auth',
      auth: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });

    (window as any).Echo = echoInstance; 
    this.echoBridge.set(echoInstance);
    
    this.chatEcho = echoInstance;
    this.chatUserId = user.id;
    this.chatEcho.private(`user.${user.id}`).listen('.MessageSent', (payload: { message: ChatMessage }) => {
      this.zone.run(() => {
        const message = payload.message;
        if (message.sender_id === user.id || !message.conversation_id) return;

        this.chatService.receiveIncoming(message);

        if (!this.router.url.startsWith('/chat')) {
          this.toast.success(`${message.sender?.name ?? 'Someone'} sent a message`, {
            icon: 'C',
            className: 'rally-hot-toast',
          });
        }
      });
    });

    console.log('Echo global connected');
}

  ngOnDestroy(): void {
    this.notificationService.disconnectRealtime();
    this.disconnectChatRealtime();
  }

  private disconnectChatRealtime(): void {
    if (this.chatEcho && this.chatUserId) {
      this.chatEcho.leave(`user.${this.chatUserId}`);
      this.chatEcho.disconnect();
    }

    this.chatEcho = null;
    this.chatUserId = null;
    this.echoBridge.set(null);
  }

}
