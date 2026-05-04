import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { AuthService } from '../auth';
import { ChatMessage, ChatService } from './chat';

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

  channels = signal<ClubChannel[]>([]);
  activeChannel = signal<ClubChannel | null>(null);
  messages = signal<ChatMessage[]>([]);
  private echo: Echo<'reverb'> | null = null;
  private clubChannel: string | null = null;
  private typingHandlers = new Set<(name: string, typing: boolean) => void>();

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

  create(slug: string, name: string, type: 'text' | 'announcement', category = 'Text Lounges') {
    return this.http.post<{ channel: ClubChannel }>(`/api/clubs/${slug}/channels`, { name, type, category });
  }

  createRoom(slug: string, name: string, category = 'Text Lounges', type: 'text' | 'announcement' = 'text') {
    return this.http.post<{ channel: ClubChannel }>(`/api/clubs/${slug}/rooms`, { name, category, type });
  }

  open(slug: string, channel: ClubChannel): void {
    this.activeChannel.set(channel);
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
    if (this.echo && this.clubChannel) {
      this.echo.leave(this.clubChannel);
      this.echo.disconnect();
    }
    this.echo = null;
    this.clubChannel = null;
    this.chatService.activeLoungeId.set(null);
  }

  whisperTyping(name: string): void {
    if (!this.echo || !this.clubChannel || !name.trim()) return;
    this.echo.join(this.clubChannel).whisper('typing', { name, typing: true });
  }

  whisperStopTyping(name: string): void {
    if (!this.echo || !this.clubChannel || !name.trim()) return;
    this.echo.join(this.clubChannel).whisper('typing', { name, typing: false });
  }

  onTyping(handler: (name: string, typing: boolean) => void): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  private subscribe(channel: ClubChannel): void {
    const token = this.authService.token();
    if (!token) return;
    const name = `clubs.${channel.club_id}.rooms.${channel.id}`;
    if (this.echo && this.clubChannel === name) return;
    this.disconnect();
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
      auth: { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
      Pusher,
    });
    this.clubChannel = name;
    const presence = this.echo.join(name);
    presence.listen('.MessageSent', (payload: { message: ChatMessage }) => {
      this.zone.run(() => {
        if (payload.message.channel_id === this.activeChannel()?.id) this.receive(payload.message);
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
