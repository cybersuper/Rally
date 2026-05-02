<?php

namespace App\Models;

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

    public function post()
    {
        return $this->belongsTo(Post::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}