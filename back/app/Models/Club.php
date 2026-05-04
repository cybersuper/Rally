<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Club extends Model
{
    public const ROLE_OWNER = 'OWNER';
    public const ROLE_ADMIN = 'ADMIN';
    public const ROLE_MODERATOR = 'MODERATOR';
    public const ROLE_MEMBER = 'MEMBER';

    protected $fillable = [
        'name',
        'slug',
        'description',
        'category',
        'visibility',
        'accent_color',
        'sticker_type',
        'cover_image_url',
        'sticker_image_url',
    ];

    public function posts()
    {
        return $this->hasMany(Post::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class)->withPivot(['role', 'nickname', 'show_streak'])->withTimestamps();
    }

    public function channels()
    {
        return $this->hasMany(ClubChannel::class);
    }
}
