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

        $fields = self::normalizeApplicationFields($metadata['application_fields'] ?? []);

        $metadata['spots_total'] = $total;
        $metadata['spots_filled'] = $filled;
        $metadata['spots_remaining'] = max(0, $total - $filled);
        $metadata['application_fields'] = $fields;
        $metadata['form_fields_count'] = count($fields);
        $metadata['status'] = $filled >= $total ? 'full' : 'open';

        return $metadata;
    }

    public static function normalizeApplicationFields(mixed $fields): array
    {
        if (! is_array($fields)) {
            return [];
        }

        $allowedTypes = ['text', 'textarea', 'boolean', 'select', 'checkbox'];
        $normalized = [];

        foreach (array_values($fields) as $index => $field) {
            if (! is_array($field)) {
                continue;
            }

            $label = trim((string) ($field['label'] ?? ''));

            if ($label === '') {
                continue;
            }

            $type = (string) ($field['type'] ?? 'text');

            if (! in_array($type, $allowedTypes, true)) {
                $type = 'text';
            }

            $key = trim((string) ($field['key'] ?? $field['id'] ?? ''));
            $key = $key !== '' ? $key : 'field_'.($index + 1);

            $definition = [
                'id' => $key,
                'key' => $key,
                'label' => mb_substr($label, 0, 120),
                'type' => $type,
                'required' => (bool) ($field['required'] ?? false),
            ];

            if (in_array($type, ['select', 'checkbox'], true)) {
                $options = $field['options'] ?? [];
                $options = is_array($options) ? $options : [];
                $definition['options'] = array_values(array_filter(array_map(
                    fn ($option) => mb_substr(trim((string) $option), 0, 80),
                    $options
                )));
            }

            $normalized[] = $definition;
        }

        return array_slice($normalized, 0, 12);
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
