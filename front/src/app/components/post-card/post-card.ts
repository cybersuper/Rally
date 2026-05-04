import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HotToastService } from '@ngxpert/hot-toast';
import { AuthService } from '../../auth';
import { LfgApplication, PostComment, PostService } from '../../services/post';
import { TimelineService } from '../../services/timeline';
import { Post } from '../../types/post';

@Component({
  selector: 'app-post-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './post-card.html',
  styleUrl: './post-card.css',
})
export class PostCard {
  private readonly postService = inject(PostService);
  private readonly authService = inject(AuthService);
  private readonly timelineService = inject(TimelineService);
  private readonly router = inject(Router);
  private readonly toast = inject(HotToastService);

  post = input.required<Post>();

  isApplying = signal(false);
  hasApplied = signal(false);
  isApplyModalOpen = signal(false);
  applyError = signal<string | null>(null);
  applyAnswers = signal<Record<string, any>>({});

  isManageOpen = signal(false);
  isLoadingApplications = signal(false);
  manageError = signal<string | null>(null);
  applications = signal<LfgApplication[]>([]);
  updatingApplicationId = signal<number | null>(null);

  metadataOverride = signal<Record<string, any> | null>(null);
  likesCountOverride = signal<number | null>(null);
  likedOverride = signal<boolean | null>(null);
  commentsCountOverride = signal<number | null>(null);

  commentsOpen = signal(false);
  quickViewOpen = signal(false);
  isLoadingComments = signal(false);
  isCommenting = signal(false);
  deletingCommentId = signal<number | null>(null);
  comments = signal<PostComment[]>([]);
  commentText = signal('');
  replyText = signal('');
  replyingToId = signal<number | null>(null);
  commentError = signal<string | null>(null);
  likeError = signal<string | null>(null);
  deleteError = signal<string | null>(null);
  isDeletingPost = signal(false);
  isDeleted = signal(false);
  flatComments = computed(() => this.flattenComments(this.comments()));

  openThread(): void {
    this.router.navigate(['/clubs', this.post().club.slug, 'posts', this.post().id]);
  }

  stop(event: Event): void {
    event.stopPropagation();
  }

  canManageApplications(): boolean {
    const userId = this.authService.user()?.id;
    return this.post().type === 'lfg' && !!userId && this.post().user_id === userId;
  }

  canModerateClub(): boolean {
    const clubs = this.authService.user()?.clubs ?? [];
    const club = clubs.find((item: any) => item.id === this.post().club_id || item.slug === this.post().club.slug);

    return ['OWNER', 'ADMIN', 'MODERATOR'].includes(String(club?.membership_role ?? ''));
  }

  canDeletePost(): boolean {
    const userId = this.authService.user()?.id;
    return !!userId && (this.post().user_id === userId || this.canModerateClub());
  }

  canDeleteComment(comment: PostComment): boolean {
    const userId = this.authService.user()?.id;
    return !!userId && (comment.user_id === userId || this.canModerateClub());
  }

  openManage(): void {
    if (!this.canManageApplications()) return;
    this.isManageOpen.set(true);
    this.loadApplications();
  }

  closeManage(): void {
    if (this.updatingApplicationId() !== null) return;
    this.isManageOpen.set(false);
  }

  loadApplications(): void {
    if (this.isLoadingApplications()) return;

    this.manageError.set(null);
    this.isLoadingApplications.set(true);

    this.postService.getLfgApplications(this.post().id).subscribe({
      next: response => {
        this.applications.set(response.applications);
        this.isLoadingApplications.set(false);
      },
      error: err => {
        this.isLoadingApplications.set(false);
        this.manageError.set(
          err?.status === 403 ? 'Only the party leader can view applications.' : 'Could not load applications.'
        );
      },
    });
  }

