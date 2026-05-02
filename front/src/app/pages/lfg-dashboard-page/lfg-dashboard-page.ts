import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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

  posts = signal<OwnedLfgPost[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  updatingApplicationId = signal<number | null>(null);

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
    return Object.entries(application.answers ?? {}).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
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
}
