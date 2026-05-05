import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { ClubChannel, ClubChannelService } from '../../services/club-channel';
import { ChatMessage, ChatService } from '../../services/chat';
import { ClubChatOverlayState } from '../../services/club-chat-overlay';

interface MessageMenu {
  message: ChatMessage;
  left: string;
  top: string;
}

@Component({
  selector: 'app-club-chat-overlay',
  imports: [CommonModule, RouterLink],
  templateUrl: './club-chat-overlay.html',
})
export class ClubChatOverlayComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) slug = '';
  @Output() closed = new EventEmitter<void>();

  readonly channelService = inject(ClubChannelService);
  readonly chatService = inject(ChatService);
  readonly authService = inject(AuthService);
  private readonly overlayState = inject(ClubChatOverlayState);

  draft = signal('');
  selectedChannel = signal<ClubChannel | null>(null);
  typingUsers = signal<Set<string>>(new Set());
  isCreatingLounge = signal(false);
  newLoungeName = signal('');
  newLoungeCategory = signal('Text Lounges');
  isPinnedOpen = signal(false);
  contextMenu = signal<MessageMenu | null>(null);
  replyTarget = signal<ChatMessage | null>(null);
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private unregisterTyping: (() => void) | null = null;
  private lastMarkedLoungeId: number | null = null;

  @ViewChild('scrollHost') private scrollHost?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      const messages = this.channelService.messages();
      if (!messages) return;

      this.scrollToBottomAfterRender();
    });

    effect(() => {
      const id = this.channelService.activeChannel()?.id ?? null;
      if (!id || this.lastMarkedLoungeId === id) return;

      this.lastMarkedLoungeId = id;
      console.log('Room marked as read:', id);
      this.chatService.markRoomAsRead(id);

      this.channelService.channels.update(items =>
        items.map(item => (Number(item.id) === Number(id) ? { ...item, unread_count: 0 } : item))
      );
    });
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnChanges(): void {
    if (!this.slug) return;

    this.channelService.loadInto(this.slug, this.overlayState.loungeId());
    this.setupTyping();

    const active = this.channelService.activeChannel();
    if (active) {
      this.selectedChannel.set(active);
    }
  }

  ngOnDestroy(): void {
    this.unregisterTyping?.();
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();
    this.channelService.disconnect();
  }

  close(): void {
    this.closed.emit();
  }

  closeContextMenu(): void {
    this.contextMenu.set(null);
  }

  roomName(name: string): string {
    return name.replace(/^#\s*/, '').trim();
  }

  badgeCount(count: number): string {
    return count > 99 ? '99+' : String(count);
  }

  loungeCategories(): Array<{ name: string; channels: ClubChannel[] }> {
    const groups = new Map<string, ClubChannel[]>();

    for (const channel of this.channelService.channels()) {
      const category = this.canonicalCategory(
        channel.category?.trim() || (channel.type === 'announcement' ? 'Announcements' : 'Text Lounges')
      );
      groups.set(category, [...(groups.get(category) ?? []), channel]);
    }

    return [...groups.entries()].map(([name, channels]) => ({ name, channels }));
  }

  select(channel: ClubChannel): void {
    this.selectedChannel.set(channel);
    this.typingUsers.set(new Set());
    this.channelService.open(this.slug, channel);
    this.setupTyping();
    this.scrollToBottomAfterRender();
  }

  orderedMessages(): ChatMessage[] {
    return [...this.channelService.messages()].reverse();
  }

  pinnedMessages(): ChatMessage[] {
    return this.orderedMessages().filter(message => message.is_pinned);
  }

  isMine(message: ChatMessage): boolean {
    return Number(message.sender_id) === Number(this.authService.user()?.id);
  }

  isGrouped(message: ChatMessage, index: number): boolean {
    const previous = this.orderedMessages()[index + 1];
    if (!previous) return false;
    if (Number(previous.sender_id) !== Number(message.sender_id)) return false;

    const currentTime = new Date(message.created_at).getTime();
    const previousTime = new Date(previous.created_at).getTime();

    return Math.abs(currentTime - previousTime) <= 120000;
  }

  isGroupEnd(message: ChatMessage, index: number): boolean {
    const next = this.orderedMessages()[index - 1];
    if (!next) return true;
    if (Number(next.sender_id) !== Number(message.sender_id)) return true;

    const currentTime = new Date(message.created_at).getTime();
    const nextTime = new Date(next.created_at).getTime();

    return Math.abs(currentTime - nextTime) > 120000;
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }

  canAdmin(): boolean {
    const club = this.authService.user()?.clubs?.find((item: any) => item.slug === this.slug);
    return ['OWNER', 'ADMIN', 'MODERATOR'].includes(String(club?.membership_role ?? ''));
  }

  canCreateLounge(): boolean {
    const club = this.authService.user()?.clubs?.find((item: any) => item.slug === this.slug);
    return ['OWNER', 'ADMIN'].includes(String(club?.membership_role ?? ''));
  }

  isSender(message: ChatMessage): boolean {
    return Number(message.sender_id) === Number(this.authService.user()?.id);
  }

  canOwnOrAdmin(): boolean {
    const club = this.authService.user()?.clubs?.find((item: any) => item.slug === this.slug);
    return ['OWNER', 'ADMIN'].includes(String(club?.membership_role ?? ''));
  }

  canDelete(message: ChatMessage): boolean {
    return this.isSender(message) || this.canOwnOrAdmin();
  }

  canSend(): boolean {
    const channel = this.channelService.activeChannel();
    return !!channel && (channel.type === 'text' || this.canAdmin());
  }

  send(): void {
    const body = this.draft().trim();
    if (!body || !this.canSend()) return;
    this.channelService.send(this.slug, body);
    this.stopTyping();
    this.draft.set('');
    this.replyTarget.set(null);
    this.scrollToBottomAfterRender();
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
    if (value.length === 0) {
      this.stopTyping();
      return;
    }
    const name = this.authService.user()?.name;
    if (name) this.channelService.whisperTyping(name);
  }

  typingText(): string | null {
    const names = [...this.typingUsers()];

    if (names.length === 0) return null;
    if (names.length > 5) return 'Multiple people are typing...';
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;

    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are typing...`;
  }

  private setupTyping(): void {
    this.unregisterTyping?.();
    this.unregisterTyping = this.channelService.onTyping((name, isTyping) => {
      const me = this.authService.user()?.name;
      if (me && name === me) return;
      if (!isTyping) {
        this.removeTypingUser(name);
        return;
      }
      this.addTypingUser(name);
    });
  }

  private addTypingUser(name: string): void {
    this.typingUsers.update(current => new Set(current).add(name));

    const existing = this.typingTimeouts.get(name);
    if (existing) clearTimeout(existing);

    this.typingTimeouts.set(name, setTimeout(() => {
      this.typingUsers.update(current => {
        const next = new Set(current);
        next.delete(name);
        return next;
      });
      this.typingTimeouts.delete(name);
    }, 1500));
  }

  private removeTypingUser(name: string): void {
    const existing = this.typingTimeouts.get(name);
    if (existing) clearTimeout(existing);
    this.typingTimeouts.delete(name);

    this.typingUsers.update(current => {
      const next = new Set(current);
      next.delete(name);
      return next;
    });
  }

  stopTyping(): void {
    const name = this.authService.user()?.name;
    if (!name) return;
    this.removeTypingUser(name);
    this.channelService.whisperStopTyping(name);
  }

  createLounge(): void {
    const name = this.newLoungeName().trim();
    if (!name || !this.canCreateLounge()) return;

    const category = this.canonicalCategory(this.newLoungeCategory().trim() || 'Text Lounges');
    this.channelService.createRoom(this.slug, name, category).subscribe({
      next: response => {
        this.channelService.channels.update(items => [...items, response.channel]);
        this.newLoungeName.set('');
        this.isCreatingLounge.set(false);
        this.select(response.channel);
      },
      error: err => console.error('Room create failed', err),
    });
  }

  private canonicalCategory(input: string): string {
    const normalized = input.replace(/\s+/g, ' ').trim();
    const key = normalized.toLowerCase();
    if (key === 'text rooms' || key === 'text room' || key === 'rooms') return 'Text Lounges';
    if (key === 'text lounges' || key === 'text lounge' || key === 'lounges' || key === 'lounge') return 'Text Lounges';
    if (key === 'announcements' || key === 'announcement') return 'Announcements';
    return normalized;
  }

  openMessageMenu(event: MouseEvent, message: ChatMessage): void {
    event.preventDefault();
    event.stopPropagation();
    if (message.deleted_at) return;
    this.contextMenu.set({
      message,
      left: `${event.clientX}px`,
      top: `${event.clientY}px`,
    });
  }

  startLongPress(event: TouchEvent, message: ChatMessage): void {
    if (message.deleted_at) return;
    const touch = event.touches[0];
    this.longPressTimer = setTimeout(() => {
      this.contextMenu.set({
        message,
        left: `${touch.clientX}px`,
        top: `${touch.clientY}px`,
      });
    }, 450);
  }

  cancelLongPress(): void {
    if (this.longPressTimer) clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  reply(message: ChatMessage): void {
    this.replyTarget.set(message);
    this.closeContextMenu();
  }

  forward(message: ChatMessage): void {
    navigator.clipboard?.writeText(message.body).catch(() => {});
    this.closeContextMenu();
  }

  copyText(message: ChatMessage): void {
    navigator.clipboard?.writeText(message.body).catch(() => {});
    this.closeContextMenu();
  }

  edit(message: ChatMessage): void {
    if (!this.isSender(message)) return;
    const next = window.prompt('Edit message', message.body)?.trim();
    if (!next) return;

    this.channelService.editMessage(message.id, next).subscribe({
      next: response => this.patchMessage(response.message),
      error: err => console.error('Edit failed', err),
    });
    this.closeContextMenu();
  }

  delete(message: ChatMessage): void {
    if (!this.canDelete(message)) return;

    this.channelService.deleteMessage(message.id).subscribe({
      next: response => this.patchMessage(response.message),
      error: err => console.error('Delete failed', err),
    });
    this.closeContextMenu();
  }

  togglePin(message: ChatMessage): void {
    if (!this.canOwnOrAdmin()) return;

    this.channelService.pinMessage(message.id, !message.is_pinned).subscribe({
      next: response => {
        this.patchMessage(response.message);
      },
      error: err => console.error('Pin failed', err),
    });
    this.closeContextMenu();
  }

  private patchMessage(message: ChatMessage): void {
    this.channelService.messages.update(items =>
      items.map(item => item.id === message.id ? { ...item, ...message } : item)
    );
  }

  private scrollToBottomAfterRender(): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => this.scrollToBottom());
    });
  }

  scrollToBottom(): void {
    const el = this.scrollHost?.nativeElement;
    if (!el) return;
    el.scrollTop = 0;
  }
}
