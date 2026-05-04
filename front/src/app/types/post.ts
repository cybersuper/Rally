export type PostType = 'standard' | 'question' | 'log' | 'lfg';

export interface RallyUser {
  id: number;
  name: string;
  email: string;
  username?: string;
  club_nickname?: string | null;
  profile_photo_path?: string | null;
}

export interface FeaturedPostComment {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  helpful_count: number;
  is_best_answer: boolean;
  created_at?: string;
  updated_at?: string;
  user: RallyUser | null;
}

export interface Club {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  visibility?: 'public' | 'private' | string;
  accent_color: string | null;
  theme_color?: string | null;
  sticker_type: string | null;
  sticker_image_url?: string | null;
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
  featured_comment?: FeaturedPostComment | null;
  comments_count?: number;
  top_level_comments_count?: number;
  total_comments_count?: number;
  likes_count?: number;
  liked_by_me?: boolean | number;
  author_name?: string;
  author_photo?: string | null;
}

export interface PaginatedPosts {
  data: Post[];
  current_page: number;
  last_page: number;
  next_page_url: string | null;
}
