import { Component, OnInit, OnDestroy, effect, inject, signal } from '@angular/core';
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

  totalUnreadCount$ = this.chatService.totalUnreadCount$;

  currentClubUnreadCount(): number {
    const club = this.clubChatOverlay.currentClub();
    if (!club) return 0;

    return Object.entries(this.chatService.loungeUnreadCounts())
      .filter(([roomId, count]) =>
        Number(count) > 0
        && Number(this.chatService.loungeClubIds()[Number(roomId)]) === Number(club.id)
      )
      .length;
  }

  badgeCount(count: number): string {
    return count > 99 ? '99+' : String(count);
  }

  isLightMode(): boolean {
    return document.body.classList.contains('light-theme');
  }

  toggleTheme(): void {
    const enabled = !this.isLightMode();
    localStorage.setItem('rally_theme', enabled ? 'light' : 'dark');
    document.body.classList.toggle('light-theme', enabled);
  }

  openCurrentClubChat(): void {
    const club = this.clubChatOverlay.currentClub();
    if (club) this.clubChatOverlay.open(club.slug);
  }

  constructor() {
    effect(() => {
      const user = this.authService.user();

      if (user?.id) {
        this.notificationService.initRealtime();
        this.chatService.loadConversations();
        this.initChatRealtime();
      }
    });
  }

  ngOnInit(): void {
    this.applyDisplaySettings();
    const existingToken = localStorage.getItem('rally_token');

    if (existingToken) {
      this.authService.me().subscribe({
        next: () => {
          this.loadUnreadNotifications();
          this.chatService.loadConversations();
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

  hasClubActivity(clubId: number): boolean {
    if (this.chatService.hasKnownClubLounges(Number(clubId))) {
      return this.chatService.hasClubUnread(Number(clubId));
    }

    const club = this.user()?.clubs?.find((item: any) => Number(item.id) === Number(clubId));
    return Number(club?.unread_lounges_count ?? 0) > 0;
  }

  clearClubActivity(clubId: number): void {
    //
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
        if (message.sender_id === user.id) return;

        if (message.room_id) {
          const activeRoomId = this.chatService.activeLoungeId();
          if (!this.clubChatOverlay.isOpen() || Number(activeRoomId) !== Number(message.room_id)) {
            const clubName = message.club_name ?? 'Club';
            const roomName = (message.room_name ?? 'lounge').replace(/^#\s*/, '');

            if (!this.clubChatOverlay.isOpen()) {
              this.toast.success(`New message in ${clubName} > #${roomName}`, {
                icon: '#',
                className: 'rally-hot-toast',
              });
            }

            if (message.club_id) {
              this.chatService.receiveLoungeMessage(message);
            }
          }
          return;
        }

        if (!message.conversation_id) return;

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

  private applyDisplaySettings(): void {
    const textSize = Number(localStorage.getItem('rally_text_size') ?? 16);
    document.documentElement.style.setProperty('--base-font-size', `${Math.min(20, Math.max(14, textSize))}px`);
    document.body.classList.toggle('light-theme', localStorage.getItem('rally_theme') === 'light');
  }

}
