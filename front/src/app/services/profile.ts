import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { safeHexColor } from '../utils/color';

export interface ProfileClub {
  id: number;
  name: string;
  slug: string;
  accent_color: string | null;
  sticker_type?: string | null;
  cover_image_url?: string | null;
  membership_role?: string | null;
  nickname?: string | null;
}

export interface UserProfile {
  id: number;
  name: string;
  username: string;
  bio: string | null;
  profile_photo_path: string | null;
  cover_photo_path: string | null;
  current_streak: number;
  longest_streak: number;
  is_owner: boolean;
  clubs: ProfileClub[];
  flairs: Array<{
    id: number;
    name: string;
    color: string;
    club?: { id: number; name: string; slug: string };
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class ProfileService {
  private readonly http = inject(HttpClient);

  getProfile(username: string) {
    return this.http.get<{ profile: UserProfile }>(`/api/profiles/${username}`).pipe(
      map(response => ({
        profile: {
          ...response.profile,
          clubs: response.profile.clubs.map(club => ({
            ...club,
            accent_color: safeHexColor(club.accent_color),
          })),
        },
      }))
    );
  }

  updateProfile(payload: FormData) {
    return this.http.post<{ profile: UserProfile }>('/api/profiles/me', payload).pipe(
      map(response => ({
        profile: {
          ...response.profile,
          clubs: response.profile.clubs.map(club => ({
            ...club,
            accent_color: safeHexColor(club.accent_color),
          })),
        },
      }))
    );
  }
}
