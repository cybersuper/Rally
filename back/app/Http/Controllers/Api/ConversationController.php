<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Events\MeetingPlanned;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Post;
use App\Models\User;
use Cloudinary\Cloudinary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $conversations = $request->user()
            ->conversations()
            ->with([
                'users:id,name,username,profile_photo_path',
                'messages' => fn ($query) => $query->with('sender:id,name,username,profile_photo_path')->latest()->limit(1),
            ])
            ->withCount([
                'messages as unread_count' => fn ($query) => $query
                    ->whereNull('read_at')
                    ->where('sender_id', '!=', $request->user()->id),
            ])
            ->latest('conversation_user.updated_at')
            ->get();

        return response()->json([
            'conversations' => $conversations->map(fn (Conversation $conversation) => $this->serializeConversation($conversation, $request->user()->id)),
        ]);
    }

    public function show(Request $request, Conversation $conversation): JsonResponse
    {
        $this->abortUnlessParticipant($request, $conversation);

        $messages = $conversation->messages()
            ->with('sender:id,name,username,profile_photo_path')
            ->oldest()
            ->get();

        return response()->json([
            'conversation' => $this->serializeConversation(
                $conversation->load('users:id,name,username,profile_photo_path'),
                $request->user()->id
            ),
            'messages' => $messages->map(fn (Message $message) => $this->serializeMessage($message)),
        ]);
    }

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required_without_all:participant_id,participant_ids', 'integer', 'exists:users,id'],
            'participant_id' => ['required_without_all:user_id,participant_ids', 'integer', 'exists:users,id'],
            'participant_ids' => ['required_without_all:user_id,participant_id', 'array', 'min:1', 'max:24'],
            'participant_ids.*' => ['integer', 'distinct', 'exists:users,id'],
            'title' => ['nullable', 'string', 'max:120'],
            'group_photo' => ['nullable', 'image', 'max:4096'],
        ]);

        if (! empty($validated['participant_ids'])) {
            $participantIds = collect($validated['participant_ids'])
                ->map(fn ($id) => (int) $id)
                ->reject(fn ($id) => $id === (int) $request->user()->id)
                ->unique()
                ->values();

            abort_unless($participantIds->isNotEmpty(), 422, 'Choose another user.');

            $photoPath = $request->hasFile('group_photo')
                ? $this->uploadImage($request->file('group_photo'), 'group-chats')
                : null;

            $conversation = DB::transaction(function () use ($request, $validated, $participantIds, $photoPath) {
                $conversation = Conversation::create([
                    'title' => $validated['title'] ?? 'Group Chat',
                    'photo_path' => $photoPath,
                    'leader_id' => $request->user()->id,
                ]);

                $conversation->users()->attach($request->user()->id);
                $conversation->users()->syncWithoutDetaching($participantIds->all());

                return $conversation;
            });

            return response()->json([
                'conversation' => $this->serializeConversation(
                    $conversation->load('users:id,name,username,profile_photo_path'),
                    $request->user()->id
                ),
            ], 201);
        }

        $participantId = $validated['user_id'] ?? $validated['participant_id'];

        abort_if((int) $participantId === $request->user()->id, 422, 'Choose another user.');

        $conversation = DB::transaction(function () use ($request, $participantId) {
            $existing = Conversation::query()
                ->whereHas('users', fn ($query) => $query->where('users.id', $request->user()->id))
                ->whereHas('users', fn ($query) => $query->where('users.id', $participantId))
                ->withCount('users')
                ->get()
                ->first(fn (Conversation $conversation) => $conversation->users_count === 2);

            if ($existing) {
                return $existing;
            }

            $conversation = Conversation::create();
            $conversation->users()->attach([$request->user()->id, $participantId]);

            return $conversation;
        });

        return response()->json([
            'conversation' => $this->serializeConversation(
                $conversation->load('users:id,name,username,profile_photo_path'),
                $request->user()->id
            ),
        ], 201);
    }

    public function users(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));

        $users = User::query()
            ->whereKeyNot($request->user()->id)
            ->when($query !== '', fn ($builder) => $builder
                ->where(fn ($builder) => $builder
                    ->where('name', 'ilike', "%{$query}%")
                    ->orWhere('username', 'ilike', "%{$query}%")
                ))
            ->orderBy('name')
            ->limit(50)
            ->get(['id', 'name', 'username', 'profile_photo_path']);

        return response()->json(['users' => $users]);
    }

    public function store(Request $request, Conversation $conversation): JsonResponse
    {
        $this->abortUnlessParticipant($request, $conversation);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $message = $conversation->messages()->create([
            'sender_id' => $request->user()->id,
            'body' => $validated['body'],
        ])->load('sender:id,name,username,profile_photo_path');

        $conversation->touch();
        $conversation->users()->updateExistingPivot($request->user()->id, ['updated_at' => now()]);

        MessageSent::dispatch($message);

        return response()->json([
            'message' => $this->serializeMessage($message),
        ], 201);
    }

    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        $this->abortUnlessParticipant($request, $conversation);

        $conversation->messages()
            ->where('sender_id', '!=', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        $unread = $conversation->messages()
            ->where('sender_id', '!=', $request->user()->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'conversation_id' => $conversation->id,
            'unread_count' => $unread,
        ]);
    }

    public function update(Request $request, Conversation $conversation): JsonResponse
    {
        $this->abortUnlessParticipant($request, $conversation);

        abort_unless($conversation->leader_id === $request->user()->id, 403, 'Only the group leader can edit this chat.');

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'group_photo' => ['nullable', 'image', 'max:4096'],
        ]);

        $payload = ['title' => $validated['title']];

        if ($request->hasFile('group_photo')) {
            $payload['photo_path'] = $this->uploadImage($request->file('group_photo'), 'group-chats');
        }

        $conversation->forceFill($payload)->save();

        return response()->json([
            'conversation' => $this->serializeConversation(
                $conversation->fresh()->load([
                    'users:id,name,username,profile_photo_path',
                    'messages' => fn ($query) => $query->with('sender:id,name,username,profile_photo_path')->latest()->limit(1),
                ]),
                $request->user()->id
            ),
        ]);
    }

    public function createParty(Request $request, Post $post): JsonResponse
    {
        abort_unless($post->type === 'lfg' && $post->user_id === $request->user()->id, 403, 'Not allowed.');

        $validated = $request->validate([
            'group_name' => ['required', 'string', 'max:120'],
            'leader_title' => ['nullable', 'string', 'max:80'],
            'group_photo' => ['nullable', 'image', 'max:4096'],
        ]);

        $accepted = $post->lfgApplications()
            ->where('status', 'accepted')
            ->pluck('user_id')
            ->all();

        abort_unless(count($accepted) > 0, 422, 'Accept members first.');

        $photoPath = $request->hasFile('group_photo')
            ? $this->uploadImage($request->file('group_photo'), 'party-groups')
            : null;

        $conversation = DB::transaction(function () use ($post, $request, $validated, $accepted, $photoPath) {
            $conversation = Conversation::create([
                'title' => $validated['group_name'],
                'photo_path' => $photoPath,
                'party_post_id' => $post->id,
                'leader_id' => $request->user()->id,
            ]);

            $conversation->users()->attach($request->user()->id, [
                'member_title' => $validated['leader_title'] ?: 'Party Leader',
            ]);

            foreach ($accepted as $userId) {
                $conversation->users()->syncWithoutDetaching([
                    $userId => ['member_title' => null],
                ]);
            }

            return $conversation;
        });

        return response()->json([
            'conversation' => $this->serializeConversation($conversation->load([
                'users:id,name,username,profile_photo_path',
                'messages' => fn ($query) => $query->with('sender:id,name,username,profile_photo_path')->latest()->limit(1),
            ]), $request->user()->id),
        ], 201);
    }

    public function planMeeting(Request $request, Conversation $conversation): JsonResponse
    {
        $this->abortUnlessParticipant($request, $conversation);

        $validated = $request->validate([
            'next_meeting_at' => ['required', 'date'],
            'meeting_label' => ['required', 'string', 'max:120'],
        ]);

        $conversation->forceFill([
            'next_meeting_at' => $validated['next_meeting_at'],
            'meeting_label' => $validated['meeting_label'],
            'meeting_reminder_sent_at' => null,
        ])->save();

        $message = $conversation->messages()->create([
            'sender_id' => $request->user()->id,
            'body' => 'Plan Meeting: '.$validated['meeting_label'].' at '.$conversation->next_meeting_at?->toDayDateTimeString(),
            'is_pinned' => true,
        ])->load('sender:id,name,username,profile_photo_path');

        MessageSent::dispatch($message);
        MeetingPlanned::dispatch($conversation->fresh(), $message);

        return response()->json([
            'conversation' => $this->serializeConversation(
                $conversation->fresh()->load('users:id,name,username,profile_photo_path', 'messages'),
                $request->user()->id
            ),
            'message' => $this->serializeMessage($message),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'max:2000'],
        ]);

        $contentIndex = Message::blindIndex($validated['q']);
        $user = $request->user();

        $messages = Message::query()
            ->with(['sender:id,name,username,profile_photo_path', 'channel.club:id,name,slug'])
            ->where('content_index', $contentIndex)
            ->where(function ($query) use ($user) {
                $query->whereHas('conversation.users', fn ($query) => $query->where('users.id', $user->id))
                    ->orWhereHas('channel.club.users', fn ($query) => $query->where('users.id', $user->id));
            })
            ->latest()
            ->limit(50)
            ->get();

        return response()->json([
            'messages' => $messages->map(fn (Message $message) => $this->serializeMessage($message)),
        ]);
    }


    private function abortUnlessParticipant(Request $request, Conversation $conversation): void
    {
        abort_unless(
            $conversation->users()->where('users.id', $request->user()->id)->exists(),
            403,
            'Not allowed.'
        );
    }

    private function serializeConversation(Conversation $conversation, int $viewerId): array
    {
        $otherUsers = $conversation->users->where('id', '!==', $viewerId)->values();
        $latest = $conversation->messages->first();

        $isGroup = (bool) $conversation->title;

        return [
            'id' => $conversation->id,
            'participants' => $conversation->users->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'profile_photo_path' => $user->profile_photo_path,
            ]),
            'title' => $conversation->title ?: ($otherUsers->pluck('name')->join(', ') ?: 'Saved notes'),
            'photo_path' => $conversation->photo_path,
            'party_post_id' => $conversation->party_post_id,
            'leader_id' => $conversation->leader_id,
            'is_group' => $isGroup,
            'next_meeting_at' => $conversation->next_meeting_at,
            'meeting_label' => $conversation->meeting_label,
            'latest_message' => $latest ? $this->serializeMessage($latest) : null,
            'unread_count' => (int) ($conversation->unread_count ?? 0),
            'updated_at' => $conversation->updated_at,
        ];
    }

    private function uploadImage($file, string $folder): string
    {
        abort_unless(
            config('services.cloudinary.url') || config('services.cloudinary.cloud_name'),
            422,
            'Cloudinary is not configured.'
        );

        $cloudinary = config('services.cloudinary.url')
            ? new Cloudinary(config('services.cloudinary.url'))
            : new Cloudinary([
                'cloud' => [
                    'cloud_name' => config('services.cloudinary.cloud_name'),
                    'api_key' => config('services.cloudinary.api_key'),
                    'api_secret' => config('services.cloudinary.api_secret'),
                ],
            ]);

        $result = $cloudinary->uploadApi()->upload($file->getRealPath(), [
            'folder' => "rally/{$folder}",
            'resource_type' => 'image',
        ]);

        return $result['secure_url'];
    }

    private function serializeMessage(Message $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'channel_id' => $message->channel_id,
            'room_id' => $message->room_id ?? $message->channel_id,
            'room_name' => $message->channel?->name,
            'club_id' => $message->channel?->club?->id,
            'club_name' => $message->channel?->club?->name,
            'club_slug' => $message->channel?->club?->slug,
            'sender_id' => $message->sender_id,
            'body' => $message->body,
            'read_at' => $message->read_at,
            'is_pinned' => (bool) $message->is_pinned,
            'deleted_at' => $message->deleted_at,
            'created_at' => $message->created_at,
            'sender' => $message->sender ? [
                'id' => $message->sender->id,
                'name' => $message->sender->name,
                'username' => $message->sender->username,
                'profile_photo_path' => $message->sender->profile_photo_path,
            ] : null,
        ];
    }
}
