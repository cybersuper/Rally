import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { PaginatedPosts, Post } from '../types/post';

@Injectable({
  providedIn: 'root',
})
export class TimelineService {
  private readonly http = inject(HttpClient);

  posts = signal<Post[]>([]);

  getTimeline(): Observable<PaginatedPosts> {
    return this.http.get<PaginatedPosts>('/api/timeline');
  }

  setPosts(posts: Post[]): void {
    this.posts.set(posts);
  }

  prependPost(post: Post): void {
    this.posts.update(current => [post, ...current]);
  }
}