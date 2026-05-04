import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { LfgApplication, OwnedLfgPost, PostService } from '../../services/post';
import { TimelineService } from '../../services/timeline';

@Component({
  selector: 'app-lfg-dashboard-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './lfg-dashboard-page.html',
})
export class LfgDashboardPageComponent implements OnInit {
  private readonly postService = inject(PostService);
  private readonly timelineService = inject(TimelineService);
  private readonly router = inject(Router);

  posts = signal<OwnedLfgPost[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  updatingApplicationId = signal<number | null>(null);
  expandedApplications = signal<Record<number, boolean>>({});
  partyPromptPost = signal<OwnedLfgPost | null>(null);
  partyName = signal('');
  leaderTitle = signal('Party Leader');
  isCreatingParty = signal(false);
  private partyPhoto: File | null = null;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.postService.getOwnedLfgPosts().subscribe({
      next: response => {
        this.posts.set(response.posts);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Could not load LFG posts.');
        this.isLoading.set(false);
      },
    });
  }

  progress(post: OwnedLfgPost): number {
    const filled = Number(post.metadata?.['spots_filled'] ?? 0);
    const total = Number(post.metadata?.['spots_total'] ?? 1);

    return Math.min(100, Math.max(0, (filled / total) * 100));
  }

  answerEntries(application: LfgApplication): Array<{ key: string; value: string }> {
    const post = this.posts().find(item => item.id === application.post_id);
    const fields = Array.isArray(post?.metadata?.['application_fields'])
      ? post?.metadata?.['application_fields']
      : [];
    const labels = new Map<string, string>();

    for (const field of fields) {
      const key = String(field?.key ?? field?.id ?? '');
      if (key) labels.set(key, String(field?.label ?? key));
    }

    return Object.entries(application.answers ?? {}).map(([key, value]) => ({
      key: labels.get(key) ?? key,
      value: this.formatAnswer(fields.find((field: any) => String(field?.key ?? field?.id ?? '') === key), value),
    }));
  }

  private formatAnswer(field: any, value: any): string {
    if (String(field?.type ?? '') === 'boolean') {
      return value ? String(field?.true_label ?? 'Yes') : String(field?.false_label ?? 'No');
    }

    if (Array.isArray(value)) return value.join(', ');

    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  isExpanded(application: LfgApplication): boolean {
    return !!this.expandedApplications()[application.id];
  }

  toggleApplication(application: LfgApplication): void {
    this.expandedApplications.update(current => ({
      ...current,
      [application.id]: !current[application.id],
    }));
  }

  isUpdating(application: LfgApplication): boolean {
    return this.updatingApplicationId() === application.id;
  }

  setApplicationStatus(
    post: OwnedLfgPost,
    application: LfgApplication,
    status: 'accepted' | 'rejected'
  ): void {
    if (this.updatingApplicationId() !== null) return;

    this.updatingApplicationId.set(application.id);
    this.error.set(null);

    this.postService.updateLfgApplication(application.id, status).subscribe({
      next: response => {
        this.posts.update(list =>
          list.map(item =>
            item.id === post.id
              ? {
                  ...item,
                  metadata: response.post.metadata,
                  applications: item.applications.map(candidate =>
                    candidate.id === application.id ? response.application : candidate
                  ),
                }
              : item
          )
        );

        if (status === 'accepted' && (response.seats_filled || response.post.seats_filled)) {
          const updatedPost = this.posts().find(item => item.id === post.id) ?? {
            ...post,
            metadata: response.post.metadata,
          };

          this.partyPromptPost.set(updatedPost);
          this.partyName.set(updatedPost.title);
          this.leaderTitle.set('Party Leader');
        }

        this.timelineService.fetchTimeline().subscribe({
          next: () => this.updatingApplicationId.set(null),
          error: () => this.updatingApplicationId.set(null),
        });
      },
      error: err => {
        this.updatingApplicationId.set(null);

        if (err?.status === 422) {
          this.error.set('No open seats remain for that LFG post.');
          return;
        }

        this.error.set('Could not update application.');
      },
    });
  }

  setPartyPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.partyPhoto = input.files?.[0] ?? null;
  }

  closePartyPrompt(): void {
    if (this.isCreatingParty()) return;
    this.partyPromptPost.set(null);
    this.partyPhoto = null;
  }

  createPartyConversation(): void {
    const post = this.partyPromptPost();
    if (!post || this.isCreatingParty()) return;

    const payload = new FormData();
    payload.set('group_name', this.partyName().trim() || post.title);
    payload.set('leader_title', this.leaderTitle().trim() || 'Party Leader');
    if (this.partyPhoto) payload.set('group_photo', this.partyPhoto);

    this.isCreatingParty.set(true);
    this.postService.createPartyConversation(post.id, payload).subscribe({
      next: response => {
        this.isCreatingParty.set(false);
        this.partyPromptPost.set(null);
        this.router.navigate(['/chat', response.conversation.id]);
      },
      error: err => {
        console.error('Party conversation failed', err);
        this.error.set('Could not create Party chat.');
        this.isCreatingParty.set(false);
      },
    });
  }
}
