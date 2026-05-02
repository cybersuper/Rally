import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface DiscoverClub {
  id: number;
  name: string;
  slug: string;
  description: string;
  accent_color: string;
  sticker_type: string | null;
  cover_image_url?: string | null;
  members_count: number;
  is_member: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ClubService {
  private readonly http = inject(HttpClient);

  getClubs() {
    return this.http.get<{ clubs: DiscoverClub[] }>('/api/clubs');
  }

  getClub(slug: string) {
    return this.http.get<{ club: any }>(`/api/clubs/${slug}`);
  }

  getClubTimeline(slug: string) {
    return this.http.get(`/api/clubs/${slug}/timeline`);
  }

  join(clubId: number) {
    return this.http.post(`/api/clubs/${clubId}/join`, {});
  }

  leave(clubId: number) {
    return this.http.delete(`/api/clubs/${clubId}/leave`);
  }
}
