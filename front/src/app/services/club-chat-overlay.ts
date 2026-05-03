import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ClubChatOverlayState {
  isOpen = signal(false);
  slug = signal<string>('');
  currentClub = signal<{ id: number; slug: string; name: string } | null>(null);

  open(slug: string): void {
    this.slug.set(slug);
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.isOpen.set(false);
    document.body.style.overflow = '';
  }

  setCurrentClub(club: { id: number; slug: string; name: string } | null): void {
    this.currentClub.set(club);
  }
}
