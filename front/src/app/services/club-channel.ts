import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth';
import { ChatMessage, ChatService } from './chat';
import { EchoBridge } from './echo-bridge';

export interface ClubChannel {
  id: number;
  club_id: number;
  name: string;
  type: 'text' | 'announcement';
  category?: string | null;
  unread_count?: number;
}

@Injectable({ providedIn: 'root' })
export class ClubChannelService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly chatService = inject(ChatService);
  private readonly zone = inject(NgZone);
  private readonly echoBridge = inject(EchoBridge);
  private readonly router = inject(Router);

  channels = signal<ClubChannel[]>([]);
  activeChannel = signal<ClubChannel | null>(null);
  messages = signal<ChatMessage[]>([]);
  private clubChannel: string | null = null;
  private typingHandlers = new Set<(name: string, typing: boolean) => void>();

  locallyClearUnread(id: number): void {
    const channelId = Number(id);
    if (!channelId) return;
    this.channels.update(items =>
      items.map(item => (Number(item.id) === channelId ? { ...item, unread_count: 0 } : item))
    );
  }

  markAsReadLocal(id: number): void {
    this.channels.update(channels =>
      channels.map(c => (String(c.id) === String(id) ? { ...c, unread_count: 0 } : c))
    );
    this.chatService.locallyClearUnread(id);
  }

  load(slug: string) {
    return this.http.get<{ channels: ClubChannel[] }>(`/api/clubs/${slug}/channels`);
  }

  loadInto(slug: string, preferredChannelId: number | null = null): void {
    this.load(slug).subscribe({
      next: response => {
        this.channels.set(response.channels);
        this.chatService.syncLoungeUnreadCounts(response.channels);
        const preferred = response.channels.find(channel => Number(channel.id) === Number(preferredChannelId));
        if (preferred) {
          this.open(slug, preferred);
          return;
        }

        if (!this.activeChannel() && response.channels[0]) this.open(slug, response.channels[0]);
      },
      error: err => console.error('Channels load failed', err),
    });
  }

  create(slug: string, name: string, type: 'text' | 'announcement', category = 'Text Rooms') {
    return this.http.post<{ channel: ClubChannel }>(`/api/clubs/${slug}/channels`, { name, type, category });
  }

  createRoom(slug: string, name: string, category = 'Text Rooms', type: 'text' | 'announcement' = 'text') {
    return this.http.post<{ channel: ClubChannel }>(`/api/clubs/${slug}/rooms`, { name, category, type });
  }

  open(slug: string, channel: ClubChannel): void {
    this.activeChannel.set(channel);
    this.markAsReadLocal(channel.id);
    this.http.get<{ messages: ChatMessage[] }>(`/api/clubs/${slug}/channels/${channel.id}/messages`).subscribe({
      next: response => {
        this.messages.set([...response.messages].reverse());
        this.subscribe(channel);
      },
      error: err => console.error('Channel messages failed', err),
    });
  }

  send(slug: string, body: string): void {
    const channel = this.activeChannel();
    if (!channel) return;
    this.http.post<{ message: ChatMessage }>(`/api/clubs/${slug}/channels/${channel.id}/messages`, { body }).subscribe({
      next: response => this.receive(response.message),
      error: err => console.error('Channel send failed', err),
    });
  }

  pinMessage(messageId: number, isPinned: boolean) {
    return this.http.put<{ message: ChatMessage }>(`/api/messages/${messageId}/pin`, { is_pinned: isPinned });
  }

  editMessage(messageId: number, body: string) {
    return this.http.patch<{ message: ChatMessage }>(`/api/messages/${messageId}`, { body });
  }

  deleteMessage(messageId: number) {
    return this.http.delete<{ message: ChatMessage }>(`/api/messages/${messageId}`);
  }

  disconnect(): void {
    const echo = this.echoBridge.get() ?? (window as any).Echo;
    if (echo && this.clubChannel) {
      echo.leave(this.clubChannel);
    }
    this.clubChannel = null;
    this.chatService.activeLoungeId.set(null);
  }

  whisperTyping(name: string): void {
    const echo = this.echoBridge.get() ?? (window as any).Echo;
    if (!echo || !this.clubChannel || !name.trim()) return;
    echo.join(this.clubChannel).whisper('typing', { name, typing: true });
  }

  whisperStopTyping(name: string): void {
    const echo = this.echoBridge.get() ?? (window as any).Echo;
    if (!echo || !this.clubChannel || !name.trim()) return;
    echo.join(this.clubChannel).whisper('typing', { name, typing: false });
  }

  onTyping(handler: (name: string, typing: boolean) => void): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  private subscribe(channel: ClubChannel): void {
    const token = this.authService.token();
    if (!token) return;
    const name = `clubs.${channel.club_id}.rooms.${channel.id}`;

    const echo = this.echoBridge.get() ?? (window as any).Echo;
    if (!echo) {
      console.error('Real-time bridge not found. Refresh the page.');
      return;
    }

    if (this.clubChannel === name) return;

    if (this.clubChannel) {
      echo.leave(this.clubChannel);
    }

    this.clubChannel = name;
    const presence = echo.join(name);
    presence.listen('.MessageSent', (payload: { message: ChatMessage }) => {
      this.zone.run(() => {
        if (payload?.message) {
          const msg = payload.message;
          const incomingId = String(msg.channel_id ?? msg.room_id ?? '');
          const activeId = String(this.activeChannel()?.id ?? '');

          console.log('Incoming:', incomingId, 'Active:', activeId);

          const isOnClubPage = this.router.url.includes('/clubs/');
          const isViewingThisLounge = incomingId && incomingId === activeId;

          if (!isOnClubPage || (incomingId && !isViewingThisLounge)) {
            this.channels.update(items =>
              items.map(item =>
                String(item.id) === incomingId
                  ? { ...item, unread_count: Number(item.unread_count ?? 0) + 1 }
                  : item
              )
            );
            this.chatService.receiveLoungeMessage(msg);
            return;
          }

          if (incomingId) {
            this.markAsReadLocal(Number(incomingId));
            this.chatService.markRoomAsRead(Number(incomingId));
          }

          this.receive(msg);
        }
      });
    }).listenForWhisper('typing', (payload: { name?: string; typing?: boolean } | null) => {
      const typingName = payload?.name?.trim();
      if (!typingName) return;
      const isTyping = payload?.typing !== false;
      this.zone.run(() => {
        this.typingHandlers.forEach(handler => handler(typingName, isTyping));
      });
    });
  }

  private receive(message: ChatMessage): void {
    this.messages.update(items => items.some(item => item.id === message.id) ? items : [message, ...items]);
  }
}
