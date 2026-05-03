import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ComposerComponent } from '../../components/composer/composer';
import { PostCard } from '../../components/post-card/post-card';
import { TimelineService } from '../../services/timeline';

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
}
