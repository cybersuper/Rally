import { HttpClient } from '@angular/common/http';
import { Injectable, NgZone, computed, effect, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
  is_pinned?: boolean;
  deleted_at?: string | null;
  sender: ChatUser | null;
  channel_id?: number | null;
  room_id?: number | null;
  room_name?: string | null;
  room_category?: string | null;
  club_id?: number | null;
  club_name?: string | null;
  club_slug?: string | null;
}

export interface Conversation {
  id: number;
  title: string;
  photo_path?: string | null;
  party_post_id?: number | null;
  leader_id?: number | null;
  is_group?: boolean;
  next_meeting_at?: string | null;
  meeting_label?: string | null;
  participants: ChatUser[];
  latest_message: ChatMessage | null;
  unread_count: number;
  updated_at: string;
}

@Injectable({
  providedIn: 'root',
})
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);

  conversations = signal<Conversation[]>([]);
  messages = signal<ChatMessage[]>([]);
  activeConversation = signal<Conversation | null>(null);
  unreadCount = signal(0);
  loungeUnreadCounts = signal<Record<number, number>>({});
  loungeClubIds = signal<Record<number, number>>({});
  activeLoungeId = signal<number | null>(null);
  totalUnreadCount = computed(() =>
    this.conversations().filter(conversation => Number(conversation.unread_count ?? 0) > 0).length
  );
  private readonly totalUnreadCountSubject = new BehaviorSubject<number>(0);
  readonly totalUnreadCount$ = this.totalUnreadCountSubject.asObservable();

  private activeChannel: string | null = null;

  locallyClearUnread(id: number): void {
    const roomId = Number(id);
    if (!roomId) return;
    this.loungeUnreadCounts.update(current => ({
      ...current,
      [roomId]: 0,
    }));
  }

  constructor() {
    effect(() => {
      this.totalUnreadCountSubject.next(this.totalUnreadCount());
    });
  }

  getConversations() {
    return this.http.get<{ conversations: Conversation[] }>('/api/conversations');
  }

  getChatUsers(query = '') {
    return this.http.get<{ users: ChatUser[] }>('/api/chat-users', {
      params: query ? { q: query } : {},
    });
  }

  startConversation(userId: number) {
    return this.http.post<{ conversation: Conversation }>('/api/conversations', { user_id: userId });
  }

  createGroupConversation(payload: FormData) {
    return this.http.post<{ conversation: Conversation }>('/api/conversations', payload);
  }

  updateConversation(conversationId: number, payload: FormData) {
    return this.http.patch<{ conversation: Conversation }>(`/api/conversations/${conversationId}`, payload);
  }

  searchMessages(query: string) {
    return this.http.get<{ messages: ChatMessage[] }>('/api/messages/search', {
      params: { q: query },
    });
  }

  loadConversations(): void {
    this.getConversations().subscribe({
      next: response => this.conversations.set(response.conversations),
      error: err => console.error('Conversations load failed', err),
    });
  }

  openConversation(conversation: Conversation): void {
    this.markRead(conversation.id);
    this.http.get<{ conversation: Conversation; messages: ChatMessage[] }>(`/api/conversations/${conversation.id}`)
      .subscribe({
        next: response => {
          this.activeConversation.set(response.conversation);
          this.messages.set(response.messages);
          this.subscribe(response.conversation.id);
          this.markRead(response.conversation.id);
        },
        error: err => console.error('Conversation load failed', err),
      });
  }

  openConversationById(id: number): void {
    this.markRead(id);
    this.http.get<{ conversation: Conversation; messages: ChatMessage[] }>(`/api/conversations/${id}`)
      .subscribe({
        next: response => {
          this.activeConversation.set(response.conversation);
          this.messages.set(response.messages);
          this.subscribe(response.conversation.id);
          this.markRead(response.conversation.id);
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

  planMeeting(conversationId: number, nextMeetingAt: string, meetingLabel: string) {
    return this.http.patch<{ conversation: Conversation; message: ChatMessage }>(
      `/api/conversations/${conversationId}/meeting`,
      { next_meeting_at: nextMeetingAt, meeting_label: meetingLabel }
    );
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

  loungeUnreadCount(roomId: number): number {
    return Number(this.loungeUnreadCounts()[Number(roomId)] ?? 0);
  }

  hasClubUnread(clubId: number): boolean {
    const clubMap = this.loungeClubIds();
    const unread = this.loungeUnreadCounts();

    return Object.entries(unread).some(([roomId, count]) =>
      Number(count) > 0 && Number(clubMap[Number(roomId)]) === Number(clubId)
    );
  }

  hasKnownClubLounges(clubId: number): boolean {
    return Object.values(this.loungeClubIds()).some(id => Number(id) === Number(clubId));
  }

  receiveLoungeMessage(message: ChatMessage): void {
    const roomId = Number(message.room_id ?? message.channel_id);
    const clubId = Number(message.club_id);
    if (!roomId) return;

    const isActive = Number(this.activeLoungeId()) === Number(roomId);
    const isFocused = typeof document !== 'undefined' && typeof document.hasFocus === 'function' && document.hasFocus();

    if (isActive && isFocused) {
      this.locallyClearUnread(roomId);
      this.http.post<{ lounge_id: number; unread_count: number }>(`/api/lounges/${roomId}/read`, {})
        .subscribe({
          next: response => this.locallyClearUnread(response.lounge_id),
          error: err => console.error('Lounge read failed', err),
        });
      return;
    }

    if (clubId) {
      this.loungeClubIds.update(current => ({ ...current, [roomId]: clubId }));
    }

    this.loungeUnreadCounts.update(current => ({
      ...current,
      [roomId]: Number(current[roomId] ?? 0) + 1,
    }));
  }

  syncLoungeUnreadCounts(channels: Array<{ id: number; club_id?: number; unread_count?: number }>): void {
    if (!channels.length) return;

    this.loungeClubIds.update(current => {
      const next = { ...current };
      for (const channel of channels) {
        if (channel.club_id) next[Number(channel.id)] = Number(channel.club_id);
      }
      return next;
    });

    this.loungeUnreadCounts.update(current => {
      const next = { ...current };
      for (const channel of channels) {
        next[Number(channel.id)] = Number(channel.unread_count ?? 0);
      }
      return next;
    });
  }

  markLoungeRead(roomId: number): void {
    this.locallyClearUnread(roomId);
  }

  markRoomAsRead(roomId: number): void {
    this.activeLoungeId.set(Number(roomId));
    this.markLoungeRead(roomId);
    this.http.post<{ lounge_id: number; unread_count: number }>(`/api/lounges/${roomId}/read`, {})
      .subscribe({
        next: response => this.markLoungeRead(response.lounge_id),
        error: err => console.error('Lounge read failed', err),
      });
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
      if (!message.conversation_id) return;

      const active = this.activeConversation();
      const isActiveConversation = active && Number(message.conversation_id) === Number(active.id);

      if (isActiveConversation) {
        this.messages.update(current =>
          current.some(item => Number(item.id) === Number(message.id)) ? current : [...current, message]
        );
      }

      this.conversations.update(items => {
        const conversationId = Number(message.conversation_id);
        if (!items.some(item => Number(item.id) === conversationId)) {
          this.loadConversations();
          return [...items];
        }

        const updated = items.map(item => {
          if (Number(item.id) !== conversationId) return item;

          return {
            ...item,
            latest_message: message,
            updated_at: message.created_at,
            unread_count: isActiveConversation
              ? 0
              : (Number(item.unread_count ?? 0) + 1),
          };
        });

        const idx = updated.findIndex(item => Number(item.id) === conversationId);
        if (idx < 0) return updated;
        if (idx === 0) return [...updated];

        const [moved] = updated.splice(idx, 1);
        return [moved, ...updated];
      });
    });
  }

  private markRead(conversationId: number): void {
    this.http.post<{ conversation_id: number; unread_count: number }>(`/api/conversations/${conversationId}/read`, {})
      .subscribe({
        next: () => {
          this.conversations.update(items =>
            items.map(item =>
              Number(item.id) === Number(conversationId) ? { ...item, unread_count: 0 } : item
            )
          );
        },
        error: () => {},
      });
  }
}
