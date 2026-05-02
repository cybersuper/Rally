import { DatePipe } from '@angular/common';
import { Component, input, inject, signal } from '@angular/core';
import { Post } from '../../types/post';
import { LfgApplication, PostService } from '../../services/post';
import { AuthService } from '../../auth';
import { TimelineService } from '../../services/timeline';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
})
export class PostCard {
  private readonly postService = inject(PostService);
  private readonly authService = inject(AuthService);
  private readonly timelineService = inject(TimelineService);

  post = input.required<Post>();

  isApplying = signal(false);
  hasApplied = signal(false);

  isApplyModalOpen = signal(false);
  applyError = signal<string | null>(null);
  applyAnswers = signal<Record<string, any>>({});

  isManageOpen = signal(false);
  isLoadingApplications = signal(false);
  manageError = signal<string | null>(null);
  applications = signal<LfgApplication[]>([]);
  updatingApplicationId = signal<number | null>(null);
  metadataOverride = signal<Record<string, any> | null>(null);

  canManageApplications(): boolean {
    const userId = this.authService.user()?.id;
    return this.post().type === 'lfg' && !!userId && this.post().user_id === userId;
  }

  openManage(): void {
    if (!this.canManageApplications()) return;
    this.isManageOpen.set(true);
    this.loadApplications();
  }

  closeManage(): void {
    if (this.updatingApplicationId() !== null) return;
    this.isManageOpen.set(false);
  }

  loadApplications(): void {
    if (this.isLoadingApplications()) return;

    this.manageError.set(null);
    this.isLoadingApplications.set(true);

    this.postService.getLfgApplications(this.post().id).subscribe({
      next: response => {
        this.applications.set(response.applications);
        this.isLoadingApplications.set(false);
      },
      error: err => {
        this.isLoadingApplications.set(false);

        if (err?.status === 403) {
          this.manageError.set('Only the party leader can view applications.');
          return;
        }

        this.manageError.set('Could not load applications.');
      },
    });
  }

  setApplicationStatus(application: LfgApplication, status: 'accepted' | 'rejected'): void {
    if (this.updatingApplicationId() !== null) return;

    this.manageError.set(null);
    this.updatingApplicationId.set(application.id);

    this.postService.updateLfgApplication(application.id, status).subscribe({
      next: response => {
        this.metadataOverride.set(response.post.metadata);
        this.applications.update(list =>
          list.map(item => (item.id === application.id ? response.application : item))
        );

        this.timelineService.fetchTimeline().subscribe({
          next: () => {
            this.updatingApplicationId.set(null);
          },
          error: () => {
            this.updatingApplicationId.set(null);
          },
        });
      },
      error: err => {
        this.updatingApplicationId.set(null);

        if (err?.status === 422) {
          this.manageError.set('No open seats remain.');
          return;
        }

        this.manageError.set('Could not update application.');
      },
    });
  }

  lfgApplicationFields(): Array<{
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    type?: string;
    options?: string[];
  }> {
    const raw = this.metadataValue<any[]>('application_fields', []);

    if (Array.isArray(raw) && raw.length) {
      return raw
        .filter(Boolean)
        .map(field => ({
          key: String(field.key ?? field.id ?? ''),
          label: String(field.label ?? field.key ?? 'Field'),
          placeholder: field.placeholder ? String(field.placeholder) : undefined,
          required: !!field.required,
          type: field.type ? String(field.type) : 'text',
          options: Array.isArray(field.options) ? field.options.map((option: any) => String(option)) : [],
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
    return ((this.metadataOverride() ?? this.post().metadata)?.[key] ?? fallback) as T;
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

  lfgStatusLabel(): string {
    return this.metadataValue<string>('status', 'open') === 'full' ? 'Full' : 'Open';
  }

  spotsRemaining(): number {
    const explicit = this.metadataValue<number | null>('spots_remaining', null);

    if (explicit !== null) {
      return explicit;
    }

    return Math.max(
      0,
      this.metadataValue<number>('spots_total', 0) - this.metadataValue<number>('spots_filled', 0)
    );
  }

  canApply(): boolean {
    return !this.canManageApplications() && this.lfgStatusLabel() !== 'Full' && this.spotsRemaining() > 0;
  }

  isApplicationUpdating(application: LfgApplication): boolean {
    return this.updatingApplicationId() === application.id;
  }

  applicationAnswerEntries(application: LfgApplication): Array<{ key: string; value: string }> {
    return Object.entries(application.answers ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
  }

  openApplyModal(): void {
    if (this.hasApplied() || !this.canApply()) return;
    this.applyError.set(null);
    const initialAnswers: Record<string, any> = {};

    for (const field of this.lfgApplicationFields()) {
      if (field.type === 'boolean') {
        initialAnswers[field.key] = false;
      }

      if (field.type === 'checkbox') {
        initialAnswers[field.key] = [];
      }
    }

    this.applyAnswers.set(initialAnswers);
    this.isApplyModalOpen.set(true);
  }

  closeApplyModal(): void {
    if (this.isApplying()) return;
    this.isApplyModalOpen.set(false);
  }

  setAnswer(key: string, value: any): void {
    this.applyAnswers.update(current => ({ ...current, [key]: value }));
  }

  toggleCheckboxAnswer(key: string, option: string, checked: boolean): void {
    const current = this.applyAnswers()[key];
    const selected = Array.isArray(current) ? current : [];

    this.setAnswer(
      key,
      checked
        ? Array.from(new Set([...selected, option]))
        : selected.filter(value => value !== option)
    );
  }

  isCheckboxSelected(key: string, option: string): boolean {
    const current = this.applyAnswers()[key];

    return Array.isArray(current) && current.includes(option);
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
        } else if (error?.status === 422) {
          this.applyError.set('This LFG post is no longer accepting applications.');
        } else {
          this.applyError.set('Could not send application.');
        }

        this.isApplying.set(false);
      },
    });
  }
}
