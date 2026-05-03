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
  private lastMessageCount = 0;

  ngOnInit(): void {
    this.chat.clearUnread();
    this.chat.loadConversations();
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) this.chat.openConversationById(id);
    });
  }

  ngOnDestroy(): void {
    this.chat.disconnect();
  }

  ngAfterViewChecked(): void {
    const count = this.chat.messages().length;
    if (count === this.lastMessageCount) return;
    this.lastMessageCount = count;
    queueMicrotask(() => {
      const el = this.messageScroller?.nativeElement;
      if (el) el.scrollTop = 0;
    });
  }

  orderedMessages() {
    return [...this.chat.messages()].reverse();
  }

  open(conversation: Conversation): void {
    this.chat.openConversation(conversation);
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
