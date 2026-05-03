<?php

namespace App\Models;

use App\Events\NotificationSent;
use Illuminate\Database\Eloquent\Model;

class Comment extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'parent_id',
        'content',
        'helpful_count',
        'is_best_answer',
    ];

    protected $casts = [
        'is_best_answer' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::created(function (Comment $comment) {
            $comment->loadMissing([
                'parent.user:id,name,email',
                'post.club:id,slug',
                'post.user:id,name,email',
                'user:id,name,email',
            ]);

            $post = $comment->post;
            $recipientId = $comment->parent_id
                ? $comment->parent?->user_id
                : $post?->user_id;

            if (! $post || ! $recipientId || $recipientId === $comment->user_id) {
                return;
            }

            $notification = RallyNotification::create([
                'type' => 'comment',
                'notifiable_type' => User::class,
                'notifiable_id' => $recipientId,
                'data' => [
                    'post_id' => $post->id,
                    'post_title' => $post->title,
                    'comment_id' => $comment->id,
                    'parent_comment_id' => $comment->parent_id,
                    'club_slug' => $post->club?->slug,
                    'actor_id' => $comment->user_id,
                    'actor_name' => $comment->user?->name,
                    'actor_profile_photo_path' => $comment->user?->profile_photo_path,
                ],
            ]);

            NotificationSent::dispatch($notification);
        });
    }

    public function post()
    {
        return $this->belongsTo(Post::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(Comment::class, 'parent_id');
    }

    public function replies()
    {
        return $this->hasMany(Comment::class, 'parent_id');
    }

    public function likes()
    {
        return $this->hasMany(CommentLike::class);
    }
}