  setApplicationStatus(application: LfgApplication, status: 'accepted' | 'rejected'): void {
    if (this.updatingApplicationId() !== null) return;

    this.manageError.set(null);
    this.updatingApplicationId.set(application.id);

    this.postService.updateLfgApplication(application.id, status).subscribe({
      next: response => {
        this.metadataOverride.set(response.post.metadata);
        this.applications.update(list =>
          list.map(item => (item.id === application.id ? response.application : item))
        );

        this.timelineService.fetchTimeline().subscribe({
          next: () => this.updatingApplicationId.set(null),
          error: () => this.updatingApplicationId.set(null),
        });
      },
      error: err => {
        this.updatingApplicationId.set(null);
        this.manageError.set(err?.status === 422 ? 'No open seats remain.' : 'Could not update application.');
      },
    });
  }

  lfgApplicationFields(): Array<{
    key: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    type?: string;
    options?: string[];
    true_label?: string;
    false_label?: string;
  }> {
    const raw = this.metadataValue<any[]>('application_fields', []);

    if (Array.isArray(raw) && raw.length) {
      return raw
        .filter(Boolean)
        .map(field => ({
          key: String(field.key ?? field.id ?? ''),
          label: String(field.label ?? field.key ?? 'Field'),
          placeholder: field.placeholder ? String(field.placeholder) : undefined,
          required: !!field.required,
          type: field.type ? String(field.type) : 'text',
          options: Array.isArray(field.options) ? field.options.map((option: any) => String(option)) : [],
          true_label: field.true_label ? String(field.true_label) : 'Yes',
          false_label: field.false_label ? String(field.false_label) : 'No',
        }))
        .filter(field => field.key.trim().length > 0);
    }

    return [
      {
        key: 'message',
        label: 'Message',
        placeholder: "Say hi and share what you're looking for",
        required: true,
        type: 'textarea',
      },
    ];
  }

  initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  metadataValue<T>(key: string, fallback: T): T {
    return ((this.metadataOverride() ?? this.post().metadata)?.[key] ?? fallback) as T;
  }

  typeLabel(): string {
    const type = this.post().type;

    if (type === 'lfg') return 'LFG';
    if (type === 'question') return 'Question';
    if (type === 'log') return 'Log';

    return 'Standard';
  }

  stickerClass(): string {
    const type = this.post().type;

    if (type === 'lfg') return 'rally-sticker rally-sticker-d20';
    if (type === 'question') return 'rally-sticker rally-sticker-question';
    if (type === 'log') return 'rally-sticker rally-sticker-fire';

    return 'rally-sticker rally-sticker-sparkle';
  }

  stickerText(): string {
    const type = this.post().type;

    if (type === 'lfg') return 'D20';
    if (type === 'question') return '?';
    if (type === 'log') return 'HOT';

    return '*';
  }

  lfgProgress(): number {
    const filled = this.metadataValue<number>('spots_filled', 0);
    const total = this.metadataValue<number>('spots_total', 1);

    return Math.min(100, Math.max(0, (filled / total) * 100));
  }

  lfgStatusLabel(): string {
    return this.metadataValue<string>('status', 'open') === 'full' ? 'Full' : 'Open';
  }

  spotsRemaining(): number {
    const explicit = this.metadataValue<number | null>('spots_remaining', null);

    if (explicit !== null) {
      return explicit;
    }

    return Math.max(
      0,
      this.metadataValue<number>('spots_total', 0) - this.metadataValue<number>('spots_filled', 0)
    );
  }

  canApply(): boolean {
    return !this.canManageApplications() && this.lfgStatusLabel() !== 'Full' && this.spotsRemaining() > 0;
  }

  likesCount(): number {
    return this.likesCountOverride() ?? Number(this.post().likes_count ?? 0);
  }

  commentsCount(): number {
    return this.commentsCountOverride() ?? Number(
      this.post().total_comments_count ?? this.post().comments_count ?? 0
    );
  }

  topLevelCommentsCount(): number {
    return Number(this.post().top_level_comments_count ?? this.commentsCount());
  }

  likedByMe(): boolean {
    const override = this.likedOverride();

    if (override !== null) {
      return override;
    }

    return !!this.post().liked_by_me;
  }

  toggleLike(event?: Event): void {
    event?.stopPropagation();
    this.likeError.set(null);

    const request$ = this.likedByMe()
      ? this.postService.unlikePost(this.post().id)
      : this.postService.likePost(this.post().id);

    request$.subscribe({
      next: response => {
        this.likedOverride.set(response.liked);
        this.likesCountOverride.set(response.likes_count);
      },
      error: () => this.likeError.set('Could not update like.'),
    });
  }

