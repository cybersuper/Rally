import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { AuthService } from '../auth';
import { ChatMessage } from './chat';

export interface ClubChannel {
  id: number;
  club_id: number;
  name: string;
  type: 'text' | 'announcement';
}

@Injectable({ providedIn: 'root' })
export class ClubChannelService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly zone = inject(NgZone);

  channels = signal<ClubChannel[]>([]);
  activeChannel = signal<ClubChannel | null>(null);
  messages = signal<ChatMessage[]>([]);
  private echo: Echo<'reverb'> | null = null;
  private clubChannel: string | null = null;

  load(slug: string) {
    return this.http.get<{ channels: ClubChannel[] }>(`/api/clubs/${slug}/channels`);
  }

  loadInto(slug: string): void {
    this.load(slug).subscribe({
      next: response => {
        this.channels.set(response.channels);
        if (!this.activeChannel() && response.channels[0]) this.open(slug, response.channels[0]);
      },
      error: err => console.error('Channels load failed', err),
    });
  }

  create(slug: string, name: string, type: 'text' | 'announcement') {
    return this.http.post<{ channel: ClubChannel }>(`/api/clubs/${slug}/channels`, { name, type });
  }

  open(slug: string, channel: ClubChannel): void {
    this.activeChannel.set(channel);
    this.http.get<{ messages: ChatMessage[] }>(`/api/clubs/${slug}/channels/${channel.id}/messages`).subscribe({
      next: response => {
        this.messages.set([...response.messages].reverse());
        this.subscribe(channel.club_id);
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

  disconnect(): void {
    if (this.echo && this.clubChannel) {
      this.echo.leave(this.clubChannel);
      this.echo.disconnect();
    }
    this.echo = null;
    this.clubChannel = null;
  }

  private subscribe(clubId: number): void {
    const token = this.authService.token();
    if (!token) return;
    const name = `club.${clubId}`;
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
    this.echo.join(name).listen('.MessageSent', (payload: { message: ChatMessage }) => {
      this.zone.run(() => {
        if (payload.message.channel_id === this.activeChannel()?.id) this.receive(payload.message);
      });
    });
  }

  private receive(message: ChatMessage): void {
    this.messages.update(items => items.some(item => item.id === message.id) ? items : [message, ...items]);
  }
}
