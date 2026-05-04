<?php

namespace App\Events;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MeetingPlanned implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public Conversation $conversation, public Message $message)
    {
        $this->conversation->loadMissing('users:id');
        $this->message->loadMissing('sender:id,name,username,profile_photo_path');
    }

    public function broadcastOn(): array
    {
        return [new PrivateChannel('conversations.'.$this->conversation->id)];
    }

    public function broadcastAs(): string
    {
        return 'MeetingPlanned';
    }

    public function broadcastWith(): array
    {
        return [
            'conversation' => [
                'id' => $this->conversation->id,
                'title' => $this->conversation->title,
                'next_meeting_at' => $this->conversation->next_meeting_at,
                'meeting_label' => $this->conversation->meeting_label,
            ],
            'message' => [
                'id' => $this->message->id,
                'conversation_id' => $this->message->conversation_id,
                'sender_id' => $this->message->sender_id,
                'body' => $this->message->body,
                'read_at' => $this->message->read_at,
                'is_pinned' => (bool) $this->message->is_pinned,
                'deleted_at' => $this->message->deleted_at,
                'created_at' => $this->message->created_at,
                'sender' => [
                    'id' => $this->message->sender?->id,
                    'name' => $this->message->sender?->name,
                    'username' => $this->message->sender?->username,
                    'profile_photo_path' => $this->message->sender?->profile_photo_path,
                ],
            ],
        ];
    }
}
