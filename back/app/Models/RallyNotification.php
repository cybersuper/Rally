<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RallyNotification extends Model
{
    protected $table = 'notifications';
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = [
        'type',
        'notifiable_type',
        'notifiable_id',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::creating(function (RallyNotification $notification) {
            if (! $notification->getKey()) {
                $notification->{$notification->getKeyName()} = (string) str()->uuid();
            }
        });
    }

    public function notifiable()
    {
        return $this->morphTo();
    }
}
