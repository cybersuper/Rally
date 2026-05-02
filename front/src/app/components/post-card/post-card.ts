import { DatePipe } from '@angular/common';
import { Component, input, inject, signal } from '@angular/core';
import { Post } from '../../types/post';
import { PostService } from '../../services/post';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
})
export class PostCard {
  private readonly postService = inject(PostService);

  post = input.required<Post>();

  isApplying = signal(false);
  hasApplied = signal(false);

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  metadataValue<T>(key: string, fallback: T): T {
    return (this.post().metadata?.[key] ?? fallback) as T;
  }

  typeLabel(): string {
    const type = this.post().type;

    if (type === 'lfg') return 'LFG';
    if (type === 'question') return 'Question';
    if (type === 'log') return 'Log';

    return 'Standard';
  }

  stickerClass(): string {
    const type = this.post().type;

    if (type === 'lfg') return 'rally-sticker rally-sticker-d20';
    if (type === 'question') return 'rally-sticker rally-sticker-question';
    if (type === 'log') return 'rally-sticker rally-sticker-fire';

    return 'rally-sticker rally-sticker-sparkle';
  }

  stickerText(): string {
    const type = this.post().type;

    if (type === 'lfg') return 'D20';
    if (type === 'question') return '?';
    if (type === 'log') return '🔥';

    return '✦';
  }

  lfgProgress(): number {
    const filled = this.metadataValue<number>('spots_filled', 0);
    const total = this.metadataValue<number>('spots_total', 1);

    return Math.min(100, Math.max(0, (filled / total) * 100));
  }

  applyToLfg(): void {
    if (this.isApplying() || this.hasApplied()) return;

    this.isApplying.set(true);

    this.postService.applyToLfg(this.post().id).subscribe({
      next: () => {
        this.hasApplied.set(true);
        this.isApplying.set(false);
      },
      error: error => {
        if (error?.status === 409) {
          this.hasApplied.set(true);
        }

        this.isApplying.set(false);
      },
    });
  }
}