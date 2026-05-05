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

        $technology = Category::firstOrCreate(
            ['slug' => 'technology'],
            ['name' => 'Technology & Engineering', 'icon_url' => null]
        );

        $music = Category::firstOrCreate(
            ['slug' => 'music'],
            ['name' => 'Music & Performance', 'icon_url' => null]
        );

        $outdoors = Category::firstOrCreate(
            ['slug' => 'outdoors'],
            ['name' => 'Outdoor Adventure', 'icon_url' => null]
        );

        $creative = Category::firstOrCreate(
            ['slug' => 'creative'],
            ['name' => 'Creative Arts & Design', 'icon_url' => null]
        );

        $science = Category::firstOrCreate(
            ['slug' => 'science'],
            ['name' => 'Science & Knowledge', 'icon_url' => null]
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

        $cyber = Club::updateOrCreate(
            ['slug' => 'cybersecurity-lab'],
            [
                'name' => 'Cybersecurity Lab',
                'description' => 'CTF practice, secure coding, and ethical hacking.',
                'category' => 'Cybersecurity',
                'category_id' => $technology->id,
                'visibility' => 'public',
                'accent_color' => '#22d3ee',
                'sticker_type' => 'sparkle',
                'cover_image_url' => 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $dataScience = Club::updateOrCreate(
            ['slug' => 'data-science-squad'],
            [
                'name' => 'Data Science Squad',
                'description' => 'Python, Kaggle sprints, and clean dashboards.',
                'category' => 'Data Science',
                'category_id' => $technology->id,
                'visibility' => 'public',
                'accent_color' => '#a78bfa',
                'sticker_type' => 'question',
                'cover_image_url' => 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $openSource = Club::updateOrCreate(
            ['slug' => 'open-source-forge'],
            [
                'name' => 'Open Source Forge',
                'description' => 'Shipping PRs, learning Git, and contributing together.',
                'category' => 'Open Source',
                'category_id' => $technology->id,
                'visibility' => 'public',
                'accent_color' => '#34d399',
                'sticker_type' => 'sparkle',
                'cover_image_url' => 'https://images.unsplash.com/photo-1522542550221-31fd19575a2d?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $robotics = Club::updateOrCreate(
            ['slug' => 'robotics-league'],
            [
                'name' => 'Robotics League',
                'description' => 'Arduino builds, sensors, and friendly challenges.',
                'category' => 'Robotics',
                'category_id' => $technology->id,
                'visibility' => 'public',
                'accent_color' => '#f97316',
                'sticker_type' => 'fire',
                'cover_image_url' => 'https://images.unsplash.com/photo-1581091870627-3d4f5a1c2b4a?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $beatmakers = Club::updateOrCreate(
            ['slug' => 'beatmaker-studio'],
            [
                'name' => 'Beatmaker Studio',
                'description' => 'FL Studio tips, sampling, and weekly beat flips.',
                'category' => 'Audio Production',
                'category_id' => $music->id,
                'visibility' => 'public',
                'accent_color' => '#fb7185',
                'sticker_type' => 'sparkle',
                'cover_image_url' => 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $cinema = Club::updateOrCreate(
            ['slug' => 'cinema-club'],
            [
                'name' => 'The Cinema Club',
                'description' => 'Indie classics, scene breakdowns, and film nights.',
                'category' => 'Videography',
                'category_id' => $creative->id,
                'visibility' => 'public',
                'accent_color' => '#60a5fa',
                'sticker_type' => 'question',
                'cover_image_url' => 'https://images.unsplash.com/photo-1524985069026-dd778a71c7b4?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $calligraphy = Club::updateOrCreate(
            ['slug' => 'calligraphy-collective'],
            [
                'name' => 'Calligraphy Collective',
                'description' => 'Arabic script meets modern lettering and murals.',
                'category' => 'Calligraphy',
                'category_id' => $creative->id,
                'visibility' => 'public',
                'accent_color' => '#facc15',
                'sticker_type' => 'sparkle',
                'cover_image_url' => 'https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $hikes = Club::updateOrCreate(
            ['slug' => 'hike-camp-crew'],
            [
                'name' => 'Hike & Camp Crew',
                'description' => 'Weekend hikes, gear checklists, and trail photos.',
                'category' => 'Outdoor Adventure',
                'category_id' => $outdoors->id,
                'visibility' => 'public',
                'accent_color' => '#22c55e',
                'sticker_type' => 'fire',
                'cover_image_url' => 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $astronomy = Club::updateOrCreate(
            ['slug' => 'astronomy-nights'],
            [
                'name' => 'Astronomy Nights',
                'description' => 'Stargazing meetups, space news, and telescope tips.',
                'category' => 'Astronomy',
                'category_id' => $science->id,
                'visibility' => 'public',
                'accent_color' => '#38bdf8',
                'sticker_type' => 'sparkle',
                'cover_image_url' => 'https://images.unsplash.com/photo-1444703686981-a3abbc4d4fe3?auto=format&fit=crop&w=1400&q=60',
            ]
        );

        $jay->clubs()->syncWithoutDetaching([
            $dnd->id => ['role' => Club::ROLE_MEMBER],
            $sketch->id => ['role' => Club::ROLE_MEMBER],
            $motion->id => ['role' => Club::ROLE_MEMBER],
            $indie->id => ['role' => Club::ROLE_OWNER],
        ]);

        $theo->clubs()->syncWithoutDetaching([
            $dnd->id => ['role' => Club::ROLE_OWNER],
        ]);

        $mina->clubs()->syncWithoutDetaching([
            $sketch->id => ['role' => Club::ROLE_OWNER],
            $indie->id => ['role' => Club::ROLE_MODERATOR],
        ]);

        $noor->clubs()->syncWithoutDetaching([
            $motion->id => ['role' => Club::ROLE_OWNER],
        ]);

        $jay->clubs()->syncWithoutDetaching([
            $dataScience->id => ['role' => Club::ROLE_MEMBER],
            $openSource->id => ['role' => Club::ROLE_MEMBER],
            $cinema->id => ['role' => Club::ROLE_MEMBER],
        ]);

        $theo->clubs()->syncWithoutDetaching([
            $cyber->id => ['role' => Club::ROLE_MEMBER],
            $robotics->id => ['role' => Club::ROLE_MEMBER],
            $hikes->id => ['role' => Club::ROLE_MEMBER],
        ]);

        $mina->clubs()->syncWithoutDetaching([
            $calligraphy->id => ['role' => Club::ROLE_OWNER],
            $beatmakers->id => ['role' => Club::ROLE_MEMBER],
        ]);

        $noor->clubs()->syncWithoutDetaching([
            $astronomy->id => ['role' => Club::ROLE_MEMBER],
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
