<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;

#[Fillable([
    'name',
    'username',
    'email',
    'password',
    'bio',
    'profile_photo_path',
    'cover_photo_path',
    'current_streak',
    'longest_streak',
    'private_profile',
])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;
    

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'private_profile' => 'boolean',
        ];
    }
    public function posts()
    {
        return $this->hasMany(\App\Models\Post::class);
    }
    
    public function clubs()
    {
        return $this->belongsToMany(\App\Models\Club::class)->withPivot(['role', 'nickname'])->withTimestamps();
    }

    public function flairs()
    {
        return $this->belongsToMany(\App\Models\Flair::class)->withTimestamps();
    }
    
    public function comments()
    {
        return $this->hasMany(\App\Models\Comment::class);
    }
    
    public function lfgApplications()
    {
        return $this->hasMany(\App\Models\LfgApplication::class);
    }
}
