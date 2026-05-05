import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth';
import { Category, ClubService } from '../../services/club';
import { TimelineService } from '../../services/timeline';

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

@Component({
  selector: 'app-create-club-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-club-page.html',
})
export class CreateClubPageComponent {
  private readonly clubService = inject(ClubService);
  private readonly authService = inject(AuthService);
  private readonly timelineService = inject(TimelineService);
  readonly router = inject(Router);

  isSubmitting = signal(false);
  error = signal<string | null>(null);

  name = signal('');
  slug = signal('');
  slugTouched = signal(false);
  description = signal('');
  category = signal('');
  categories = signal<Category[]>([]);
  categoryId = signal<number | null>(null);
  visibility = signal<'public' | 'private'>('public');
  accentColor = signal('#22d3ee');
  coverPreview = signal<string | null>(null);
  stickerPreview = signal<string | null>(null);
  private coverFile: File | null = null;
  private stickerFile: File | null = null;

  constructor() {
    this.clubService.getCategories().subscribe({
      next: response => this.categories.set(response.categories),
      error: () => this.categories.set([]),
    });
  }

  onCategoryIdChange(value: any): void {
    if (value === null || value === undefined || value === '') {
      this.categoryId.set(null);
      return;
    }

    const parsed = Number(value);
    this.categoryId.set(Number.isFinite(parsed) ? parsed : null);
  }

  onNameChange(value: string): void {
    this.name.set(value);

    if (!this.slugTouched()) {
      this.slug.set(slugify(value));
    }
  }

  onSlugChange(value: string): void {
    this.slugTouched.set(true);
    this.slug.set(slugify(value));
  }

  setCoverImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.coverFile = file;
    this.coverPreview.set(file ? URL.createObjectURL(file) : null);
  }

  setStickerImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.stickerFile = file;
    this.stickerPreview.set(file ? URL.createObjectURL(file) : null);
  }

  submit(): void {
    this.error.set(null);

    const name = this.name().trim();
    const slug = slugify(this.slug());
    const description = this.description().trim();
    const category = this.category().trim();
    const categoryId = this.categoryId();
    const accentColor = this.accentColor().trim();

    if (!name) {
      this.error.set('Enter a club name.');
      return;
    }

    if (!slug) {
      this.error.set('Enter a slug.');
      return;
    }

    this.isSubmitting.set(true);

    const payload = new FormData();
    payload.append('name', name);
    payload.append('slug', slug);
    payload.append('description', description.length ? description : '');
    payload.append('category', category.length ? category : '');
    if (categoryId !== null) payload.append('category_id', String(categoryId));
    payload.append('visibility', this.visibility());
    payload.append('accent_color', accentColor);
    if (this.coverFile) payload.append('cover_image', this.coverFile);
    if (this.stickerFile) payload.append('sticker_image', this.stickerFile);

    this.clubService
      .createClubForm(payload)
      .subscribe({
        next: (response: { club: { slug: string } }) => {
          this.authService.me().subscribe({
            next: () => {
              this.timelineService.fetchTimeline().subscribe({
                next: () => {
                  this.isSubmitting.set(false);
                  this.router.navigateByUrl(`/clubs/${response.club.slug}`);
                },
                error: () => {
                  this.isSubmitting.set(false);
                  this.router.navigateByUrl(`/clubs/${response.club.slug}`);
                },
              });
            },
            error: () => {
              this.isSubmitting.set(false);
              this.router.navigateByUrl(`/clubs/${response.club.slug}`);
            },
          });
        },
        error: (err: any) => {
          this.isSubmitting.set(false);

          if (err?.status === 422) {
            this.error.set('Check the fields and try again.');
            return;
          }

          this.error.set('Could not create club.');
        },
      });
  }
}
