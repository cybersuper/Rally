<?php

namespace App\Models;

use App\Events\NotificationSent;
use Illuminate\Database\Eloquent\Model;

class CommentLike extends Model
{
    protected $fillable = [
        'comment_id',
        'user_id',
    ];

    protected static function booted(): void
    {
        static::created(function (CommentLike $like) {
            $like->loadMissing([
                'comment.post.club:id,slug',
                'comment.user:id,name,email',
                'user:id,name,email',
            ]);

            $comment = $like->comment;
            $post = $comment?->post;

            if (! $comment || ! $post || $comment->user_id === $like->user_id) {
                return;
            }

            $notification = RallyNotification::create([
                'type' => 'like',
                'notifiable_type' => User::class,
                'notifiable_id' => $comment->user_id,
                'data' => [
                    'target' => 'comment',
                    'post_id' => $post->id,
                    'post_title' => $post->title,
                    'comment_id' => $comment->id,
                    'club_slug' => $post->club?->slug,
                    'actor_id' => $like->user_id,
                    'actor_name' => $like->user?->name,
                ],
            ]);

            NotificationSent::dispatch($notification);
        });
    }

    public function comment()
    {
        return $this->belongsTo(Comment::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
