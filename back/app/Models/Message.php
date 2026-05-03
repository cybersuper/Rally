<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'conversation_id',
        'channel_id',
        'room_id',
        'sender_id',
        'body',
        'read_at',
        'is_pinned',
        'deleted_at',
    ];

    protected $casts = [
        'read_at' => 'datetime',
        'is_pinned' => 'boolean',
        'deleted_at' => 'datetime',
    ];

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    public function channel()
    {
        return $this->belongsTo(ClubChannel::class, 'channel_id');
    }
}
