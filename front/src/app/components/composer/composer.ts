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
  application_fields: ApplicationFieldForm[];
}

type ApplicationFieldType = 'text' | 'textarea' | 'boolean' | 'select' | 'checkbox';

interface ApplicationFieldForm {
  id: string;
  label: string;
  type: ApplicationFieldType;
  required: boolean;
  optionsText: string;
  trueLabel: string;
  falseLabel: string;
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
  private _defaultClubId: number | null = null;

  @Input()
  set defaultClubId(value: number | null | undefined) {
    this._defaultClubId = value ? Number(value) : null;
  }

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
    application_fields: [],
  });

  clubs(): Club[] {
    return (this.authService.user()?.clubs ?? []) as Club[];
  }

  isType(type: PostType): boolean {
    return this.form().type === type;
  }

  addApplicationField(): void {
    const id = `q_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    this.form.update(state => ({
      ...state,
      application_fields: [
        ...state.application_fields,
        {
          id,
          label: '',
          type: 'text',
          required: false,
          optionsText: '',
          trueLabel: 'Yes',
          falseLabel: 'No',
        },
      ],
    }));
  }

  removeApplicationField(id: string): void {
    this.form.update(state => ({
      ...state,
      application_fields: state.application_fields.filter(field => field.id !== id),
    }));
  }

  updateApplicationField(id: string, patch: Partial<ApplicationFieldForm>): void {
    this.form.update(state => ({
      ...state,
      application_fields: state.application_fields.map(field =>
        field.id === id ? { ...field, ...patch } : field
      ),
    }));
  }

  optionList(field: ApplicationFieldForm): string[] {
    return this.parseOptions(field.optionsText);
  }

  addOption(field: ApplicationFieldForm, value: string): void {
    const option = value.trim();
    if (!option) return;

    const next = [...this.optionList(field), option];
    this.updateApplicationField(field.id, { optionsText: next.join('\n') });
  }

  removeOption(field: ApplicationFieldForm, option: string): void {
    const next = this.optionList(field).filter(item => item !== option);
    this.updateApplicationField(field.id, { optionsText: next.join('\n') });
  }

  needsOptions(field: ApplicationFieldForm): boolean {
    return field.type === 'select' || field.type === 'checkbox';
  }

  onBackdropClick(event?: Event): void {
    this.requestClose(event);
  }

  requestClose(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
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

      const applicationFields = this.buildApplicationFields(state.application_fields);

      if (applicationFields === null) {
        return;
      }

      metadata['application_fields'] = applicationFields;
      metadata['form_fields_count'] = applicationFields.length;
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
      club_id: this._defaultClubId ?? (clubs.length ? clubs[0].id : null),
      type: 'standard',
      title: '',
      content: '',
      feeling: 'Locked In',
      spots_total: 5,
      starts_at: '',
      application_fields: [],
    });

    this.error.set(null);
  }

  private buildApplicationFields(fields: ApplicationFieldForm[]): Array<Record<string, any>> | null {
    const configured = fields.filter(field => field.label.trim().length > 0);

    for (const field of configured) {
      if (this.needsOptions(field) && this.parseOptions(field.optionsText).length < 2) {
        this.error.set('Add at least two options for select and checkbox questions.');
        return null;
      }
    }

    return configured.map(field => {
      const definition: Record<string, any> = {
        id: field.id,
        key: field.id,
        label: field.label.trim(),
        type: field.type,
        required: field.required,
      };

      if (this.needsOptions(field)) {
        definition['options'] = this.parseOptions(field.optionsText);
      }

      if (field.type === 'boolean') {
        definition['true_label'] = field.trueLabel.trim() || 'Yes';
        definition['false_label'] = field.falseLabel.trim() || 'No';
      }

      return definition;
    });
  }

  private parseOptions(value: string): string[] {
    return value
      .split(/\r?\n|,/)
      .map(option => option.trim())
      .filter(Boolean);
  }
}
