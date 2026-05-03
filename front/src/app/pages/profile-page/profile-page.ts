import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { PostCard } from '../../components/post-card/post-card';
import { ProfileService, UserProfile } from '../../services/profile';
import { TimelineService } from '../../services/timeline';
import { ChatService } from '../../services/chat';
import { Post } from '../../types/post';

type ProfileEditField =
  | 'name'
  | 'username'
  | 'bio';

@Component({
  selector: 'app-profile-page',
  imports: [CommonModule, RouterLink, PostCard],
  templateUrl: './profile-page.html',
})
export class ProfilePageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly profileService = inject(ProfileService);
  private readonly timelineService = inject(TimelineService);
  private readonly authService = inject(AuthService);
  private readonly chatService = inject(ChatService);
  private readonly router = inject(Router);

  profile = signal<UserProfile | null>(null);
  posts = signal<Post[]>([]);
  isLoading = signal(true);
  isPostsLoading = signal(true);
  isEditing = signal(false);
  isSaving = signal(false);
  error = signal<string | null>(null);
  editError = signal<string | null>(null);
  editForm = signal({
    name: '',
    username: '',
    bio: '',
  });
  profilePreview = signal<string | null>(null);
  coverPreview = signal<string | null>(null);
  private profileFile: File | null = null;
  private coverFile: File | null = null;

  displayName = computed(() => this.profile()?.name || 'Rally member');

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const username = params.get('username') ?? '';
      this.load(username);
    });
  }

  load(username: string): void {
    this.isLoading.set(true);
    this.isPostsLoading.set(true);
    this.error.set(null);

    this.profileService.getProfile(username).subscribe({
      next: response => {
        this.profile.set(response.profile);
        this.isLoading.set(false);
      },
      error: err => {
        console.error('Profile load failed', err);
        this.error.set('Could not load profile.');
        this.isLoading.set(false);
        this.isPostsLoading.set(false);
      },
    });

    this.timelineService.getUserTimeline(username).subscribe({
      next: response => {
        this.posts.set(response.data);
        this.isPostsLoading.set(false);
      },
      error: err => {
        console.error('Profile posts load failed', err);
        this.isPostsLoading.set(false);
      },
    });
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

  openEditor(): void {
    const user = this.profile();
    if (!user?.is_owner) return;

    this.editForm.set({
      name: user.name,
      username: user.username,
      bio: user.bio ?? '',
    });
    this.profileFile = null;
    this.coverFile = null;
    this.profilePreview.set(user.profile_photo_path);
    this.coverPreview.set(user.cover_photo_path);
    this.editError.set(null);
    this.isEditing.set(true);
  }

  closeEditor(): void {
    if (this.isSaving()) return;
    this.isEditing.set(false);
  }

  setEditField(field: ProfileEditField, value: string): void {
    this.editForm.update(current => ({ ...current, [field]: value }));
  }

  setImage(kind: 'profile' | 'cover', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    const preview = URL.createObjectURL(file);

    if (kind === 'profile') {
      this.profileFile = file;
      this.profilePreview.set(preview);
      return;
    }

    this.coverFile = file;
    this.coverPreview.set(preview);
  }

  saveProfile(): void {
    if (this.isSaving()) return;

    const form = this.editForm();
    const payload = new FormData();
    payload.set('name', form.name);
    payload.set('username', form.username);
    payload.set('bio', form.bio);

    if (this.profileFile) {
      payload.set('profile_photo', this.profileFile);
    }

    if (this.coverFile) {
      payload.set('cover_photo', this.coverFile);
    }

    this.isSaving.set(true);
    this.editError.set(null);

    this.profileService.updateProfile(payload).subscribe({
      next: response => {
        this.profile.set(response.profile);
        const currentUser = this.authService.user();

        if (currentUser?.id === response.profile.id) {
          this.authService.user.set({
            ...currentUser,
            name: response.profile.name,
            username: response.profile.username,
            bio: response.profile.bio,
            profile_photo_path: response.profile.profile_photo_path,
            cover_photo_path: response.profile.cover_photo_path,
            current_streak: response.profile.current_streak,
            longest_streak: response.profile.longest_streak,
          });
        }

        this.timelineService.updateAuthor(response.profile.id, {
          name: response.profile.name,
          profile_photo_path: response.profile.profile_photo_path,
        });
        this.posts.update(posts =>
          posts.map(post =>
            post.user_id === response.profile.id
              ? {
                  ...post,
                  author_name: post.user.club_nickname || response.profile.name,
                  author_photo: response.profile.profile_photo_path,
                  user: {
                    ...post.user,
                    name: response.profile.name,
                    profile_photo_path: response.profile.profile_photo_path,
                  },
                }
              : post
          )
        );

        this.isSaving.set(false);
        this.isEditing.set(false);
      },
      error: err => {
        console.error('Profile save failed', err);
        this.editError.set(err?.status === 422 ? 'Check username and required fields.' : 'Could not save profile.');
        this.isSaving.set(false);
      },
    });
  }

  messageUser(): void {
    const user = this.profile();
    if (!user || user.is_owner) return;

    this.chatService.startConversation(user.id).subscribe({
      next: response => this.router.navigate(['/chat', response.conversation.id]),
      error: err => console.error('Start chat failed', err),
    });
  }
}
