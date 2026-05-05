import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ComposerComponent } from '../../components/composer/composer';
import { PostCard } from '../../components/post-card/post-card';
import { PostSkeletonComponent } from '../../components/post-skeleton/post-skeleton';
import { ClubService, DiscoverClub } from '../../services/club';
import { TimelineService } from '../../services/timeline';
import { PostType } from '../../types/post';
import { AuthService } from '../../auth';

@Component({
  selector: 'app-timeline-page',
  imports: [CommonModule, ComposerComponent, PostCard, PostSkeletonComponent],
  templateUrl: './timeline-page.html',
})
export class TimelinePageComponent implements OnInit {
  private readonly timelineService = inject(TimelineService);
  private readonly clubService = inject(ClubService);
  private readonly authService = inject(AuthService);

  posts = this.timelineService.posts;
  isLoading = signal(true);
  error = signal<string | null>(null);

  me = this.authService.user;

  isComposerOpen = signal(false);
  sortBy = signal<'latest' | 'highest_streak' | 'most_helpful'>('latest');
  postType = signal<PostType | 'all'>('all');
  selectedClubIds = signal<number[]>([]);
  memberClubs = signal<DiscoverClub[]>([]);

  ngOnInit(): void {
    this.loadMemberClubs();
    this.load();
  }

  loadMemberClubs(): void {
    this.clubService.getClubs().subscribe({
      next: response => {
        this.memberClubs.set(response.clubs.filter(c => c.is_member));
      },
      error: () => {
        this.memberClubs.set([]);
      },
    });
  }

  changeSort(next: 'latest' | 'highest_streak' | 'most_helpful'): void {
    this.sortBy.set(next);
    this.load();
  }

  changePostType(next: PostType | 'all'): void {
    this.postType.set(next);
    this.load();
  }

  changeClubFilter(next: number[]): void {
    this.selectedClubIds.set(next);
    this.load();
  }

  clearClubFilter(): void {
    this.changeClubFilter([]);
  }

  toggleClubFilter(clubId: number): void {
    const current = this.selectedClubIds();
    const next = current.includes(clubId)
      ? current.filter(id => id !== clubId)
      : [...current, clubId];

    this.changeClubFilter(next);
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.timelineService.getTimeline(this.sortBy(), this.selectedClubIds(), this.postType()).subscribe({
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

  sortedPosts() {
    return this.posts();
  }
}
