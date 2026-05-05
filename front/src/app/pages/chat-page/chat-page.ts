import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../auth';
import { ChatMessage, ChatService, Conversation } from '../../services/chat';
import { ClubChatOverlayState } from '../../services/club-chat-overlay';

@Component({
  selector: 'app-chat-page',
  imports: [CommonModule, RouterLink],
  templateUrl: './chat-page.html',
})
export class ChatPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  readonly chat = inject(ChatService);
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly clubChatOverlay = inject(ClubChatOverlayState);
  @ViewChild('messageScroller') private messageScroller?: ElementRef<HTMLElement>;
  draft = signal('');
  searchQuery = signal('');
  searchResults = signal<ChatMessage[]>([]);
  isSearching = signal(false);
  searchError = signal<string | null>(null);
  isPlanningMeeting = signal(false);
  meetingLabel = signal('Next session');
  meetingAt = signal('');
  meetingError = signal<string | null>(null);
  isGroupModalOpen = signal(false);
  groupName = signal('Group Chat');
  groupUserQuery = signal('');
  groupUsers = signal<any[]>([]);
  selectedGroupUserIds = signal<number[]>([]);
  groupError = signal<string | null>(null);
  isCreatingGroup = signal(false);
  isEditGroupOpen = signal(false);
  editGroupName = signal('');
  editGroupError = signal<string | null>(null);
  isSavingGroup = signal(false);
  private groupPhoto: File | null = null;
  private editGroupPhoto: File | null = null;
  typingUsers = signal<Set<string>>(new Set());
  private lastMessageCount = 0;
  private typingTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
  private typingChannelId: number | null = null;

  ngOnInit(): void {
    this.chat.clearUnread();
    this.chat.loadConversations();
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      if (id) {
        this.chat.openConversationById(id);
        this.setupTyping(id);
      }
    });
  }

  ngOnDestroy(): void {
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();

    if (this.typingChannelId) {
      const echo = (window as any).Echo;
      if (echo) {
        echo.leave(`conversations.${this.typingChannelId}`);
      }
    }

    this.chat.disconnect();
  }

  ngAfterViewChecked(): void {
    const count = this.chat.messages().length;
    if (count === this.lastMessageCount) return;
    this.lastMessageCount = count;
    queueMicrotask(() => {
      this.scrollToBottom();
    });
  }

  orderedMessages() {
    return [...this.chat.messages()].reverse();
  }

  open(conversation: Conversation): void {
    this.chat.openConversation(conversation);
    this.setupTyping(conversation.id);
  }

  conversationPhoto(conversation: Conversation): string | null {
    if (conversation.photo_path) return conversation.photo_path;
    const me = this.authService.user()?.id;
    return conversation.participants.find(user => Number(user.id) !== Number(me))?.profile_photo_path ?? null;
  }

  conversationInitials(conversation: Conversation): string {
    return this.initials(this.conversationAvatarLabel(conversation));
  }

  conversationAvatarLabel(conversation: Conversation): string {
    if (conversation.photo_path) return conversation.title;
    const me = this.authService.user()?.id;
    return conversation.participants.find(user => Number(user.id) !== Number(me))?.name ?? conversation.title;
  }

  search(): void {
    const query = this.searchQuery().trim();
    this.searchError.set(null);

    if (!query) {
      this.searchResults.set([]);
      return;
    }

    this.isSearching.set(true);
    this.chat.searchMessages(query).subscribe({
      next: response => {
        this.searchResults.set(response.messages);
        this.isSearching.set(false);
      },
      error: err => {
        console.error('Message search failed', err);
        this.searchError.set('Search failed.');
        this.isSearching.set(false);
      },
    });
  }

  openSearchResult(message: ChatMessage): void {
    if (message.conversation_id) {
      this.searchResults.set([]);
      this.router.navigate(['/chat', message.conversation_id]);
      return;
    }

    if (message.club_slug && (message.room_id || message.channel_id)) {
      const loungeId = Number(message.room_id ?? message.channel_id);
      this.searchResults.set([]);
      this.router.navigate(['/clubs', message.club_slug]).then(() => {
        this.clubChatOverlay.open(message.club_slug!, loungeId);
      });
    }
  }

  resultContext(message: ChatMessage): string {
    if (message.conversation_id) return 'DM';
    const room = (message.room_name ?? 'room').replace(/^#\s*/, '');
    return `${message.club_name ?? 'Club'} / #${room}`;
  }

  isMine(message: ChatMessage): boolean {
    return Number(message.sender_id) === Number(this.authService.user()?.id);
  }

  isGrouped(message: ChatMessage, index: number): boolean {
    const previous = this.orderedMessages()[index + 1];
    if (!previous) return false;
    if (Number(previous.sender_id) !== Number(message.sender_id)) return false;

    const currentTime = new Date(message.created_at).getTime();
    const previousTime = new Date(previous.created_at).getTime();

    return Math.abs(currentTime - previousTime) <= 120000;
  }

  isGroupEnd(message: ChatMessage, index: number): boolean {
    const next = this.orderedMessages()[index - 1];
    if (!next) return true;
    if (Number(next.sender_id) !== Number(message.sender_id)) return true;

    const currentTime = new Date(message.created_at).getTime();
    const nextTime = new Date(next.created_at).getTime();

    return Math.abs(currentTime - nextTime) > 120000;
  }

  conversationPreview(conversation: Conversation): string {
    const message = conversation.latest_message;
    if (!message) return 'No messages yet.';

    if (conversation.is_group && message.sender?.name) {
      return `${message.sender.name}: ${message.body}`;
    }

    return message.body;
  }

  canEditGroup(conversation: Conversation): boolean {
    return !!conversation.is_group && Number(conversation.leader_id) === Number(this.authService.user()?.id);
  }

  onDraftInput(value: string): void {
    this.draft.set(value);
    if (value.length === 0) {
      this.whisperStopTyping();
      return;
    }
    this.whisperTyping();
  }

  private setupTyping(conversationId: number): void {
    if (this.typingChannelId === conversationId) return;

    const echo = (window as any).Echo;
    if (!echo) return;

    if (this.typingChannelId) {
      echo.leave(`conversations.${this.typingChannelId}`);
    }

    this.typingChannelId = conversationId;
    this.typingUsers.set(new Set());
    this.typingTimeouts.forEach(timeout => clearTimeout(timeout));
    this.typingTimeouts.clear();

    echo.private(`conversations.${conversationId}`).listenForWhisper('typing', (payload: { name?: string; typing?: boolean } | null) => {
      const name = payload?.name?.trim();
      if (!name) return;

      const me = this.authService.user()?.name;
      if (me && name === me) return;

      if (payload?.typing === false) {
        this.removeTypingUser(name);
        return;
      }

      this.addTypingUser(name);
    });

    echo.private(`conversations.${conversationId}`).listen('.MeetingPlanned', (payload: { conversation?: Conversation; message?: ChatMessage }) => {
      if (payload.conversation) {
        this.chat.activeConversation.update(current =>
          current && current.id === payload.conversation!.id ? { ...current, ...payload.conversation } : current
        );
      }

      if (payload.message) {
        this.chat.messages.update(items =>
          items.some(item => item.id === payload.message!.id) ? items : [...items, payload.message!]
        );
      }
    });
  }

  typingText(): string | null {
    const names = [...this.typingUsers()];

    if (names.length === 0) return null;
    if (names.length > 5) return 'Multiple people are typing...';
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;

    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]} are typing...`;
  }

  private addTypingUser(name: string): void {
    this.typingUsers.update(current => new Set(current).add(name));

    const existing = this.typingTimeouts.get(name);
    if (existing) clearTimeout(existing);

    this.typingTimeouts.set(name, setTimeout(() => {
      this.typingUsers.update(current => {
        const next = new Set(current);
        next.delete(name);
        return next;
      });
      this.typingTimeouts.delete(name);
    }, 1500));
  }

  private removeTypingUser(name: string): void {
    const existing = this.typingTimeouts.get(name);
    if (existing) clearTimeout(existing);
    this.typingTimeouts.delete(name);

    this.typingUsers.update(current => {
      const next = new Set(current);
      next.delete(name);
      return next;
    });
  }

  scrollToBottom(): void {
    const el = this.messageScroller?.nativeElement;
    if (el) el.scrollTop = 0;
  }

  private whisperTyping(): void {
    const conversationId = this.chat.activeConversation()?.id;
    if (!conversationId) return;

    const echo = (window as any).Echo;
    if (!echo) return;

    const name = this.authService.user()?.name;
    if (!name) return;

    echo.private(`conversations.${conversationId}`).whisper('typing', { name, typing: true });
  }

  private whisperStopTyping(): void {
    const conversationId = this.chat.activeConversation()?.id;
    if (!conversationId) return;

    const echo = (window as any).Echo;
    if (!echo) return;

    const name = this.authService.user()?.name;
    if (!name) return;

    this.removeTypingUser(name);
    echo.private(`conversations.${conversationId}`).whisper('typing', { name, typing: false });
  }

  send(): void {
    const body = this.draft().trim();
    if (!body) return;
    this.chat.sendMessage(body);
    this.whisperStopTyping();
    this.draft.set('');
  }

  openMeetingPlanner(): void {
    const conversation = this.chat.activeConversation();
    if (!conversation?.is_group) return;

    this.meetingLabel.set(conversation.meeting_label ?? 'Next session');
    this.meetingAt.set(conversation.next_meeting_at ? conversation.next_meeting_at.slice(0, 16) : '');
    this.meetingError.set(null);
    this.isPlanningMeeting.set(true);
  }

  closeMeetingPlanner(): void {
    this.isPlanningMeeting.set(false);
  }

  saveMeeting(): void {
    const conversation = this.chat.activeConversation();
    if (!conversation || !this.meetingAt()) return;

    this.chat.planMeeting(conversation.id, this.meetingAt(), this.meetingLabel()).subscribe({
      next: response => {
        this.chat.activeConversation.set(response.conversation);
        this.chat.messages.update(items =>
          items.some(item => item.id === response.message.id) ? items : [...items, response.message]
        );
        this.isPlanningMeeting.set(false);
      },
      error: err => {
        console.error('Meeting plan failed', err);
        this.meetingError.set('Could not plan meeting.');
      },
    });
  }

  openEditGroup(): void {
    const conversation = this.chat.activeConversation();
    if (!conversation || !this.canEditGroup(conversation)) return;

    this.editGroupName.set(conversation.title);
    this.editGroupError.set(null);
    this.editGroupPhoto = null;
    this.isEditGroupOpen.set(true);
  }

  closeEditGroup(): void {
    if (this.isSavingGroup()) return;
    this.isEditGroupOpen.set(false);
  }

  setEditGroupPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.editGroupPhoto = input.files?.[0] ?? null;
  }

  saveGroupEdit(): void {
    const conversation = this.chat.activeConversation();
    if (!conversation) return;

    const payload = new FormData();
    payload.set('title', this.editGroupName().trim() || conversation.title);
    if (this.editGroupPhoto) payload.set('group_photo', this.editGroupPhoto);

    this.isSavingGroup.set(true);
    this.chat.updateConversation(conversation.id, payload).subscribe({
      next: response => {
        this.chat.activeConversation.set(response.conversation);
        this.chat.conversations.update(items =>
          items.map(item => item.id === response.conversation.id ? { ...item, ...response.conversation } : item)
        );
        this.isSavingGroup.set(false);
        this.isEditGroupOpen.set(false);
      },
      error: err => {
        console.error('Group edit failed', err);
        this.editGroupError.set('Could not update group.');
        this.isSavingGroup.set(false);
      },
    });
  }

  openGroupModal(): void {
    this.groupName.set('Group Chat');
    this.selectedGroupUserIds.set([]);
    this.groupError.set(null);
    this.groupPhoto = null;
    this.isGroupModalOpen.set(true);
    this.loadGroupUsers();
  }

  closeGroupModal(): void {
    if (this.isCreatingGroup()) return;
    this.isGroupModalOpen.set(false);
  }

  loadGroupUsers(): void {
    this.chat.getChatUsers(this.groupUserQuery()).subscribe({
      next: response => this.groupUsers.set(response.users),
      error: err => {
        console.error('User search failed', err);
        this.groupError.set('Could not load users.');
      },
    });
  }

  toggleGroupUser(userId: number, checked: boolean): void {
    this.selectedGroupUserIds.update(ids =>
      checked
        ? Array.from(new Set([...ids, userId]))
        : ids.filter(id => id !== userId)
    );
  }

  isGroupUserSelected(userId: number): boolean {
    return this.selectedGroupUserIds().includes(userId);
  }

  setGroupPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.groupPhoto = input.files?.[0] ?? null;
  }

  createGroup(): void {
    const ids = this.selectedGroupUserIds();
    if (!ids.length) {
      this.groupError.set('Pick people.');
      return;
    }

    const payload = new FormData();
    payload.set('title', this.groupName().trim() || 'Group Chat');
    ids.forEach(id => payload.append('participant_ids[]', String(id)));
    if (this.groupPhoto) payload.set('group_photo', this.groupPhoto);

    this.isCreatingGroup.set(true);
    this.groupError.set(null);
    this.chat.createGroupConversation(payload).subscribe({
      next: response => {
        this.chat.conversations.update(items => [response.conversation, ...items]);
        this.isCreatingGroup.set(false);
        this.isGroupModalOpen.set(false);
        this.open(response.conversation);
      },
      error: err => {
        console.error('Group create failed', err);
        this.groupError.set('Could not create group.');
        this.isCreatingGroup.set(false);
      },
    });
  }

  initials(name: string): string {
    return name.split(' ').filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  }
}
