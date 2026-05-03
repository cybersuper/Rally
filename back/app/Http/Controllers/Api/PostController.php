<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\Post;
use App\Models\Streak;
use App\Support\PostPresenter;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PostController extends Controller
{
    public function show(Request $request, Post $post): JsonResponse
    {
        $this->abortUnlessMember($request, $post);

        $post->load([
            'user:id,name,email,username,profile_photo_path',
            'club:id,name,slug,accent_color,sticker_type',
        ])->loadCount([
            'comments as total_comments_count',
            'comments as top_level_comments_count' => fn ($query) => $query->whereNull('parent_id'),
            'likes',
            'lfgApplications',
        ])->loadExists([
            'likes as liked_by_me' => fn ($query) => $query->where('user_id', $request->user()->id),
        ]);

        PostPresenter::applyClubNicknames(collect([$post]));

        return response()->json([
            'post' => $post,
        ]);
    }

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

        $this->abortUnlessMember($request, Club::findOrFail($validated['club_id']));

        $metadata = $validated['metadata'] ?? [];

        if ($validated['type'] === 'lfg') {
            $metadata = Post::normalizeLfgMetadata($metadata, 0);
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
            $user->forceFill([
                'current_streak' => $streak->count,
                'longest_streak' => max((int) $user->longest_streak, $streak->count),
            ])->save();

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

        $post->load([
                'user:id,name,email,username,profile_photo_path',
                'club:id,name,slug,accent_color,sticker_type',
            ])->loadCount([
                'comments as total_comments_count',
                'comments as top_level_comments_count' => fn ($query) => $query->whereNull('parent_id'),
                'likes',
            ]);

        PostPresenter::applyClubNicknames(collect([$post]));

        return response()->json([
            'post' => $post,
        ], 201);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $role = $request->user()
            ->clubs()
            ->where('clubs.id', $post->club_id)
            ->value('club_user.role');

        $canModerate = in_array($role, [
            Club::ROLE_OWNER,
            Club::ROLE_ADMIN,
            Club::ROLE_MODERATOR,
        ], true);

        abort_unless($post->user_id === $request->user()->id || $canModerate, 403, 'Not allowed.');

        $post->delete();

        return response()->json([
            'message' => 'Post deleted.',
        ]);
    }

    private function abortUnlessMember(Request $request, Post|Club $target): void
    {
        $clubId = $target instanceof Post ? $target->club_id : $target->id;

        abort_unless(
            $request->user()->clubs()->where('clubs.id', $clubId)->exists(),
            403,
            'You must join this club first.'
        );
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
