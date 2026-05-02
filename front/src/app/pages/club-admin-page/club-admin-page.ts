import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { ClubService, DiscoverClub } from '../../services/club';

@Component({
  selector: 'app-club-admin-page',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './club-admin-page.html',
})
export class ClubAdminPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clubService = inject(ClubService);
  private readonly authService = inject(AuthService);

  club = signal<DiscoverClub | null>(null);
  isLoading = signal(true);
  isSaving = signal(false);
  error = signal<string | null>(null);
  saved = signal(false);

  name = signal('');
  description = signal('');
  category = signal('');
  visibility = signal<'public' | 'private'>('public');
  accentColor = signal('#ef4444');
  coverImageUrl = signal('');

  ngOnInit(): void {
    this.load();
  }

  private slug(): string {
    return this.route.snapshot.paramMap.get('slug') ?? '';
  }

  load(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.clubService.getClub(this.slug()).subscribe({
      next: response => {
        const club = response.club;
        this.club.set(club);
        this.name.set(club.name);
        this.description.set(club.description ?? '');
        this.category.set(club.category ?? '');
        this.visibility.set(club.visibility === 'private' ? 'private' : 'public');
        this.accentColor.set(club.accent_color);
        this.coverImageUrl.set(club.cover_image_url ?? '');
        this.isLoading.set(false);
      },
      error: () => {
        this.error.set('Could not load club settings.');
        this.isLoading.set(false);
      },
    });
  }

  save(): void {
    const club = this.club();

    if (!club || this.isSaving()) return;

    const name = this.name().trim();

    if (!name) {
      this.error.set('Enter a club name.');
      return;
    }

    this.isSaving.set(true);
    this.error.set(null);
    this.saved.set(false);

    this.clubService
      .updateClub(club.slug, {
        name,
        description: this.description().trim() || null,
        category: this.category().trim() || null,
        visibility: this.visibility(),
        accent_color: this.accentColor().trim(),
        cover_image_url: this.coverImageUrl().trim() || null,
      })
      .subscribe({
        next: response => {
          this.club.set(response.club);
          this.saved.set(true);
          this.authService.me().subscribe({
            next: () => this.isSaving.set(false),
            error: () => this.isSaving.set(false),
          });
        },
        error: err => {
          this.isSaving.set(false);

          if (err?.status === 403) {
            this.router.navigateByUrl(`/clubs/${club.slug}`);
            return;
          }

          if (err?.status === 422) {
            this.error.set('Check the fields and try again.');
            return;
          }

          this.error.set('Could not save club settings.');
        },
      });
  }
}