  toggleComments(event?: Event): void {
    event?.stopPropagation();
    this.commentsOpen.set(!this.commentsOpen());
    this.quickViewOpen.set(false);

    if (this.commentsOpen() && !this.comments().length) {
      this.loadComments(true);
    }
  }

  openQuickView(event: Event): void {
    event.stopPropagation();
    this.commentsOpen.set(true);
    this.quickViewOpen.set(true);
    this.loadComments(false);
  }

  loadComments(preview = !this.quickViewOpen()): void {
    if (this.isLoadingComments()) return;

    this.commentError.set(null);
    this.isLoadingComments.set(true);

    this.postService.getComments(this.post().id, preview).subscribe({
      next: response => {
        this.comments.set(response.comments);
        this.isLoadingComments.set(false);
      },
      error: () => {
        this.commentError.set('Could not load comments.');
        this.isLoadingComments.set(false);
      },
    });
  }

  submitComment(event?: Event): void {
    event?.stopPropagation();
    const content = this.commentText().trim();

    if (!content || this.isCommenting()) return;

    this.commentError.set(null);
    this.isCommenting.set(true);

    this.postService.addComment(this.post().id, content).subscribe({
      next: () => {
        this.commentText.set('');
        this.commentsOpen.set(true);
        this.commentsCountOverride.set(this.commentsCount() + 1);
        this.loadComments(!this.quickViewOpen());
        this.isCommenting.set(false);
      },
      error: () => {
        this.commentError.set('Could not post comment.');
        this.isCommenting.set(false);
      },
    });
  }

  startReply(comment: PostComment, event?: Event): void {
    event?.stopPropagation();
    const hadFullTree = this.quickViewOpen();

    this.commentsOpen.set(true);
    this.quickViewOpen.set(true);
    this.replyingToId.set(comment.id);
    this.replyText.set('');

    if (!this.comments().length || !hadFullTree) {
      this.loadComments(false);
    }
  }

  cancelReply(event?: Event): void {
    event?.stopPropagation();
    this.replyingToId.set(null);
    this.replyText.set('');
  }

  submitReply(parentId: number, event?: Event): void {
    event?.stopPropagation();
    const content = this.replyText().trim();

    if (!content || this.isCommenting()) return;

    this.commentError.set(null);
    this.isCommenting.set(true);

    this.postService.addComment(this.post().id, content, parentId).subscribe({
      next: () => {
        this.replyText.set('');
        this.replyingToId.set(null);
        this.commentsOpen.set(true);
        this.quickViewOpen.set(true);
        this.commentsCountOverride.set(this.commentsCount() + 1);
        this.loadComments(false);
        this.isCommenting.set(false);
      },
      error: () => {
        this.commentError.set('Could not post reply.');
        this.isCommenting.set(false);
      },
    });
  }

  sharePost(event: Event): void {
    event.stopPropagation();
    const path = `/clubs/${this.post().club.slug}/posts/${this.post().id}`;
    const url = `${window.location.origin}${path}`;

    if (navigator?.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => this.toast.success('Link copied to clipboard!'))
        .catch(() => this.toast.error('Could not copy link.'));
      return;
    }

