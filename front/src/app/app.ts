import { Component, OnInit, OnDestroy, effect, inject, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from './auth';
import { SuggestedClubsComponent } from './components/suggested-clubs/suggested-clubs';
import { JoinedSkeletonComponent } from './components/joined-skeleton/joined-skeleton';
import { ClubSkeletonComponent } from './components/club-skeleton/club-skeleton';
import { ClubChatOverlayComponent } from './components/club-chat-overlay/club-chat-overlay';
import { NotificationService } from './services/notification';
import { ChatMessage, ChatService } from './services/chat';
import { HotToastService } from '@ngxpert/hot-toast';
import { NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { ClubChatOverlayState } from './services/club-chat-overlay';
import { EchoBridge } from './services/echo-bridge';
import { PaginatedPosts, Post } from './types/post';
import { safeHexColor } from './utils/color';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, SuggestedClubsComponent, JoinedSkeletonComponent, ClubSkeletonComponent, ClubChatOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly toast = inject(HotToastService);
  private readonly zone = inject(NgZone);
  private readonly http = inject(HttpClient);
  readonly chatService = inject(ChatService);
  private readonly echoBridge = inject(EchoBridge);
  readonly clubChatOverlay = inject(ClubChatOverlayState);

  user = this.authService.user;

  isBooting = signal(true);
  isInitialLoading = signal(true);
  unreadNotifications = this.notificationService.unreadCount;
  notificationFlash = this.notificationService.notificationFlash;
  liveGroups = signal<Post[]>([]);
  isLiveGroupsLoading = signal(false);
  private chatEcho: Echo<'reverb'> | null = null;
  private chatUserId: number | null = null;
  private hasLoadedConversations = false;

  get totalUnreadCount(): number {
    return this.chatService.conversations().reduce(
      (sum, conversation) => sum + Number(conversation.unread_count ?? 0),
      0
    );
  }

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
    document.body.dataset['theme'] = enabled ? 'light' : 'dark';
  }

  openCurrentClubChat(): void {
    const club = this.clubChatOverlay.currentClub();
    if (club) this.clubChatOverlay.open(club.slug);
  }

  openCurrentClubComposer(): void {
    const club = this.clubChatOverlay.currentClub();
    if (!club?.slug) return;
    if (club.is_member === false) return;
    this.router.navigate(['/clubs', club.slug], {
      queryParams: { compose: 1 },
      queryParamsHandling: 'merge',
    });
  }

  constructor() {
    effect(() => {
      const user = this.authService.user();

      if (user?.id) {
        this.notificationService.initRealtime();
        this.chatService.loadConversations();
        this.loadLiveGroups();
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
          this.loadLiveGroups();
          this.notificationService.initRealtime();
          this.initChatRealtime();
          this.isBooting.set(false);
          this.isInitialLoading.set(false);
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
          this.isInitialLoading.set(false);
          this.router.navigateByUrl('/login');
        },
      });
      return;
    }

    this.isBooting.set(false);
    this.isInitialLoading.set(false);
    this.router.navigateByUrl('/login');
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.notificationService.clearUnread();
        this.notificationService.disconnectRealtime();
        this.disconnectChatRealtime();
        this.chatService.clearUnread();
        this.isInitialLoading.set(false);
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
          this.isInitialLoading.set(false);
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

  loadLiveGroups(): void {
    this.isLiveGroupsLoading.set(true);
    this.http.get<PaginatedPosts>('/api/timeline', { params: { sort: 'date' } }).subscribe({
      next: response => {
        this.liveGroups.set(
          response.data
            .filter(post => post.type === 'lfg' && String(post.metadata?.['status'] ?? 'open') !== 'full')
            .slice(0, 4)
            .map(post => ({
              ...post,
              club: {
                ...post.club,
                accent_color: safeHexColor(post.club?.accent_color ?? post.club?.theme_color),
              },
            }))
        );
        this.isLiveGroupsLoading.set(false);
      },
      error: () => {
        this.liveGroups.set([]);
        this.isLiveGroupsLoading.set(false);
      },
    });
  }

  private initChatRealtime(): void {
    const user = this.authService.user();
    const token = this.authService.token();
    if (!user?.id || !token) return;

    if (!this.hasLoadedConversations) {
      this.hasLoadedConversations = true;
      this.chatService.loadConversations();
    }

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
      authEndpoint: '/broadcasting/auth',
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

    const channel = this.chatEcho.private(`user.${user.id}`);
    channel.listen('MessageSent', (payload: { message: ChatMessage }) => {
      this.zone.run(() => {
        if (payload?.message) this.chatService.receiveIncoming(payload.message);
      });
    });
    channel.listen('.MessageSent', (payload: { message: ChatMessage }) => {
      this.zone.run(() => {
        if (payload?.message) this.chatService.receiveIncoming(payload.message);
      });
    });

    console.log('✅ Echo is now global and connected');
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
    (window as any).Echo = null;
  }

  private applyDisplaySettings(): void {
    const textSize = Number(localStorage.getItem('rally_text_size') ?? 16);
    document.documentElement.style.setProperty('--base-font-size', `${Math.min(20, Math.max(14, textSize))}px`);
    const isLight = localStorage.getItem('rally_theme') === 'light';
    document.body.classList.toggle('light-theme', isLight);
    document.body.dataset['theme'] = isLight ? 'light' : 'dark';
  }

}
