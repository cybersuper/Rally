import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostCard } from '../../components/post-card/post-card';
import { AuthService } from '../../auth';
import { ClubService } from '../../services/club';
import { HttpClient } from '@angular/common/http';
import { PaginatedPosts, Post } from '../../types/post';
import { TimelineService } from '../../services/timeline';
import { safeHexColor } from '../../utils/color';

interface ClubDetail {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  accent_color: string | null;
  theme_color?: string | null;
  sticker_type: string | null;
  cover_image_url?: string | null;
  members_count?: number;
  is_member: boolean;
  membership_role: 'OWNER' | 'MODERATOR' | 'MEMBER' | string | null;
  my_nickname?: string | null;
  show_streak?: boolean;
}

@Component({
  selector: 'app-club-detail-page',
  imports: [CommonModule, RouterLink, PostCard],
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
  isTimelinePrivate = signal(false);
  isUpdatingMembership = signal(false);
  isIdentityOpen = signal(false);
  isSavingIdentity = signal(false);
  identityError = signal<string | null>(null);
  identityNickname = signal('');
  identityShowStreak = signal(true);

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
    this.isTimelinePrivate.set(false);

    this.http.get<{ club: ClubDetail }>(`/api/clubs/${slug}`).subscribe({
      next: response => {
        this.club.set(this.normalizeClub(response.club));

        this.http
          .get<PaginatedPosts>(`/api/clubs/${slug}/timeline`)
          .subscribe({
            next: timeline => {
              this.posts.set(this.timelineService.normalizePosts(timeline.data));
              this.isLoading.set(false);
            },
            error: err => {
              console.error('Club timeline load failed', err);

              if (err?.status === 403) {
                this.posts.set([]);
                this.isTimelinePrivate.set(true);
                this.isLoading.set(false);
                return;
              }

              this.error.set('Could not load club timeline.');
              this.isLoading.set(false);
            },
          });
      },
      error: err => {
        console.error('Club load failed', err);
        this.error.set('Could not load club.');
        this.isLoading.set(false);
      },
    });
  }

  toggleMembership(): void {
    const club = this.club();
    if (!club || this.isUpdatingMembership()) return;
    if (this.isOwner()) return;

    this.isUpdatingMembership.set(true);

    const request$ = club.is_member
      ? this.clubService.leave(club.id)
      : this.clubService.join(club.id);

    request$.subscribe({
      next: () => {
        this.club.update(current =>
          current
            ? {
                ...current,
                is_member: !current.is_member,
                membership_role: current.is_member ? null : 'MEMBER',
              }
            : current
        );

        this.authService.me().subscribe({
          next: () => {
            this.timelineService.fetchTimeline().subscribe({
              next: () => {
                this.isUpdatingMembership.set(false);
                this.load();
              },
              error: () => {
                this.isUpdatingMembership.set(false);
                this.load();
              },
            });
          },
          error: () => {
            this.isUpdatingMembership.set(false);
            this.load();
          },
        });
      },
      error: () => {
        this.isUpdatingMembership.set(false);
      },
    });
  }

  isOwner(): boolean {
    return this.club()?.membership_role === 'OWNER';
  }

  canManageClub(): boolean {
    return ['OWNER', 'ADMIN', 'MODERATOR'].includes(String(this.club()?.membership_role ?? ''));
  }

  openIdentity(): void {
    const club = this.club();
    if (!club?.is_member) return;

    this.identityNickname.set(club.my_nickname ?? '');
    this.identityShowStreak.set(club.show_streak ?? true);
    this.identityError.set(null);
    this.isIdentityOpen.set(true);
  }

  closeIdentity(): void {
    if (this.isSavingIdentity()) return;
    this.isIdentityOpen.set(false);
  }

  saveIdentity(): void {
    const club = this.club();
    if (!club || this.isSavingIdentity()) return;

    this.isSavingIdentity.set(true);
    this.identityError.set(null);

    this.http.patch<{ club: ClubDetail }>(`/api/clubs/${club.slug}/identity`, {
      nickname: this.identityNickname() || null,
      show_streak: this.identityShowStreak(),
    }).subscribe({
      next: response => {
        this.club.set(this.normalizeClub(response.club));
        this.timelineService.fetchTimeline().subscribe({ next: () => {}, error: () => {} });
        this.isSavingIdentity.set(false);
        this.isIdentityOpen.set(false);
        this.load();
      },
      error: err => {
        console.error('Club identity save failed', err);
        this.identityError.set(err?.status === 422 ? 'Check your nickname.' : 'Could not save identity.');
        this.isSavingIdentity.set(false);
      },
    });
  }

  private normalizeClub(club: ClubDetail): ClubDetail {
    return {
      ...club,
      accent_color: safeHexColor(club.accent_color ?? club.theme_color),
    };
  }
}
