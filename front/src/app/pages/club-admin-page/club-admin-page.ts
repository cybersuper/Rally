import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { ClubService, DiscoverClub } from '../../services/club';
import { safeHexColor } from '../../utils/color';

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
  coverPreview = signal<string | null>(null);
  stickerPreview = signal<string | null>(null);
  private coverFile: File | null = null;
  private stickerFile: File | null = null;

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
        this.accentColor.set(safeHexColor(club.accent_color ?? club.theme_color));
        this.coverPreview.set(club.cover_image_url ?? null);
        this.stickerPreview.set(club.sticker_image_url ?? null);
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

    const payload = new FormData();
    payload.append('name', name);
    payload.append('description', this.description().trim());
    payload.append('category', this.category().trim());
    payload.append('visibility', this.visibility());
    payload.append('accent_color', this.accentColor().trim());
    if (this.coverFile) payload.append('cover_image', this.coverFile);
    if (this.stickerFile) payload.append('sticker_image', this.stickerFile);

    this.clubService
      .updateClubForm(club.slug, payload)
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

  setCoverImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.coverFile = file;
    if (file) this.coverPreview.set(URL.createObjectURL(file));
  }

  setStickerImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.stickerFile = file;
    if (file) this.stickerPreview.set(URL.createObjectURL(file));
  }
}
