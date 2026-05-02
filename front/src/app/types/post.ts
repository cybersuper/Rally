export type PostType = 'standard' | 'question' | 'log' | 'lfg';

export interface RallyUser {
  id: number;
  name: string;
  email: string;
}

export interface Club {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  visibility?: 'public' | 'private' | string;
  accent_color: string;
  sticker_type: string | null;
  membership_role?: 'OWNER' | 'MODERATOR' | 'MEMBER' | string | null;
}

export interface Post {
  id: number;
  user_id: number;
  club_id: number;
  title: string;
  content: string;
  type: PostType;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  user: RallyUser;
  club: Club;
}

export interface PaginatedPosts {
  data: Post[];
  current_page: number;
  last_page: number;
  next_page_url: string | null;
}
