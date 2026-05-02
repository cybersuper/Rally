import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface DiscoverClub {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  visibility: 'public' | 'private' | string;
  accent_color: string;
  sticker_type: string | null;
  cover_image_url?: string | null;
  members_count: number;
  is_member: boolean;
  membership_role: 'OWNER' | 'MODERATOR' | 'MEMBER' | string | null;
}

export interface CreateClubPayload {
  name: string;
  slug: string;
  description: string | null;
  category?: string | null;
  visibility?: 'public' | 'private';
  accent_color: string;
  cover_image_url?: string | null;
}

export interface CreateClubResponse {
  club: DiscoverClub;
}

export interface UpdateClubPayload {
  name?: string;
  description: string | null;
  category: string | null;
  visibility: 'public' | 'private';
  accent_color: string;
  cover_image_url?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class ClubService {
  private readonly http = inject(HttpClient);

  getClubs() {
    return this.http.get<{ clubs: DiscoverClub[] }>('/api/clubs');
  }

  createClub(payload: CreateClubPayload) {
    return this.http.post<CreateClubResponse>('/api/clubs', payload);
  }

  getClub(slug: string) {
    return this.http.get<{ club: DiscoverClub }>(`/api/clubs/${slug}`);
  }

  updateClub(slug: string, payload: UpdateClubPayload) {
    return this.http.patch<CreateClubResponse>(`/api/clubs/${slug}`, payload);
  }

  getClubTimeline(slug: string) {
    return this.http.get(`/api/clubs/${slug}/timeline`);
  }

  join(clubId: number) {
    return this.http.post<{ message: string; membership_role: string }>(`/api/clubs/${clubId}/join`, {});
  }

  leave(clubId: number) {
    return this.http.delete(`/api/clubs/${clubId}/leave`);
  }
}
