import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { ClubService, DiscoverClub } from '../../services/club';
import { TimelineService } from '../../services/timeline';

@Component({
  selector: 'app-club-discovery',
  imports: [CommonModule, RouterLink],
  templateUrl: './club-discovery.html',
})
export class ClubDiscoveryComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly authService = inject(AuthService);
  private readonly timelineService = inject(TimelineService);
  private readonly router = inject(Router);

  isGuest = signal(!this.authService.isLoggedIn());

  clubs = signal<DiscoverClub[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  updatingClubIds = signal<Record<number, boolean>>({});

  ngOnInit(): void {
    this.isGuest.set(!this.authService.isLoggedIn());
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.clubService.getClubs().subscribe({
      next: response => {
        this.clubs.set(response.clubs);
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Could not load clubs.');
        this.isLoading.set(false);
      },
    });
  }

  isUpdating(clubId: number): boolean {
    return !!this.updatingClubIds()[clubId];
  }

  isOwner(club: DiscoverClub): boolean {
    return club.membership_role === 'OWNER';
  }

  canManageClub(club: DiscoverClub): boolean {
    return ['OWNER', 'ADMIN', 'MODERATOR'].includes(String(club.membership_role ?? ''));
  }

  openAdmin(event: Event, club: DiscoverClub): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/clubs', club.slug, 'admin']);
  }

  private setUpdating(clubId: number, value: boolean): void {
    this.updatingClubIds.update(current => ({ ...current, [clubId]: value }));
  }

  toggleMembership(club: DiscoverClub): void {
    if (!this.authService.isLoggedIn()) return;
    if (this.isOwner(club)) return;
    if (this.isUpdating(club.id)) return;

    this.setUpdating(club.id, true);

    const request$ = club.is_member
      ? this.clubService.leave(club.id)
      : this.clubService.join(club.id);

    request$.subscribe({
      next: () => {
        this.clubs.update(list =>
          list.map(item =>
            item.id === club.id
              ? {
                  ...item,
                  is_member: !club.is_member,
                  membership_role: club.is_member ? null : 'MEMBER',
                }
              : item
          )
        );

        this.authService.me().subscribe({
          next: () => {
            this.timelineService.fetchTimeline().subscribe({
              next: () => {
                this.setUpdating(club.id, false);
              },
              error: () => {
                this.setUpdating(club.id, false);
              },
            });
          },
          error: () => {
            this.setUpdating(club.id, false);
          },
        });
      },
      error: () => {
        this.setUpdating(club.id, false);
      },
    });
  }
}
