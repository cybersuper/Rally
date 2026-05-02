<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\Post;
use App\Models\Streak;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PostController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'club_id' => ['required', 'integer', 'exists:clubs,id'],
            'title' => ['required', 'string', 'max:140'],
            'content' => ['required', 'string', 'max:2000'],
            'type' => ['required', Rule::in(['standard', 'question', 'log', 'lfg'])],
            'metadata' => ['nullable', 'array'],
        ]);

        $isMember = $user->clubs()
            ->where('clubs.id', $validated['club_id'])
            ->exists();

        abort_unless($isMember, 403, 'You must join this club before posting.');

        $metadata = $validated['metadata'] ?? [];

        if ($validated['type'] === 'lfg') {
            $metadata = array_merge([
                'spots_filled' => 0,
                'spots_total' => 5,
                'form_fields_count' => 0,
                'status' => 'open',
            ], $metadata);
        }

        if ($validated['type'] === 'question') {
            $metadata = array_merge([
                'answers_count' => 0,
                'helpful_count' => 0,
                'best_answer_pinned' => false,
            ], $metadata);
        }

        if ($validated['type'] === 'log') {
            $streak = $this->updateStreak($user->id, $validated['club_id']);

            $metadata = array_merge([
                'streak_count' => $streak->count,
                'feeling' => $metadata['feeling'] ?? 'Solid',
                'progress_percent' => min(100, $streak->count * 5),
            ], $metadata);
        }

        $post = Post::create([
            'user_id' => $user->id,
            'club_id' => $validated['club_id'],
            'title' => $validated['title'],
            'content' => $validated['content'],
            'type' => $validated['type'],
            'metadata' => $metadata,
        ]);

        return response()->json([
            'post' => $post->load([
                'user:id,name,email',
                'club:id,name,slug,accent_color,sticker_type',
            ]),
        ], 201);
    }

    private function updateStreak(int $userId, int $clubId): Streak
    {
        $streak = Streak::firstOrCreate(
            [
                'user_id' => $userId,
                'club_id' => $clubId,
            ],
            [
                'count' => 0,
                'last_activity_at' => null,
            ]
        );

        $now = now();

        if (! $streak->last_activity_at) {
            $streak->count = 1;
        } else {
            $last = Carbon::parse($streak->last_activity_at);

            if ($last->isSameDay($now)) {
                // Already logged today, do not increment.
            } elseif ($last->greaterThanOrEqualTo($now->copy()->subHours(48))) {
                $streak->count++;
            } else {
                $streak->count = 1;
            }
        }

        $streak->last_activity_at = $now;
        $streak->save();

        return $streak;
    }
}