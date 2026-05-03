<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Flair extends Model
{
    protected $fillable = [
        'name',
        'color',
        'club_id',
    ];

    public function club()
    {
        return $this->belongsTo(Club::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class)->withTimestamps();
    }
}
