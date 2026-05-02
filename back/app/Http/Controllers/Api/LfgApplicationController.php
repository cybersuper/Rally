<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LfgApplication;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LfgApplicationController extends Controller
{
    public function store(Request $request, Post $post): JsonResponse
    {
        abort_unless($post->type === 'lfg', 404, 'This post is not an LFG post.');

        $validated = $request->validate([
            'answers' => ['nullable', 'array'],
        ]);

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
            'application' => $application,
        ], 201);
    }
}