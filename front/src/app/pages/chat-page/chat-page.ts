import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../auth';
import { ChatService, Conversation } from '../../services/chat';

@Component({
  selector: 'app-chat-page',
  imports: [CommonModule],
  templateUrl: './chat-page.html',
})
export class ChatPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly chat = inject(ChatService);
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  @ViewChild('messageScroller') private messageScroller?: ElementRef<HTMLElement>;
  draft = signal('');
  typingName = signal<string | null>(null);
  private lastMessageCount = 0;
  private typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private typingChannelId: number | null = null;

  ngOnInit(): void {
    this.chat.clearUnread();
    this.chat.loadConversations();
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.chat.openConversationById(id);
        this.setupTyping(id);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }

    if (this.typingChannelId) {
      const echo = (window as any).Echo;
      if (echo) {
        echo.leave(`conversations.${this.typingChannelId}`);
      }
    }

    this.chat.disconnect();
  }

  ngAfterViewChecked(): void {
    const count = this.chat.messages().length;
    if (count === this.lastMessageCount) return;
    this.lastMessageCount = count;
    queueMicrotask(() => {
      this.scrollToBottom();
    });
  }

  orderedMessages() {
    return [...this.chat.messages()].reverse();
  }

  open(conversation: Conversation): void {
    this.chat.openConversation(conversation);
    this.setupTyping(conversation.id);
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
    this.whisperTyping();
  }

  private setupTyping(conversationId: number): void {
    if (this.typingChannelId === conversationId) return;

    const echo = (window as any).Echo;
    if (!echo) return;

    if (this.typingChannelId) {
      echo.leave(`conversations.${this.typingChannelId}`);
    }

    this.typingChannelId = conversationId;
    this.typingName.set(null);

    echo.private(`conversations.${conversationId}`).listenForWhisper('typing', (payload: { name?: string } | null) => {
      const name = payload?.name?.trim();
      if (!name) return;

      const me = this.authService.user()?.name;
      if (me && name === me) return;

      this.typingName.set(`${name} is typing...`);
      if (this.typingTimeout) clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => this.typingName.set(null), 3000);
    });
  }

  scrollToBottom(): void {
    const el = this.messageScroller?.nativeElement;
    if (el) el.scrollTop = 0;
  }

  private whisperTyping(): void {
    const conversationId = this.chat.activeConversation()?.id;
    if (!conversationId) return;

    const echo = (window as any).Echo;
    if (!echo) return;

    const name = this.authService.user()?.name;
    if (!name) return;

    echo.private(`conversations.${conversationId}`).whisper('typing', { name });
  }

  send(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.chat.sendMessage(body);
    this.draft.set('');
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }
}
