<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\ClubChannel;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClubChannelController extends Controller
{
    public function index(Request $request, Club $club): JsonResponse
    {
        $this->abortUnlessMember($request, $club);
        $this->ensureGeneral($club);

        return response()->json([
            'channels' => $club->channels()->orderBy('id')->get()->map(fn (ClubChannel $channel) => $this->serializeChannel($channel)),
        ]);
    }

    public function store(Request $request, Club $club): JsonResponse
    {
        abort_unless($this->canManage($request, $club), 403, 'Not allowed.');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'type' => ['required', Rule::in([ClubChannel::TYPE_TEXT, ClubChannel::TYPE_ANNOUNCEMENT])],
        ]);

        $channel = $club->channels()->create($validated);

        return response()->json(['channel' => $this->serializeChannel($channel)], 201);
    }

    public function messages(Request $request, Club $club, ClubChannel $channel): JsonResponse
    {
        $this->abortUnlessMember($request, $club);
        abort_unless($channel->club_id === $club->id, 404);

        $messages = $channel->messages()
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
            'sender_id' => $request->user()->id,
            'body' => $validated['body'],
        ])->load(['sender:id,name,username,profile_photo_path', 'channel']);

        MessageSent::dispatch($message);

        return response()->json(['message' => $this->serializeMessage($message)], 201);
    }

    private function ensureGeneral(Club $club): void
    {
        $club->channels()->firstOrCreate([
            'name' => 'general',
        ], [
            'type' => ClubChannel::TYPE_TEXT,
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

    private function serializeChannel(ClubChannel $channel): array
    {
        return [
            'id' => $channel->id,
            'club_id' => $channel->club_id,
            'name' => $channel->name,
            'type' => $channel->type,
        ];
    }

    private function serializeMessage(Message $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'channel_id' => $message->channel_id,
            'sender_id' => $message->sender_id,
            'body' => $message->body,
            'read_at' => $message->read_at,
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
