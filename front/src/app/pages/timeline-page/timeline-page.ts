import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ComposerComponent } from '../../components/composer/composer';
import { PostCard } from '../../components/post-card/post-card';
import { TimelineService } from '../../services/timeline';
import { Post } from '../../types/post';

@Component({
  selector: 'app-timeline-page',
  imports: [CommonModule, ComposerComponent, PostCard],
  templateUrl: './timeline-page.html',
})
export class TimelinePageComponent implements OnInit {
  private readonly timelineService = inject(TimelineService);

  posts = this.timelineService.posts;
  isLoading = signal(true);
  error = signal<string | null>(null);

  isComposerOpen = signal(false);
  sortBy = signal<'date' | 'popularity' | 'replies' | 'type'>('date');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.timelineService.getTimeline().subscribe({
      next: response => {
        this.timelineService.setPosts(response.data);
        this.isLoading.set(false);
      },
      error: err => {
        console.error('Timeline load failed', err);
        this.error.set('Could not load timeline.');
        this.isLoading.set(false);
      },
    });
  }

  openComposer(): void {
    this.isComposerOpen.set(true);
  }

  closeComposer(): void {
    this.isComposerOpen.set(false);
  }

  sortedPosts(): Post[] {
    const posts = [...this.posts()];

    switch (this.sortBy()) {
      case 'popularity':
        return posts.sort((a, b) => Number(b.likes_count ?? 0) - Number(a.likes_count ?? 0));
      case 'replies':
        return posts.sort((a, b) =>
          Number(b.total_comments_count ?? b.comments_count ?? 0) - Number(a.total_comments_count ?? a.comments_count ?? 0)
        );
      case 'type':
        return posts.sort((a, b) => a.type.localeCompare(b.type));
      default:
        return posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }
}
