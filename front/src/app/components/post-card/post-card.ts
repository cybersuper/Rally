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

  isApplyModalOpen = signal(false);
  applyError = signal<string | null>(null);
  applyAnswers = signal<Record<string, any>>({});

  lfgApplicationFields(): Array<{ key: string; label: string; placeholder?: string; required?: boolean; type?: string }> {
    const raw = this.metadataValue<any[]>('application_fields', []);

    if (Array.isArray(raw) && raw.length) {
      return raw
        .filter(Boolean)
        .map(field => ({
          key: String(field.key ?? ''),
          label: String(field.label ?? field.key ?? 'Field'),
          placeholder: field.placeholder ? String(field.placeholder) : undefined,
          required: !!field.required,
          type: field.type ? String(field.type) : 'text',
        }))
        .filter(field => field.key.trim().length > 0);
    }

    return [
      {
        key: 'message',
        label: 'Message',
        placeholder: "Say hi and share what you're looking for",
        required: true,
        type: 'textarea',
      },
    ];
  }

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

  openApplyModal(): void {
    if (this.hasApplied()) return;
    this.applyError.set(null);
    this.applyAnswers.set({});
    this.isApplyModalOpen.set(true);
  }

  closeApplyModal(): void {
    if (this.isApplying()) return;
    this.isApplyModalOpen.set(false);
  }

  setAnswer(key: string, value: any): void {
    this.applyAnswers.update(current => ({ ...current, [key]: value }));
  }

  submitApplication(): void {
    if (this.isApplying() || this.hasApplied()) return;

    this.applyError.set(null);

    const fields = this.lfgApplicationFields();
    const answers = this.applyAnswers();

    for (const field of fields) {
      if (!field.required) continue;

      const value = answers[field.key];

      if (value === null || value === undefined || String(value).trim().length === 0) {
        this.applyError.set('Please complete the required fields.');
        return;
      }
    }

    this.isApplying.set(true);

    this.postService.applyToLfg(this.post().id, answers).subscribe({
      next: () => {
        this.hasApplied.set(true);
        this.isApplying.set(false);
        this.isApplyModalOpen.set(false);
      },
      error: error => {
        if (error?.status === 409) {
          this.hasApplied.set(true);
          this.isApplyModalOpen.set(false);
        } else if (error?.status === 403) {
          this.applyError.set('You must join this club before applying.');
        } else {
          this.applyError.set('Could not send application.');
        }

        this.isApplying.set(false);
      },
    });
  }
}