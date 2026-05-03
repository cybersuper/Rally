<?php

namespace App\Http\Controllers\Api;

use App\Events\MessageSent;
use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\User;
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
            'user_id' => ['required_without:participant_id', 'integer', 'exists:users,id'],
            'participant_id' => ['required_without:user_id', 'integer', 'exists:users,id'],
        ]);
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

        return [
            'id' => $conversation->id,
            'participants' => $conversation->users->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'profile_photo_path' => $user->profile_photo_path,
            ]),
            'title' => $otherUsers->pluck('name')->join(', ') ?: 'Saved notes',
            'latest_message' => $latest ? $this->serializeMessage($latest) : null,
            'updated_at' => $conversation->updated_at,
        ];
    }

    private function serializeMessage(Message $message): array
    {
        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
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
