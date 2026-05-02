import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../auth';
import { ClubService } from '../../services/club';
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
  accentColor = signal('#22d3ee');

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

  submit(): void {
    this.error.set(null);

    const name = this.name().trim();
    const slug = slugify(this.slug());
    const description = this.description().trim();
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

    this.clubService
      .createClub({
        name,
        slug,
        description: description.length ? description : null,
        accent_color: accentColor,
      })
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
