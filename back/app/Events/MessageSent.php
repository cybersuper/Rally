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
            'channel:id,club_id,name,type,category',
            'channel.club:id,name,slug',
            'channel.club.users:id',
        ]);
    }

    public function broadcastOn(): array
    {
        $channels = [
            $this->message->channel_id
                ? new PresenceChannel('clubs.'.$this->message->channel?->club_id.'.rooms.'.$this->message->channel_id)
                : new PrivateChannel('conversations.'.$this->message->conversation_id),
        ];

        if (! $this->message->channel_id) {
            foreach ($this->message->conversation?->users ?? collect() as $user) {
                if ((int) $user->id !== (int) $this->message->sender_id) {
                    $channels[] = new PrivateChannel('user.'.$user->id);
                }
            }
        } else {
            foreach ($this->message->channel?->club?->users ?? collect() as $user) {
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
                'room_id' => $this->message->room_id ?? $this->message->channel_id,
                'room_name' => $this->message->channel?->name,
                'room_category' => $this->message->channel?->category,
                'club_id' => $this->message->channel?->club_id,
                'club_name' => $this->message->channel?->club?->name,
                'club_slug' => $this->message->channel?->club?->slug,
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
