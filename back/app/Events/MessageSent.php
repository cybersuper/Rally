<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public Message $message)
    {
        $this->message->loadMissing([
            'sender:id,name,username,profile_photo_path',
            'conversation.users:id',
            'channel.club.users:id',
        ]);
    }

    public function broadcastOn(): array
    {
        $channels = [
            $this->message->channel_id
                ? new PresenceChannel('club.'.$this->message->channel?->club_id)
                : new PrivateChannel('conversations.'.$this->message->conversation_id),
        ];

        if (! $this->message->channel_id) {
            foreach ($this->message->conversation?->users ?? collect() as $user) {
                if ((int) $user->id !== (int) $this->message->sender_id) {
                    $channels[] = new PrivateChannel('user.'.$user->id);
                }
            }
        }

        return $channels;
    }

    public function broadcastAs(): string
    {
        return 'MessageSent';
    }

    public function broadcastWith(): array
    {
        return [
            'message' => [
                'id' => $this->message->id,
                'conversation_id' => $this->message->conversation_id,
                'channel_id' => $this->message->channel_id,
                'room_id' => $this->message->channel_id,
                'sender_id' => $this->message->sender_id,
                'body' => $this->message->body,
                'read_at' => $this->message->read_at,
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
