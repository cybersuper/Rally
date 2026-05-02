<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LfgApplication;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LfgApplicationController extends Controller
{
    public function index(Request $request, Post $post): JsonResponse
    {
        abort_unless($post->type === 'lfg', 404, 'This post is not an LFG post.');
        abort_unless($post->user_id === $request->user()->id, 403, 'Not allowed.');

        $applications = LfgApplication::query()
            ->where('post_id', $post->id)
            ->with(['user:id,name,email'])
            ->latest()
            ->get();

        return response()->json([
            'applications' => $applications->map(fn (LfgApplication $application) => $this->serializeApplication($application)),
        ]);
    }

    public function ownedPosts(Request $request): JsonResponse
    {
        $posts = Post::query()
            ->where('user_id', $request->user()->id)
            ->where('type', 'lfg')
            ->with([
                'user:id,name,email',
                'club:id,name,slug,accent_color,sticker_type',
                'lfgApplications' => fn ($query) => $query
                    ->with('user:id,name,email')
                    ->latest(),
            ])
            ->withCount('lfgApplications')
            ->latest()
            ->get();

        return response()->json([
            'posts' => $posts->map(fn (Post $post) => $this->serializeOwnedPost($post)),
        ]);
    }

    public function update(Request $request, LfgApplication $application): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:accepted,rejected'],
        ]);

        $post = $application->post()->firstOrFail();

        abort_unless($post->type === 'lfg', 404, 'This post is not an LFG post.');
        abort_unless($post->user_id === $request->user()->id, 403, 'Not allowed.');

        if ($application->status === $validated['status']) {
            return response()->json([
                'application' => $this->serializeApplication($application->load('user:id,name,email')),
                'post' => $this->serializePostSummary($post),
            ]);
        }

        [$updated, $updatedPost] = DB::transaction(function () use ($validated, $application) {
            $application = LfgApplication::query()
                ->whereKey($application->id)
                ->lockForUpdate()
                ->firstOrFail();

            $post = Post::query()
                ->whereKey($application->post_id)
                ->lockForUpdate()
                ->firstOrFail();

            $metadata = $post->metadata ?? [];
            $total = (int) ($metadata['spots_total'] ?? 0);
            $filled = (int) ($metadata['spots_filled'] ?? 0);
            $delta = 0;

            if ($application->status !== 'accepted' && $validated['status'] === 'accepted') {
                $delta = 1;
            }

            if ($application->status === 'accepted' && $validated['status'] !== 'accepted') {
                $delta = -1;
            }

            if ($delta > 0 && $total > 0 && $filled >= $total) {
                throw ValidationException::withMessages([
                    'status' => ['This LFG post has no open spots.'],
                ]);
            }

            $application->status = $validated['status'];
            $application->save();

            $post->metadata = Post::normalizeLfgMetadata($metadata, $filled + $delta);
            $post->save();

            return [
                $application->fresh()->load('user:id,name,email'),
                $post->fresh(),
            ];
        });

        return response()->json([
            'application' => $this->serializeApplication($updated),
            'post' => $this->serializePostSummary($updatedPost),
        ]);
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        abort_unless($post->type === 'lfg', 404, 'This post is not an LFG post.');
        abort_if($post->user_id === $request->user()->id, 422, 'You cannot apply to your own LFG post.');

        $isMember = $request->user()
            ->clubs()
            ->where('clubs.id', $post->club_id)
            ->exists();

        abort_unless($isMember, 403, 'You must join this club before applying.');

        $metadata = Post::normalizeLfgMetadata($post->metadata ?? []);
        abort_if(($metadata['spots_remaining'] ?? 0) <= 0, 422, 'This LFG post has no open spots.');

        $validated = $request->validate([
            'answers' => ['nullable', 'array'],
        ]);

        $this->validateRequiredAnswers($metadata, $validated['answers'] ?? []);

        $existing = LfgApplication::where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'You already applied to this group.',
                'application' => $existing,
            ], 409);
        }

        $application = LfgApplication::create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'status' => 'pending',
            'answers' => $validated['answers'] ?? null,
        ]);

        return response()->json([
            'message' => 'Application sent.',
            'application' => $this->serializeApplication($application->load('user:id,name,email')),
        ], 201);
    }

    private function validateRequiredAnswers(array $metadata, array $answers): void
    {
        $fields = $metadata['application_fields'] ?? [];

        if (! is_array($fields)) {
            return;
        }

        foreach ($fields as $field) {
            if (! is_array($field) || empty($field['required'])) {
                continue;
            }

            $key = (string) ($field['key'] ?? '');

            if ($key === '') {
                continue;
            }

            $value = $answers[$key] ?? null;

            if ($value === null || trim((string) $value) === '') {
                throw ValidationException::withMessages([
                    "answers.$key" => ['This answer is required.'],
                ]);
            }
        }
    }

    private function serializeApplication(LfgApplication $application): array
    {
        return [
            'id' => $application->id,
            'post_id' => $application->post_id,
            'user_id' => $application->user_id,
            'status' => $application->status,
            'answers' => $application->answers,
            'created_at' => $application->created_at,
            'updated_at' => $application->updated_at,
            'user' => $application->relationLoaded('user') && $application->user
                ? [
                    'id' => $application->user->id,
                    'name' => $application->user->name,
                    'email' => $application->user->email,
                ]
                : null,
        ];
    }

    private function serializeOwnedPost(Post $post): array
    {
        return [
            'id' => $post->id,
            'user_id' => $post->user_id,
            'club_id' => $post->club_id,
            'title' => $post->title,
            'content' => $post->content,
            'type' => $post->type,
            'metadata' => Post::normalizeLfgMetadata($post->metadata ?? []),
            'created_at' => $post->created_at,
            'updated_at' => $post->updated_at,
            'user' => $post->user,
            'club' => $post->club,
            'lfg_applications_count' => $post->lfg_applications_count,
            'applications' => $post->lfgApplications->map(fn (LfgApplication $application) => $this->serializeApplication($application)),
        ];
    }

    private function serializePostSummary(Post $post): array
    {
        return [
            'id' => $post->id,
            'metadata' => Post::normalizeLfgMetadata($post->metadata ?? []),
        ];
    }
}
