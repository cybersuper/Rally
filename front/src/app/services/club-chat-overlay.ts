import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ClubChatOverlayState {
  isOpen = signal(false);
  slug = signal<string>('');
  loungeId = signal<number | null>(null);
  currentClub = signal<{ id: number; slug: string; name: string } | null>(null);

  open(slug: string, loungeId: number | null = null): void {
    this.slug.set(slug);
    this.loungeId.set(loungeId);
    this.isOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.isOpen.set(false);
    this.loungeId.set(null);
    document.body.style.overflow = '';
  }

  setCurrentClub(club: { id: number; slug: string; name: string } | null): void {
    this.currentClub.set(club);
  }
}
