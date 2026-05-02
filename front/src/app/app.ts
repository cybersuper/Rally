import { Component, OnInit, inject, signal } from '@angular/core';
import { PostCard } from './components/post-card/post-card';
import { TimelineService } from './services/timeline';
import { AuthService } from './auth';
import { ComposerComponent } from './components/composer/composer';

@Component({
  selector: 'app-root',
  imports: [PostCard, ComposerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly timelineService = inject(TimelineService);
  private readonly authService = inject(AuthService);

  posts = this.timelineService.posts;
  isLoading = signal(true);
  error = signal<string | null>(null);

  isComposerOpen = signal(false);

  ngOnInit(): void {
    const existingToken = localStorage.getItem('rally_token');

    if (existingToken) {
      this.authService.me().subscribe({
        next: () => this.loadTimeline(),
        error: () => this.loadTimeline(),
      });
      return;
    }

    this.authService.login('jay@example.com', 'password').subscribe({
      next: () => {
        this.authService.me().subscribe({
          next: () => this.loadTimeline(),
          error: () => this.loadTimeline(),
        });
      },
      error: () => {
        this.error.set('Could not log in.');
        this.isLoading.set(false);
      },
    });
  }

  private loadTimeline(): void {
    this.timelineService.getTimeline().subscribe({
      next: response => {
        this.timelineService.setPosts(response.data);
        this.isLoading.set(false);
      },
      error: () => {
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