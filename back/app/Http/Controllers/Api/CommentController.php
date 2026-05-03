<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\Comment;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CommentController extends Controller
{
    public function index(Request $request, Post $post): JsonResponse
    {
        $this->abortUnlessMember($request, $post);

        if ($request->boolean('preview')) {
            $comments = $post->comments()
                ->whereNull('parent_id')
                ->with('user:id,name,email')
                ->withCount('likes')
                ->withExists([
                    'likes as liked_by_me' => fn ($query) => $query->where('user_id', $request->user()->id),
                ])
                ->latest()
                ->limit(2)
                ->get();

            return response()->json([
                'comments' => $comments->map(fn (Comment $comment) => $this->serializeComment($comment)),
            ]);
        }

        $comments = $post->comments()
            ->with('user:id,name,email')
            ->withCount('likes')
            ->withExists([
                'likes as liked_by_me' => fn ($query) => $query->where('user_id', $request->user()->id),
            ])
            ->orderByRaw('parent_id is not null')
            ->orderByDesc('likes_count')
            ->orderByDesc('is_best_answer')
            ->latest()
            ->get();

        return response()->json([
            'comments' => $this->buildTree($comments),
        ]);
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        $this->abortUnlessMember($request, $post);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:1500'],
            'parent_id' => ['nullable', 'integer', Rule::exists('comments', 'id')->where('post_id', $post->id)],
        ]);

        $comment = Comment::create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'parent_id' => $validated['parent_id'] ?? null,
            'content' => $validated['content'],
        ]);

        if ($post->type === 'question') {
            $metadata = $post->metadata ?? [];
            $metadata['answers_count'] = ($metadata['answers_count'] ?? 0) + 1;
            $post->metadata = $metadata;
            $post->save();
        }

        return response()->json([
            'comment' => $this->serializeComment(
                $comment->load('user:id,name,email')->loadCount('likes')
            ),
        ], 201);
    }

    public function destroy(Request $request, Comment $comment): JsonResponse
    {
        $post = $comment->post()->firstOrFail();
        $canModerate = $this->canModerate($request, $post);

        abort_unless($comment->user_id === $request->user()->id || $canModerate, 403, 'Not allowed.');

        $comment->delete();

        if ($post->type === 'question') {
            $metadata = $post->metadata ?? [];
            $metadata['answers_count'] = max(0, (int) ($metadata['answers_count'] ?? 1) - 1);
            $post->metadata = $metadata;
            $post->save();
        }

        return response()->json([
            'message' => 'Comment deleted.',
        ]);
    }

    private function abortUnlessMember(Request $request, Post $post): void
    {
        abort_unless(
            $request->user()->clubs()->where('clubs.id', $post->club_id)->exists(),
            403,
            'You must join this club first.'
        );
    }

    private function canModerate(Request $request, Post $post): bool
    {
        $role = $request->user()
            ->clubs()
            ->where('clubs.id', $post->club_id)
            ->value('club_user.role');

        return in_array($role, [
            Club::ROLE_OWNER,
            Club::ROLE_ADMIN,
            Club::ROLE_MODERATOR,
        ], true);
    }

    private function buildTree($comments): array
    {
        $children = [];

        foreach ($comments as $comment) {
            $parentId = $comment->parent_id ?: 0;
            $children[$parentId][] = $comment;
        }

        $makeBranch = function (int $parentId) use (&$makeBranch, $children): array {
            return array_map(function (Comment $comment) use (&$makeBranch) {
                $serialized = $this->serializeComment($comment);
                $serialized['replies'] = $makeBranch($comment->id);

                return $serialized;
            }, $children[$parentId] ?? []);
        };

        return $makeBranch(0);
    }

    private function serializeComment(Comment $comment): array
    {
        return [
            'id' => $comment->id,
            'post_id' => $comment->post_id,
            'user_id' => $comment->user_id,
            'parent_id' => $comment->parent_id,
            'content' => $comment->content,
            'helpful_count' => $comment->helpful_count,
            'is_best_answer' => $comment->is_best_answer,
            'likes_count' => (int) ($comment->likes_count ?? 0),
            'liked_by_me' => (bool) ($comment->liked_by_me ?? false),
            'created_at' => $comment->created_at,
            'updated_at' => $comment->updated_at,
            'user' => $comment->relationLoaded('user') && $comment->user
                ? [
                    'id' => $comment->user->id,
                    'name' => $comment->user->name,
                    'email' => $comment->user->email,
                ]
                : null,
            'replies' => $comment->relationLoaded('replies') ? $comment->replies : [],
        ];
    }
}
