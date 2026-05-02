import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth';
import { Club, PostType } from '../../types/post';
import { PostService } from '../../services/post';
import { TimelineService } from '../../services/timeline';

interface ComposerFormState {
  club_id: number | null;
  type: PostType;
  title: string;
  content: string;
  feeling: string;
  spots_total: number | null;
  starts_at: string;
}

@Component({
  selector: 'app-composer',
  imports: [CommonModule, FormsModule],
  templateUrl: './composer.html',
})
export class ComposerComponent {
  private readonly authService = inject(AuthService);
  private readonly postService = inject(PostService);
  private readonly timelineService = inject(TimelineService);

  private _open = false;

  @Input({ required: true })
  set open(value: boolean) {
    this._open = value;

    if (value) {
      this.reset();
    }
  }

  get open(): boolean {
    return this._open;
  }

  @Output() close = new EventEmitter<void>();

  isSubmitting = signal(false);
  error = signal<string | null>(null);

  form = signal<ComposerFormState>({
    club_id: null,
    type: 'standard',
    title: '',
    content: '',
    feeling: 'Locked In',
    spots_total: 5,
    starts_at: '',
  });

  clubs(): Club[] {
    return (this.authService.user()?.clubs ?? []) as Club[];
  }

  isType(type: PostType): boolean {
    return this.form().type === type;
  }

  onBackdropClick(): void {
    this.requestClose();
  }

  requestClose(): void {
    if (this.isSubmitting()) return;
    this.error.set(null);
    this.close.emit();
  }

  submit(): void {
    this.error.set(null);

    const state = this.form();

    if (!state.club_id) {
      this.error.set('Pick a club.');
      return;
    }

    if (!state.title.trim()) {
      this.error.set('Add a title.');
      return;
    }

    if (!state.content.trim()) {
      this.error.set('Add some content.');
      return;
    }

    const metadata: Record<string, any> = {};

    if (state.type === 'log') {
      metadata['feeling'] = state.feeling || 'Solid';
    }

    if (state.type === 'lfg') {
      if (state.spots_total && state.spots_total > 0) {
        metadata['spots_total'] = state.spots_total;
      }

      if (state.starts_at && state.starts_at.trim()) {
        metadata['starts_at'] = state.starts_at;
      }
    }

    this.isSubmitting.set(true);

    this.postService
      .createPost({
        club_id: state.club_id,
        title: state.title,
        content: state.content,
        type: state.type,
        metadata: Object.keys(metadata).length ? metadata : undefined,
      })
      .subscribe({
        next: response => {
          this.timelineService.prependPost(response.post);
          this.isSubmitting.set(false);
          this.reset();
          this.close.emit();
        },
        error: err => {
          this.isSubmitting.set(false);

          if (err?.status === 403) {
            this.error.set('You must join this club before posting.');
            return;
          }

          if (err?.status === 422) {
            this.error.set('Some fields are invalid.');
            return;
          }

          this.error.set('Could not create post.');
        },
      });
  }

  reset(): void {
    const clubs = this.clubs();

    this.form.set({
      club_id: clubs.length ? clubs[0].id : null,
      type: 'standard',
      title: '',
      content: '',
      feeling: 'Locked In',
      spots_total: 5,
      starts_at: '',
    });

    this.error.set(null);
  }
}