    this.toast.error('Clipboard API unavailable.');
  }

  deleteComment(comment: PostComment, event?: Event): void {
    event?.stopPropagation();
    if (this.deletingCommentId() !== null || !this.canDeleteComment(comment)) return;

    this.commentError.set(null);
    this.deletingCommentId.set(comment.id);

    this.postService.deleteComment(comment.id).subscribe({
      next: () => {
        this.comments.update(list => list.filter(item => item.id !== comment.id));
        this.commentsCountOverride.set(Math.max(0, this.commentsCount() - 1));
        this.deletingCommentId.set(null);
      },
      error: () => {
        this.commentError.set('Could not delete comment.');
        this.deletingCommentId.set(null);
      },
    });
  }

  deletePost(event?: Event): void {
    event?.stopPropagation();
    if (this.isDeletingPost() || !this.canDeletePost()) return;

    this.deleteError.set(null);
    this.isDeletingPost.set(true);

    this.postService.deletePost(this.post().id).subscribe({
      next: () => {
        this.isDeleted.set(true);
        this.timelineService.removePost(this.post().id);
      },
      error: () => {
        this.deleteError.set('Could not delete post.');
        this.isDeletingPost.set(false);
      },
    });
  }

  isApplicationUpdating(application: LfgApplication): boolean {
    return this.updatingApplicationId() === application.id;
  }

  applicationAnswerEntries(application: LfgApplication): Array<{ key: string; value: string }> {
    const fields = this.lfgApplicationFields();
    const fieldMap = new Map(fields.map(field => [field.key, field]));

    return Object.entries(application.answers ?? {}).map(([key, value]) => ({
      key: fieldMap.get(key)?.label ?? key,
      value: this.formatApplicationAnswer(fieldMap.get(key), value),
    }));
  }

  private formatApplicationAnswer(field: ReturnType<PostCard['lfgApplicationFields']>[number] | undefined, value: any): string {
    if (field?.type === 'boolean') {
      return value ? (field.true_label ?? 'Yes') : (field.false_label ?? 'No');
    }

    if (Array.isArray(value)) return value.join(', ');

    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  flattenedPreview(): Array<{ comment: PostComment; depth: number }> {
    return this.quickViewOpen()
      ? this.flatComments()
      : this.comments().map(comment => ({ comment, depth: 0 }));
  }

  openApplyModal(event?: Event): void {
    event?.stopPropagation();
    if (this.hasApplied() || !this.canApply()) return;
    this.applyError.set(null);
    const initialAnswers: Record<string, any> = {};

    for (const field of this.lfgApplicationFields()) {
      if (field.type === 'boolean') {
        initialAnswers[field.key] = false;
      }

      if (field.type === 'checkbox') {
        initialAnswers[field.key] = [];
      }
    }

    this.applyAnswers.set(initialAnswers);
    this.isApplyModalOpen.set(true);
  }

  closeApplyModal(): void {
    if (this.isApplying()) return;
    this.isApplyModalOpen.set(false);
  }

  setAnswer(key: string, value: any): void {
    this.applyAnswers.update(current => ({ ...current, [key]: value }));
  }

  toggleCheckboxAnswer(key: string, option: string, checked: boolean): void {
    const current = this.applyAnswers()[key];
    const selected = Array.isArray(current) ? current : [];

    this.setAnswer(
      key,
      checked
        ? Array.from(new Set([...selected, option]))
        : selected.filter(value => value !== option)
    );
  }

  isCheckboxSelected(key: string, option: string): boolean {
    const current = this.applyAnswers()[key];

    return Array.isArray(current) && current.includes(option);
  }

  submitApplication(): void {
    if (this.isApplying() || this.hasApplied()) return;

    this.applyError.set(null);

    const fields = this.lfgApplicationFields();
    const answers = this.applyAnswers();

    for (const field of fields) {
      if (!field.required) continue;

      if (this.isMissingAnswer(answers[field.key])) {
        this.applyError.set('Please complete the required fields.');
        return;
      }
    }

    this.isApplying.set(true);

    this.postService.applyToLfg(this.post().id, answers).subscribe({
      next: () => {
        this.hasApplied.set(true);
        this.isApplying.set(false);
        this.isApplyModalOpen.set(false);
      },
      error: error => {
        if (error?.status === 409) {
          this.hasApplied.set(true);
          this.isApplyModalOpen.set(false);
        } else if (error?.status === 403) {
          this.applyError.set('You must join this club before applying.');
        } else if (error?.status === 422) {
          this.applyError.set('This LFG post is no longer accepting applications.');
        } else {
          this.applyError.set('Could not send application.');
        }

        this.isApplying.set(false);
      },
    });
  }

  private isMissingAnswer(value: any): boolean {
    return (
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0)
    );
  }

  private flattenComments(comments: PostComment[], depth = 0): Array<{ comment: PostComment; depth: number }> {
    return comments.flatMap(comment => [
      { comment, depth },
      ...this.flattenComments(comment.replies ?? [], depth + 1),
    ]);
  }
}
