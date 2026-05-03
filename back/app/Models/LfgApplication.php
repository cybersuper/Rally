<?php

namespace App\Models;

use App\Events\NotificationSent;
use Illuminate\Database\Eloquent\Model;

class LfgApplication extends Model
{
    protected $fillable = [
        'post_id',
        'user_id',
        'status',
        'answers',
    ];

    protected $casts = [
        'answers' => 'array',
    ];

    protected static function booted(): void
    {
        static::created(function (LfgApplication $application) {
            $application->loadMissing([
                'post.club:id,slug',
                'post.user:id,name,email',
                'user:id,name,email',
            ]);

            $post = $application->post;

            if (! $post || $post->user_id === $application->user_id) {
                return;
            }

            $notification = RallyNotification::create([
                'type' => 'lfg_app',
                'notifiable_type' => User::class,
                'notifiable_id' => $post->user_id,
                'data' => [
                    'post_id' => $post->id,
                    'post_title' => $post->title,
                    'application_id' => $application->id,
                    'club_slug' => $post->club?->slug,
                    'actor_id' => $application->user_id,
                    'actor_name' => $application->user?->name,
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
}
