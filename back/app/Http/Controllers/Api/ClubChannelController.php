<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\ClubChannel;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClubChannelController extends Controller
{
    public function index(Request $request, Club $club): JsonResponse
    {
        $this->abortUnlessMember($request, $club);
        $this->ensureGeneral($club);

        return response()->json([
            'channels' => $club->channels()
                ->orderBy('category')
                ->orderBy('id')
                ->get()
                ->map(fn (ClubChannel $channel) => $this->serializeChannel($channel, $request)),
        ]);
    }

    public function store(Request $request, Club $club): JsonResponse
    {
        abort_unless($this->canOwnOrAdmin($request, $club), 403, 'Not allowed.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'type' => ['required', Rule::in([ClubChannel::TYPE_TEXT, ClubChannel::TYPE_ANNOUNCEMENT])],
            'category' => ['nullable', 'string', 'max:80'],
        ]);

        $channel = $club->channels()->create($validated);

        return response()->json(['channel' => $this->serializeChannel($channel, $request)], 201);
    }

    public function storeRoom(Request $request, Club $club): JsonResponse
    {
        abort_unless($this->canOwnOrAdmin($request, $club), 403, 'Not allowed.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'type' => ['nullable', Rule::in([ClubChannel::TYPE_TEXT, ClubChannel::TYPE_ANNOUNCEMENT])],
            'category' => ['nullable', 'string', 'max:80'],
        ]);

        $channel = $club->channels()->create([
            'name' => ltrim($validated['name'], '#! '),
            'type' => $validated['type'] ?? ClubChannel::TYPE_TEXT,
            'category' => $validated['category'] ?? 'Text Lounges',
        ]);

        return response()->json(['channel' => $this->serializeChannel($channel, $request)], 201);
    }

    public function messages(Request $request, Club $club, ClubChannel $channel): JsonResponse
    {
        $this->abortUnlessMember($request, $club);
        abort_unless($channel->club_id === $club->id, 404);

        $messages = $channel->messages()
            ->withTrashed()
            ->with('sender:id,name,username,profile_photo_path')
            ->oldest()
            ->get();

        return response()->json([
            'messages' => $messages->map(fn (Message $message) => $this->serializeMessage($message)),
        ]);
    }

    public function send(Request $request, Club $club, ClubChannel $channel): JsonResponse
    {
        $this->abortUnlessMember($request, $club);
        abort_unless($channel->club_id === $club->id, 404);

        if ($channel->type === ClubChannel::TYPE_ANNOUNCEMENT) {
            abort_unless($this->canManage($request, $club), 403, 'Announcements are admin-only.');
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $message = Message::create([
            'channel_id' => $channel->id,
            'room_id' => $channel->id,
            'sender_id' => $request->user()->id,
            'body' => $validated['body'],
        ])->load(['sender:id,name,username,profile_photo_path', 'channel']);

        MessageSent::dispatch($message);

        return response()->json(['message' => $this->serializeMessage($message)], 201);
    }

    public function markRead(Request $request, ClubChannel $lounge): JsonResponse
    {
        $club = $lounge->club()->firstOrFail();
        $this->abortUnlessMember($request, $club);

        DB::table('lounge_user_reads')->updateOrInsert(
            [
                'club_channel_id' => $lounge->id,
                'user_id' => $request->user()->id,
            ],
            [
                'last_read_at' => now(),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );

        return response()->json([
            'lounge_id' => $lounge->id,
            'unread_count' => 0,
        ]);
    }

    public function pin(Request $request, Message $message): JsonResponse
    {
        $message->load(['channel.club', 'sender:id,name,username,profile_photo_path']);
        $club = $message->channel?->club;

        abort_unless($club, 404);
        abort_unless($this->canOwnOrAdmin($request, $club), 403, 'Not allowed.');

        $validated = $request->validate([
            'is_pinned' => ['nullable', 'boolean'],
        ]);

        $message->forceFill([
            'is_pinned' => array_key_exists('is_pinned', $validated)
                ? $validated['is_pinned']
                : ! $message->is_pinned,
        ])->save();

        return response()->json([
            'message' => $this->serializeMessage($message->fresh(['sender:id,name,username,profile_photo_path'])),
        ]);
    }

    public function updateMessage(Request $request, Message $message): JsonResponse
    {
        abort_unless((int) $message->sender_id === (int) $request->user()->id, 403, 'Not allowed.');
        abort_if($message->trashed(), 422, 'Message deleted.');

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $message->forceFill(['body' => $validated['body']])->save();

        return response()->json([
            'message' => $this->serializeMessage($message->fresh(['sender:id,name,username,profile_photo_path'])),
        ]);
    }

    public function deleteMessage(Request $request, Message $message): JsonResponse
    {
        $message->load('channel.club');
        $club = $message->channel?->club;
        $isSender = (int) $message->sender_id === (int) $request->user()->id;
        $canModerate = $club && $this->canOwnOrAdmin($request, $club);

        abort_unless($isSender || $canModerate, 403, 'Not allowed.');

        $message->delete();
        $deleted = Message::withTrashed()
            ->with('sender:id,name,username,profile_photo_path')
            ->findOrFail($message->id);

        return response()->json([
            'message' => $this->serializeMessage($deleted),
        ]);
    }

    private function ensureGeneral(Club $club): void
    {
        $club->channels()->firstOrCreate([
            'name' => 'general',
        ], [
            'type' => ClubChannel::TYPE_TEXT,
            'category' => 'Text Lounges',
        ]);
    }

    private function abortUnlessMember(Request $request, Club $club): void
    {
        abort_unless(
            $request->user()->clubs()->where('clubs.id', $club->id)->exists(),
            403,
            'Join this club first.'
        );
    }

    private function canManage(Request $request, Club $club): bool
    {
        $role = $request->user()->clubs()->where('clubs.id', $club->id)->value('club_user.role');

        return in_array($role, [Club::ROLE_OWNER, Club::ROLE_ADMIN, Club::ROLE_MODERATOR], true);
    }

    private function canOwnOrAdmin(Request $request, Club $club): bool
    {
        $role = $request->user()->clubs()->where('clubs.id', $club->id)->value('club_user.role');

        return in_array($role, [Club::ROLE_OWNER, Club::ROLE_ADMIN], true);
    }

    private function serializeChannel(ClubChannel $channel, ?Request $request = null): array
    {
        return [
            'id' => $channel->id,
            'club_id' => $channel->club_id,
            'name' => $channel->name,
            'type' => $channel->type,
            'category' => $channel->category ?? 'Text Lounges',
            'unread_count' => $request ? $this->unreadCount($channel, $request) : 0,
        ];
    }

    private function unreadCount(ClubChannel $channel, Request $request): int
    {
        $lastReadAt = DB::table('lounge_user_reads')
            ->where('club_channel_id', $channel->id)
            ->where('user_id', $request->user()->id)
            ->value('last_read_at');

        return $channel->messages()
            ->where('sender_id', '!=', $request->user()->id)
            ->when($lastReadAt, fn ($query) => $query->where('created_at', '>', $lastReadAt))
            ->when(! $lastReadAt, fn ($query) => $query)
            ->count();
    }

    private function serializeMessage(Message $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'channel_id' => $message->channel_id,
            'room_id' => $message->room_id ?? $message->channel_id,
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
