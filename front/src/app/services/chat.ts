import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, inject, signal } from '@angular/core';
import { AuthService } from '../auth';
import { EchoBridge } from './echo-bridge';

export interface ChatUser {
  id: number;
  name: string;
  username: string;
  profile_photo_path: string | null;
}

export interface ChatMessage {
  id: number;
  conversation_id: number | null;
  sender_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
  sender: ChatUser | null;
  channel_id?: number | null;
}

export interface Conversation {
  id: number;
  title: string;
  participants: ChatUser[];
  latest_message: ChatMessage | null;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly echoBridge = inject(EchoBridge);

  conversations = signal<Conversation[]>([]);
  messages = signal<ChatMessage[]>([]);
  activeConversation = signal<Conversation | null>(null);
  unreadCount = signal(0);

  private activeChannel: string | null = null;

  getConversations() {
    return this.http.get<{ conversations: Conversation[] }>('/api/conversations');
  }

  startConversation(userId: number) {
    return this.http.post<{ conversation: Conversation }>('/api/conversations', { user_id: userId });
  }

  loadConversations(): void {
    this.getConversations().subscribe({
      next: response => this.conversations.set(response.conversations),
      error: err => console.error('Conversations load failed', err),
    });
  }

  openConversation(conversation: Conversation): void {
    this.http.get<{ conversation: Conversation; messages: ChatMessage[] }>(`/api/conversations/${conversation.id}`)
      .subscribe({
        next: response => {
          this.activeConversation.set(response.conversation);
          this.messages.set(response.messages);
          this.subscribe(response.conversation.id);
        },
        error: err => console.error('Conversation load failed', err),
      });
  }

  openConversationById(id: number): void {
    this.http.get<{ conversation: Conversation; messages: ChatMessage[] }>(`/api/conversations/${id}`)
      .subscribe({
        next: response => {
          this.activeConversation.set(response.conversation);
          this.messages.set(response.messages);
          this.subscribe(response.conversation.id);
        },
        error: err => console.error('Conversation load failed', err),
      });
  }

  sendMessage(body: string) {
    const conversation = this.activeConversation();
    if (!conversation) return;

    this.http.post<{ message: ChatMessage }>(`/api/conversations/${conversation.id}/messages`, { body })
      .subscribe({
        next: response => this.receiveMessage(response.message),
        error: err => console.error('Message send failed', err),
      });
  }

  disconnect(): void {
    const echo = (window as any).Echo;
    if (echo && this.activeChannel) echo.leave(this.activeChannel);
    this.activeChannel = null;
  }

  clearUnread(): void {
    this.unreadCount.set(0);
  }

  incrementUnread(): void {
    this.unreadCount.update(count => count + 1);
  }

  receiveIncoming(message: ChatMessage): void {
    this.receiveMessage(message);
  }

  private subscribe(conversationId: number): void {
    const echo = (window as any).Echo;
    if (!echo) {
      console.error('Real-time bridge not found. Refresh the page.');
      return;
    }

    const channelName = `conversations.${conversationId}`;
    if (this.activeChannel === channelName) return;

    if (this.activeChannel) {
      echo.leave(this.activeChannel);
    }

    this.activeChannel = channelName;
    echo.private(channelName).listen('.MessageSent', (payload: { message: ChatMessage }) => {
      console.log('Event Captured!', payload);
      this.receiveMessage(payload.message);
    });

    console.log(`Now listening on: ${channelName}`);
  }

  private receiveMessage(message: ChatMessage): void {
    this.zone.run(() => {
      const active = this.activeConversation();
      if (active && Number(message.conversation_id) === Number(active.id)) {
        this.messages.update(current =>
          current.some(item => Number(item.id) === Number(message.id)) ? current : [...current, message]
        );
      }

      this.conversations.update(items =>
        items.map(item =>
          Number(item.id) === Number(message.conversation_id)
            ? { ...item, latest_message: message, updated_at: message.created_at }
            : item
        )
      );
    });
  }
}
