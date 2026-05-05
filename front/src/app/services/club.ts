import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { safeHexColor } from '../utils/color';

export interface Category {
  id: number;
  name: string;
  slug: string;
  icon_url: string | null;
}

export interface DiscoverClub {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  category_id?: number | null;
  category_model?: Category | null;
  visibility: 'public' | 'private' | string;
  accent_color: string;
  theme_color?: string | null;
  sticker_type: string | null;
  sticker_image_url?: string | null;
  cover_image_url?: string | null;
  members_count: number;
  is_member: boolean;
  membership_role: 'OWNER' | 'MODERATOR' | 'MEMBER' | string | null;
  unread_lounges_count?: number;
  channels?: Array<{
    id: number;
    club_id: number;
    name: string;
    type: 'text' | 'announcement';
    category?: string | null;
    unread_count?: number;
  }>;
}

export interface CreateClubPayload {
  name: string;
  slug: string;
  description: string | null;
  category?: string | null;
  category_id?: number | null;
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

  getCategories() {
    return this.http.get<{ categories: Category[] }>('/api/categories');
  }

  getClubs() {
    return this.http.get<{ clubs: DiscoverClub[] }>('/api/clubs').pipe(
      map(response => ({
        clubs: response.clubs.map(club => this.normalizeClub(club)),
      }))
    );
  }

  createClub(payload: CreateClubPayload) {
    return this.http.post<CreateClubResponse>('/api/clubs', payload).pipe(
      map(response => ({
        club: this.normalizeClub(response.club),
      }))
    );
  }

  getClub(slug: string) {
    return this.http.get<{ club: DiscoverClub }>(`/api/clubs/${slug}`).pipe(
      map(response => ({
        club: this.normalizeClub(response.club),
      }))
    );
  }

  updateClub(slug: string, payload: UpdateClubPayload) {
    return this.http.patch<CreateClubResponse>(`/api/clubs/${slug}`, payload).pipe(
      map(response => ({
        club: this.normalizeClub(response.club),
      }))
    );
  }

  updateClubForm(slug: string, payload: FormData) {
    return this.http.post<CreateClubResponse>(`/api/clubs/${slug}`, payload).pipe(
      map(response => ({
        club: this.normalizeClub(response.club),
      }))
    );
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

  private normalizeClub(club: DiscoverClub): DiscoverClub {
    return {
      ...club,
      accent_color: safeHexColor(club.accent_color ?? club.theme_color),
    };
  }
}
