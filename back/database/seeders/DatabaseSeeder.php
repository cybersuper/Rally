<?php

namespace Database\Seeders;

use App\Models\Club;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $jay = User::create([
            'name' => 'Jay Carter',
            'email' => 'jay@example.com',
            'password' => Hash::make('password'),
        ]);

        $theo = User::create([
            'name' => 'Theo Banks',
            'email' => 'theo@example.com',
            'password' => Hash::make('password'),
        ]);

        $mina = User::create([
            'name' => 'Mina Okoye',
            'email' => 'mina@example.com',
            'password' => Hash::make('password'),
        ]);

        $noor = User::create([
            'name' => 'Noor Ellis',
            'email' => 'noor@example.com',
            'password' => Hash::make('password'),
        ]);

        $dnd = Club::create([
            'name' => 'DnD Table',
            'slug' => 'dnd-table',
            'description' => 'One-shots, campaigns, dice chaos, and table talk.',
            'accent_color' => '#facc15',
            'sticker_type' => 'd20',
            'cover_image_url' => 'https://images.unsplash.com/photo-1560972550-aba3456b5564?auto=format&fit=crop&w=1400&q=60',
        ]);

        $sketch = Club::create([
            'name' => 'Sketchbook Club',
            'slug' => 'sketchbook-club',
            'description' => 'Daily drawing, art feedback, and sketch swaps.',
            'accent_color' => '#f472b6',
            'sticker_type' => 'question',
            'cover_image_url' => 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1400&q=60',
        ]);

        $motion = Club::create([
            'name' => 'Daily Motion',
            'slug' => 'daily-motion',
            'description' => 'Fitness logs, mobility, running, and consistency.',
            'accent_color' => '#34d399',
            'sticker_type' => 'fire',
            'cover_image_url' => 'https://images.unsplash.com/photo-1517832207067-4db24a2ae47c?auto=format&fit=crop&w=1400&q=60',
        ]);

        $indie = Club::create([
            'name' => 'Indie Queue',
            'slug' => 'indie-queue',
            'description' => 'Tiny game builds, devlogs, and pixel polish.',
            'accent_color' => '#60a5fa',
            'sticker_type' => 'sparkle',
            'cover_image_url' => 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1400&q=60',
        ]);

        Post::create([
            'user_id' => $theo->id,
            'club_id' => $dnd->id,
            'title' => 'Moonlit Heist',
            'content' => 'Running a one shot tonight. Level 4 characters, social heavy mystery, new players welcome.',
            'type' => 'lfg',
            'metadata' => [
                'starts_at' => '21:00',
                'spots_filled' => 2,
                'spots_total' => 5,
                'form_fields_count' => 2,
                'status' => 'open',
            ],
        ]);

        Post::create([
            'user_id' => $mina->id,
            'club_id' => $sketch->id,
            'title' => 'Dark mode artwork compression',
            'content' => 'How do you stop dark-mode artwork from looking muddy once it is compressed for the feed?',
            'type' => 'question',
            'metadata' => [
                'answers_count' => 9,
                'helpful_count' => 34,
                'best_answer_pinned' => true,
            ],
        ]);

        Post::create([
            'user_id' => $noor->id,
            'club_id' => $motion->id,
            'title' => 'Day 18',
            'content' => 'Quick mobility work before class, then an easy 3k. Keeping it light felt like a win.',
            'type' => 'log',
            'metadata' => [
                'streak_count' => 18,
                'feeling' => 'Locked In',
                'progress_percent' => 75,
            ],
        ]);

        Post::create([
            'user_id' => $jay->id,
            'club_id' => $indie->id,
            'title' => 'Combat polish note',
            'content' => 'Tiny combat polish note: a hit-stop effect below 90ms feels snappy, above 120ms starts to feel sticky.',
            'type' => 'standard',
            'metadata' => [
                'tag' => 'standard',
            ],
        ]);
        $jay->clubs()->attach([$dnd->id, $sketch->id, $motion->id, $indie->id]);
$theo->clubs()->attach([$dnd->id]);
$mina->clubs()->attach([$sketch->id, $indie->id]);
$noor->clubs()->attach([$motion->id]);
$question = Post::create([
    'user_id' => $mina->id,
    'club_id' => $sketch->id,
    'title' => 'Dark mode artwork compression',
    'content' => 'How do you stop dark-mode artwork from looking muddy once it is compressed for the feed?',
    'type' => 'question',
    'metadata' => [
        'answers_count' => 2,
        'helpful_count' => 12,
        'best_answer_pinned' => true,
    ],
]);

$question->comments()->create([
    'user_id' => $jay->id,
    'content' => 'Try lifting the midtones before export and avoid pure black shadows. Dark UIs compress gradients hard.',
    'helpful_count' => 12,
    'is_best_answer' => true,
]);

$question->comments()->create([
    'user_id' => $theo->id,
    'content' => 'I usually add a subtle noise layer before compression so flat dark areas do not band as much.',
    'helpful_count' => 7,
]);
$lfg = Post::create([
    'user_id' => $theo->id,
    'club_id' => $dnd->id,
    'title' => 'Moonlit Heist',
    'content' => 'Running a one shot tonight. Level 4 characters, social heavy mystery, new players welcome.',
    'type' => 'lfg',
    'metadata' => [
        'starts_at' => '21:00',
        'spots_filled' => 2,
        'spots_total' => 5,
        'form_fields_count' => 2,
        'status' => 'open',
    ],
]);

$lfg->lfgApplications()->create([
    'user_id' => $jay->id,
    'status' => 'pending',
    'answers' => [
        'character' => 'Half-elf rogue',
        'experience' => 'Beginner-friendly, played two one-shots',
    ],
]);
    }
}