import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PostCard } from '../../components/post-card/post-card';
import { AuthService } from '../../auth';
import { ClubService } from '../../services/club';
import { HttpClient } from '@angular/common/http';
import { PaginatedPosts, Post } from '../../types/post';
import { TimelineService } from '../../services/timeline';

interface ClubDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  accent_color: string;
  sticker_type: string | null;
  cover_image_url?: string | null;
  is_member: boolean;
}

@Component({
  selector: 'app-club-detail-page',
  imports: [CommonModule, PostCard],
  templateUrl: './club-detail-page.html',
})
export class ClubDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly clubService = inject(ClubService);
  private readonly authService = inject(AuthService);
  private readonly timelineService = inject(TimelineService);

  club = signal<ClubDetail | null>(null);
  posts = signal<Post[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isUpdatingMembership = signal(false);

  ngOnInit(): void {
    this.route.paramMap.subscribe(() => {
      this.load();
    });
  }

  private slug(): string {
    return this.route.snapshot.paramMap.get('slug') ?? '';
  }

  load(): void {
    const slug = this.slug();

    this.isLoading.set(true);
    this.error.set(null);

    this.http.get<{ club: ClubDetail }>(`/api/clubs/${slug}`).subscribe({
      next: response => {
        this.club.set(response.club);

        this.http
          .get<PaginatedPosts>(`/api/clubs/${slug}/timeline`)
          .subscribe({
            next: timeline => {
              this.posts.set(timeline.data);
              this.isLoading.set(false);
            },
            error: () => {
              this.error.set('Could not load club timeline.');
              this.isLoading.set(false);
            },
          });
      },
      error: () => {
        this.error.set('Could not load club.');
        this.isLoading.set(false);
      },
    });
  }

  toggleMembership(): void {
    const club = this.club();
    if (!club || this.isUpdatingMembership()) return;

    this.isUpdatingMembership.set(true);

    const request$ = club.is_member
      ? this.clubService.leave(club.id)
      : this.clubService.join(club.id);

    request$.subscribe({
      next: () => {
        this.club.update(current =>
          current ? { ...current, is_member: !current.is_member } : current
        );

        this.authService.me().subscribe({
          next: () => {
            this.timelineService.fetchTimeline().subscribe({
              next: () => this.isUpdatingMembership.set(false),
              error: () => this.isUpdatingMembership.set(false),
            });
          },
          error: () => this.isUpdatingMembership.set(false),
        });
      },
      error: () => {
        this.isUpdatingMembership.set(false);
      },
    });
  }
}
