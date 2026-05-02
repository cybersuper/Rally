<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(Post $post): JsonResponse
    {
        $comments = $post->comments()
            ->with('user:id,name,email')
            ->orderByDesc('is_best_answer')
            ->orderByDesc('helpful_count')
            ->latest()
            ->get();

        return response()->json([
            'comments' => $comments,
        ]);
    }

    public function store(Request $request, Post $post): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:1500'],
        ]);

        $comment = Comment::create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'content' => $validated['content'],
        ]);

        if ($post->type === 'question') {
            $metadata = $post->metadata ?? [];
            $metadata['answers_count'] = ($metadata['answers_count'] ?? 0) + 1;
            $post->metadata = $metadata;
            $post->save();
        }

        return response()->json([
            'comment' => $comment->load('user:id,name,email'),
        ], 201);
    }
}