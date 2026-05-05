import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { ClubService, DiscoverClub } from '../../services/club';
import { ClubSkeletonComponent } from '../club-skeleton/club-skeleton';

@Component({
  selector: 'app-suggested-clubs',
  imports: [CommonModule, RouterLink, ClubSkeletonComponent],
  templateUrl: './suggested-clubs.html',
})
export class SuggestedClubsComponent implements OnInit {
  private readonly clubService = inject(ClubService);
  private readonly authService = inject(AuthService);

  clubs = signal<DiscoverClub[]>([]);
  isLoading = signal(true);

  ngOnInit(): void {
    if (!this.authService.isLoggedIn()) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);

    this.clubService.getSuggestedClubs().subscribe({
      next: response => {
        this.clubs.set(response.clubs);
        this.isLoading.set(false);
      },
      error: () => {
        this.clubs.set([]);
        this.isLoading.set(false);
      },
    });
  }
}
