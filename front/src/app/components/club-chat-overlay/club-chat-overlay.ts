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
import { AuthService } from '../../auth';
import { ClubChannel, ClubChannelService } from '../../services/club-channel';
import { ChatMessage } from '../../services/chat';

@Component({
  selector: 'app-club-chat-overlay',
  imports: [CommonModule],
  templateUrl: './club-chat-overlay.html',
})
export class ClubChatOverlayComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input({ required: true }) slug = '';
  @Output() closed = new EventEmitter<void>();

  readonly channelService = inject(ClubChannelService);
  readonly authService = inject(AuthService);

  draft = signal('');
  selectedChannel = signal<ClubChannel | null>(null);

  @ViewChild('scrollHost') private scrollHost?: ElementRef<HTMLDivElement>;

  constructor() {
    effect(() => {
      const messages = this.channelService.messages();
      if (!messages) return;

      this.scrollToBottomAfterRender();
    });
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnChanges(): void {
    if (!this.slug) return;

    this.channelService.loadInto(this.slug);

    const active = this.channelService.activeChannel();
    if (active) {
      this.selectedChannel.set(active);
    }
  }

  ngOnDestroy(): void {
    this.channelService.disconnect();
  }

  close(): void {
    this.closed.emit();
  }

  roomName(name: string): string {
    return name.replace(/^#\s*/, '').trim();
  }

  select(channel: ClubChannel): void {
    this.selectedChannel.set(channel);
    this.channelService.open(this.slug, channel);
    this.scrollToBottomAfterRender();
  }

  orderedMessages(): ChatMessage[] {
    return [...this.channelService.messages()].reverse();
  }

  canAdmin(): boolean {
    const club = this.authService.user()?.clubs?.find((item: any) => item.slug === this.slug);
    return ['OWNER', 'ADMIN', 'MODERATOR'].includes(String(club?.membership_role ?? ''));
  }

  canSend(): boolean {
    const channel = this.channelService.activeChannel();
    return !!channel && (channel.type === 'text' || this.canAdmin());
  }

  send(): void {
    const body = this.draft().trim();
    if (!body || !this.canSend()) return;
    this.channelService.send(this.slug, body);
    this.draft.set('');
    this.scrollToBottomAfterRender();
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
