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

  getComments(postId: number) {
    return this.http.get(`/api/posts/${postId}/comments`);
  }

  addComment(postId: number, content: string) {
    return this.http.post(`/api/posts/${postId}/comments`, {
      content,
    });
  }
}