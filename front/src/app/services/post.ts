import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

export interface OwnedLfgPost extends Post {
  applications: LfgApplication[];
  lfg_applications_count: number;
}

@Injectable({
  providedIn: 'root',
})
export class PostService {
  private readonly http = inject(HttpClient);

  createPost(payload: CreatePostPayload) {
    return this.http.post<CreatePostResponse>('/api/posts', payload);
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
    return this.http.get<{ posts: OwnedLfgPost[] }>('/api/me/lfg-posts');
  }

  updateLfgApplication(applicationId: number, status: 'accepted' | 'rejected') {
    return this.http.patch<LfgApplicationActionResponse>(
      `/api/lfg-applications/${applicationId}`,
      { status }
    );
  }

  getComments(postId: number) {
    return this.http.get(`/api/posts/${postId}/comments`);
  }

  addComment(postId: number, content: string) {
    return this.http.post(`/api/posts/${postId}/comments`, {
      content,
    });
  }
}
