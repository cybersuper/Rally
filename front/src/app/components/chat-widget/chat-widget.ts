import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, inject, signal } from '@angular/core';
import { AuthService } from '../../auth';
import { ClubChannel, ClubChannelService } from '../../services/club-channel';

@Component({
  selector: 'app-chat-widget',
  imports: [CommonModule],
  templateUrl: './chat-widget.html',
})
export class ChatWidgetComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) slug = '';
  @Input({ required: true }) channel: ClubChannel | null = null;
  @Output() closed = new EventEmitter<void>();

  readonly channelService = inject(ClubChannelService);
  readonly authService = inject(AuthService);

  draft = signal('');
  minimized = signal(false);

  ngOnChanges(): void {
    if (this.slug && this.channel) this.channelService.open(this.slug, this.channel);
  }

  ngOnDestroy(): void {
    this.channelService.disconnect();
  }

  roomName(name: string): string {
    return name.replace(/^#\s*/, '').trim();
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
  }
}
