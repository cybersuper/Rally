<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Like;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LikeController extends Controller
{
    public function store(Request $request, Post $post): JsonResponse
    {
        $this->abortUnlessMember($request, $post);

        Like::firstOrCreate([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
        ]);

        return $this->summary($post, true);
    }

    public function destroy(Request $request, Post $post): JsonResponse
    {
        $this->abortUnlessMember($request, $post);

        Like::query()
            ->where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return $this->summary($post, false);
    }

    private function abortUnlessMember(Request $request, Post $post): void
    {
        $isMember = $request->user()
            ->clubs()
            ->where('clubs.id', $post->club_id)
            ->exists();

        abort_unless($isMember, 403, 'You must join this club first.');
    }

    private function summary(Post $post, bool $liked): JsonResponse
    {
        return response()->json([
            'liked' => $liked,
            'likes_count' => $post->likes()->count(),
        ]);
    }
}
