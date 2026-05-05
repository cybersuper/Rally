<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Club;
use App\Models\Post;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $tabletop = Category::firstOrCreate(
            ['slug' => 'tabletop'],
            ['name' => 'Tabletop', 'icon_url' => null]
        );

        $art = Category::firstOrCreate(
            ['slug' => 'art'],
            ['name' => 'Art', 'icon_url' => null]
        );

        $fitness = Category::firstOrCreate(
            ['slug' => 'fitness'],
            ['name' => 'Fitness', 'icon_url' => null]
        );

        $games = Category::firstOrCreate(
            ['slug' => 'games'],
            ['name' => 'Games', 'icon_url' => null]
        );

        $jay = User::withTrashed()->firstOrNew(['email' => 'jay@example.com']);
        if ($jay->trashed()) {
            $jay->restore();
        }
        $jay->forceFill([
            'name' => 'Jay Carter',
            'username' => 'jay',
            'password' => Hash::make('password'),
        ])->save();

        $theo = User::withTrashed()->firstOrNew(['email' => 'theo@example.com']);
        if ($theo->trashed()) {
            $theo->restore();
        }
        $theo->forceFill([
            'name' => 'Theo Banks',
            'username' => 'theo',
            'password' => Hash::make('password'),
        ])->save();

        $mina = User::withTrashed()->firstOrNew(['email' => 'mina@example.com']);
        if ($mina->trashed()) {
            $mina->restore();
        }
        $mina->forceFill([
            'name' => 'Mina Okoye',
            'username' => 'mina',
            'password' => Hash::make('password'),
        ])->save();

        $noor = User::withTrashed()->firstOrNew(['email' => 'noor@example.com']);
        if ($noor->trashed()) {
            $noor->restore();
        }
        $noor->forceFill([
            'name' => 'Noor Ellis',
            'username' => 'noor',
            'password' => Hash::make('password'),
        ])->save();

        $dnd = Club::updateOrCreate(
            ['slug' => 'dnd-table'],
            [
                'name' => 'DnD Table',
                'description' => 'One-shots, campaigns, dice chaos, and table talk.',
                'category' => 'Tabletop',
                'category_id' => $tabletop->id,
                'visibility' => 'public',
                'accent_color' => '#facc15',
                'sticker_type' => 'd20',
                'cover_image_url' => 'https://images.unsplash.com/photo-1560972550-aba3456b5564?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $sketch = Club::updateOrCreate(
            ['slug' => 'sketchbook-club'],
            [
                'name' => 'Sketchbook Club',
                'description' => 'Daily drawing, art feedback, and sketch swaps.',
                'category' => 'Art',
                'category_id' => $art->id,
                'visibility' => 'public',
                'accent_color' => '#f472b6',
                'sticker_type' => 'question',
                'cover_image_url' => 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $motion = Club::updateOrCreate(
            ['slug' => 'daily-motion'],
            [
                'name' => 'Daily Motion',
                'description' => 'Fitness logs, mobility, running, and consistency.',
                'category' => 'Fitness',
                'category_id' => $fitness->id,
                'visibility' => 'public',
                'accent_color' => '#34d399',
                'sticker_type' => 'fire',
                'cover_image_url' => 'https://images.unsplash.com/photo-1517832207067-4db24a2ae47c?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $indie = Club::updateOrCreate(
            ['slug' => 'indie-queue'],
            [
                'name' => 'Indie Queue',
                'description' => 'Tiny game builds, devlogs, and pixel polish.',
                'category' => 'Games',
                'category_id' => $games->id,
                'visibility' => 'private',
                'accent_color' => '#60a5fa',
                'sticker_type' => 'sparkle',
                'cover_image_url' => 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $jay->clubs()->attach([
            $dnd->id => ['role' => Club::ROLE_MEMBER],
            $sketch->id => ['role' => Club::ROLE_MEMBER],
            $motion->id => ['role' => Club::ROLE_MEMBER],
            $indie->id => ['role' => Club::ROLE_OWNER],
        ]);

        $theo->clubs()->attach([
            $dnd->id => ['role' => Club::ROLE_OWNER],
        ]);

        $mina->clubs()->attach([
            $sketch->id => ['role' => Club::ROLE_OWNER],
            $indie->id => ['role' => Club::ROLE_MODERATOR],
        ]);

        $noor->clubs()->attach([
            $motion->id => ['role' => Club::ROLE_OWNER],
        ]);

        $lfg = Post::create([
            'user_id' => $theo->id,
            'club_id' => $dnd->id,
            'title' => 'Moonlit Heist',
            'content' => 'Running a one shot tonight. Level 4 characters, social heavy mystery, new players welcome.',
            'type' => 'lfg',
            'metadata' => Post::normalizeLfgMetadata([
                'starts_at' => '21:00',
                'spots_total' => 5,
                'application_fields' => [
                    [
                        'key' => 'character',
                        'label' => 'Character',
                        'required' => true,
                    ],
                    [
                        'key' => 'experience',
                        'label' => 'Experience',
                        'type' => 'textarea',
                    ],
                ],
            ], 2),
        ]);

        $lfg->lfgApplications()->create([
            'user_id' => $jay->id,
            'status' => 'pending',
            'answers' => [
                'character' => 'Half-elf rogue',
                'experience' => 'Beginner-friendly, played two one-shots',
            ],
        ]);

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
    }
}
