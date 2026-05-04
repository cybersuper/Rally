import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PostCard } from '../../components/post-card/post-card';
import { PostComment, PostService } from '../../services/post';
import { Post } from '../../types/post';
import { AuthService } from '../../auth';

interface FlatComment {
  comment: PostComment;
  depth: number;
}

@Component({
  selector: 'app-post-detail-page',
  imports: [CommonModule, FormsModule, RouterLink, PostCard],
  templateUrl: './post-detail-page.html',
})
export class PostDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly postService = inject(PostService);
  private readonly authService = inject(AuthService);

  post = signal<Post | null>(null);
  comments = signal<PostComment[]>([]);
  isLoading = signal(true);
  isCommenting = signal(false);
  updatingCommentId = signal<number | null>(null);
  error = signal<string | null>(null);
  commentText = signal('');
  replyText = signal('');
  replyingToId = signal<number | null>(null);
  openMenuId = signal<number | null>(null);

  flatComments = computed<FlatComment[]>(() => this.flattenComments(this.comments()));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const postId = Number(this.route.snapshot.paramMap.get('id'));

    this.isLoading.set(true);
    this.error.set(null);

    this.postService.getPost(postId).subscribe({
      next: response => {
        this.post.set(response.post);
        this.loadComments(postId);
      },
      error: err => {
        console.error('Post detail load failed', err);
        this.error.set(err?.status === 403 ? 'Join this club to view this thread.' : 'Could not load post.');
        this.isLoading.set(false);
      },
    });
  }

  loadComments(postId: number): void {
    this.postService.getComments(postId).subscribe({
      next: response => {
        this.comments.set(response.comments);
        this.isLoading.set(false);
      },
      error: err => {
        console.error('Post comments load failed', err);
        this.error.set('Could not load comments.');
        this.isLoading.set(false);
      },
    });
  }

  submitComment(parentId: number | null = null): void {
    const post = this.post();
    const content = parentId ? this.replyText().trim() : this.commentText().trim();

    if (!post || !content || this.isCommenting()) return;

    this.isCommenting.set(true);
    this.error.set(null);

    this.postService.addComment(post.id, content, parentId).subscribe({
      next: () => {
        this.commentText.set('');
        this.replyText.set('');
        this.replyingToId.set(null);
        this.loadComments(post.id);
        this.isCommenting.set(false);
      },
      error: err => {
        console.error('Comment submit failed', err);
        this.error.set('Could not add comment.');
        this.isCommenting.set(false);
      },
    });
  }

  startReply(commentId: number): void {
    this.replyingToId.set(commentId);
    this.replyText.set('');
  }

  cancelReply(): void {
    this.replyingToId.set(null);
    this.replyText.set('');
  }

  toggleCommentLike(comment: PostComment): void {
    if (this.updatingCommentId() !== null) return;

    this.updatingCommentId.set(comment.id);

    const request$ = comment.liked_by_me
      ? this.postService.unlikeComment(comment.id)
      : this.postService.likeComment(comment.id);

    request$.subscribe({
      next: response => {
        this.comments.update(comments => this.updateComment(comments, comment.id, current => ({
          ...current,
          liked_by_me: response.liked,
          likes_count: response.likes_count,
        })));
        this.updatingCommentId.set(null);
      },
      error: err => {
        console.error('Comment vote failed', err);
        this.updatingCommentId.set(null);
      },
    });
  }

  isHelpfulComment(comment: PostComment): boolean {
    return !!comment.is_helpful || !!comment.is_best_answer || Number(comment.likes_count ?? 0) > 10;
  }

  parentUserName(item: FlatComment): string | null {
    if (!item.comment.parent_id) return null;
    return this.flatComments().find(entry => entry.comment.id === item.comment.parent_id)?.comment.user?.name ?? null;
  }

  canEditComment(comment: PostComment): boolean {
    return Number(comment.user_id) === Number(this.authService.user()?.id) && !this.isHelpfulComment(comment);
  }

  isPostOwner(): boolean {
    return Number(this.post()?.user_id) === Number(this.authService.user()?.id);
  }

  replyDisplayName(comment: PostComment): string {
    return comment.user?.club_nickname || comment.user?.name || 'Member';
  }

  replyUsername(comment: PostComment): string | null {
    return comment.user?.username ?? null;
  }

  replyAvatar(comment: PostComment): string | null {
    return comment.user?.profile_photo_path ?? null;
  }

  toggleMenu(commentId: number): void {
    this.openMenuId.update(current => current === commentId ? null : commentId);
  }

  editComment(comment: PostComment): void {
    if (!this.canEditComment(comment)) return;
    const next = window.prompt('Edit reply', comment.content)?.trim();
    if (!next || next === comment.content) return;

    this.postService.updateComment(comment.id, next).subscribe({
      next: response => {
        this.comments.update(comments => this.updateComment(comments, comment.id, () => response.comment));
        this.openMenuId.set(null);
      },
      error: err => {
        console.error('Comment edit failed', err);
        this.error.set('Could not edit comment.');
      },
    });
  }

  toggleHelpful(comment: PostComment): void {
    if (!this.isPostOwner()) return;

    this.postService.markCommentHelpful(comment.id, !this.isHelpfulComment(comment)).subscribe({
      next: response => {
        this.comments.update(comments => this.updateComment(comments, comment.id, () => response.comment));
        this.openMenuId.set(null);
      },
      error: err => {
        console.error('Helpful toggle failed', err);
        this.error.set('Could not update helpful reply.');
      },
    });
  }

  private flattenComments(comments: PostComment[], depth = 0): FlatComment[] {
    return comments.flatMap(comment => [
      {
        comment,
        depth,
      },
      ...this.flattenComments(comment.replies ?? [], depth + 1),
    ]);
  }

  private updateComment(
    comments: PostComment[],
    commentId: number,
    update: (comment: PostComment) => PostComment
  ): PostComment[] {
    return comments.map(comment => {
      if (comment.id === commentId) {
        return update(comment);
      }

      return {
        ...comment,
        replies: this.updateComment(comment.replies ?? [], commentId, update),
      };
    });
  }
}
