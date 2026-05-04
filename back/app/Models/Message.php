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
        'content_index',
        'read_at',
        'is_pinned',
        'deleted_at',
    ];

    protected $casts = [
        'body' => 'encrypted',
        'read_at' => 'datetime',
        'is_pinned' => 'boolean',
        'deleted_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::saving(function (Message $message) {
            if (! $message->isDirty('body')) {
                return;
            }

            $message->content_index = static::blindIndex((string) $message->body);
        });
    }

    public static function blindIndex(string $content): string
    {
        $key = config('services.message_search_key') ?: env('SEARCH_KEY');

        if (! is_string($key) || strlen($key) < 32) {
            throw new \RuntimeException('SEARCH_KEY must be set to at least 32 characters.');
        }

        return hash_hmac('sha256', static::normalizeSearchContent($content), $key);
    }

    private static function normalizeSearchContent(string $content): string
    {
        return trim(mb_strtolower($content));
    }

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
