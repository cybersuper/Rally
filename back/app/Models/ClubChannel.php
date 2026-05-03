<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ClubChannel extends Model
{
    public const TYPE_TEXT = 'text';
    public const TYPE_ANNOUNCEMENT = 'announcement';

    protected $fillable = [
        'club_id',
        'name',
        'type',
    ];

    public function club()
    {
        return $this->belongsTo(Club::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class, 'channel_id');
    }
}
