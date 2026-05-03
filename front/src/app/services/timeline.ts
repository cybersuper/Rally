import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { PaginatedPosts, Post } from '../types/post';
import { safeHexColor } from '../utils/color';

@Injectable({
  providedIn: 'root',
})
export class TimelineService {
  private readonly http = inject(HttpClient);

  posts = signal<Post[]>([]);

  getTimeline(): Observable<PaginatedPosts> {
    return this.http.get<PaginatedPosts>('/api/timeline').pipe(
      map(response => ({
        ...response,
        data: this.normalizePosts(response.data),
      }))
    );
  }

  fetchTimeline(): Observable<PaginatedPosts> {
    return this.getTimeline().pipe(
      tap(response => {
        this.setPosts(response.data);
      })
    );
  }

  setPosts(posts: Post[]): void {
    this.posts.set(this.normalizePosts(posts));
  }

  prependPost(post: Post): void {
    this.posts.update(current => [this.normalizePost(post), ...current]);
  }

  removePost(postId: number): void {
    this.posts.update(current => current.filter(post => post.id !== postId));
  }

  normalizePosts(posts: Post[]): Post[] {
    return posts.map(post => this.normalizePost(post));
  }

  normalizePost(post: Post): Post {
    return {
      ...post,
      club: {
        ...post.club,
        accent_color: safeHexColor(post.club?.accent_color ?? post.club?.theme_color),
      },
    };
  }
}
