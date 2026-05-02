<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    protected $fillable = [
        'user_id',
        'club_id',
        'title',
        'content',
        'type',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public static function normalizeLfgMetadata(array $metadata, ?int $filledOverride = null): array
    {
        $total = (int) ($metadata['spots_total'] ?? 5);
        $total = max(1, min(99, $total));

        $filled = $filledOverride ?? (int) ($metadata['spots_filled'] ?? 0);
        $filled = max(0, min($total, $filled));

        $fields = $metadata['application_fields'] ?? [];
        $fieldCount = is_array($fields)
            ? count(array_filter($fields))
            : (int) ($metadata['form_fields_count'] ?? 0);

        $metadata['spots_total'] = $total;
        $metadata['spots_filled'] = $filled;
        $metadata['spots_remaining'] = max(0, $total - $filled);
        $metadata['form_fields_count'] = max(0, $fieldCount);
        $metadata['status'] = $filled >= $total ? 'full' : 'open';

        return $metadata;
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function club()
    {
        return $this->belongsTo(Club::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }

    public function lfgApplications()
    {
        return $this->hasMany(LfgApplication::class);
    }
}
