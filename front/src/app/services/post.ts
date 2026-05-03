import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { TimelineService } from './timeline';
import { Post } from '../types/post';

export interface CreatePostPayload {
  club_id: number;
  title: string;
  content: string;
  type: 'standard' | 'question' | 'log' | 'lfg';
  metadata?: Record<string, any>;
}

export interface CreatePostResponse {
  post: Post;
}

export interface LfgApplication {
  id: number;
  post_id: number;
  user_id: number;
  status: 'pending' | 'accepted' | 'rejected' | string;
  answers: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface LfgApplicationActionResponse {
  application: LfgApplication;
  post: {
    id: number;
    metadata: Record<string, any>;
  };
}

export interface PostComment {
  id: number;
  post_id: number;
  user_id: number;
  parent_id: number | null;
  content: string;
  helpful_count: number;
  is_best_answer: boolean;
  likes_count: number;
  liked_by_me: boolean | number;
  created_at?: string;
  updated_at?: string;
  user: {
    id: number;
    name: string;
    email: string;
  } | null;
  replies?: PostComment[];
}

export interface LikeSummary {
  liked: boolean;
  likes_count: number;
}

export interface OwnedLfgPost extends Post {
  applications: LfgApplication[];
  lfg_applications_count: number;
}

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private readonly http = inject(HttpClient);
  private readonly timelineService = inject(TimelineService);

  createPost(payload: CreatePostPayload) {
    return this.http.post<CreatePostResponse>('/api/posts', payload).pipe(
      map(response => ({
        post: this.timelineService.normalizePost(response.post),
      }))
    );
  }

  deletePost(postId: number) {
    return this.http.delete<{ message: string }>(`/api/posts/${postId}`);
  }

  getPost(postId: number) {
    return this.http.get<{ post: Post }>(`/api/posts/${postId}`).pipe(
      map(response => ({
        post: this.timelineService.normalizePost(response.post),
      }))
    );
  }

  likePost(postId: number) {
    return this.http.post<LikeSummary>(`/api/posts/${postId}/likes`, {});
  }

  unlikePost(postId: number) {
    return this.http.delete<LikeSummary>(`/api/posts/${postId}/likes`);
  }

  applyToLfg(postId: number, answers?: Record<string, any>) {
    return this.http.post(`/api/posts/${postId}/lfg-applications`, {
      answers: answers ?? {},
    });
  }

  getLfgApplications(postId: number) {
    return this.http.get<{ applications: LfgApplication[] }>(
      `/api/posts/${postId}/lfg-applications`
    );
  }

  getOwnedLfgPosts() {
    return this.http.get<{ posts: OwnedLfgPost[] }>('/api/me/lfg-posts').pipe(
      map(response => ({
        posts: this.timelineService.normalizePosts(response.posts) as OwnedLfgPost[],
      }))
    );
  }

  updateLfgApplication(applicationId: number, status: 'accepted' | 'rejected') {
    return this.http.patch<LfgApplicationActionResponse>(
      `/api/lfg-applications/${applicationId}`,
      { status }
    );
  }

  getComments(postId: number, preview = false) {
    return this.http.get<{ comments: PostComment[] }>(`/api/posts/${postId}/comments`, {
      params: preview ? { preview: '1' } : {},
    });
  }

  addComment(postId: number, content: string, parentId: number | null = null) {
    return this.http.post<{ comment: PostComment }>(`/api/posts/${postId}/comments`, {
      content,
      parent_id: parentId,
    });
  }

  deleteComment(commentId: number) {
    return this.http.delete<{ message: string }>(`/api/comments/${commentId}`);
  }

  likeComment(commentId: number) {
    return this.http.post<LikeSummary>(`/api/comments/${commentId}/likes`, {});
  }

  unlikeComment(commentId: number) {
    return this.http.delete<LikeSummary>(`/api/comments/${commentId}/likes`);
  }
}
