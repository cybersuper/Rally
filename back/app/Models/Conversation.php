<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Conversation extends Model
{
    protected $fillable = [
        'title',
        'photo_path',
        'party_post_id',
        'leader_id',
        'next_meeting_at',
        'meeting_label',
        'meeting_reminder_sent_at',
    ];

    protected $casts = [
        'next_meeting_at' => 'datetime',
        'meeting_reminder_sent_at' => 'datetime',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class)->withPivot('member_title')->withTimestamps();
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}
