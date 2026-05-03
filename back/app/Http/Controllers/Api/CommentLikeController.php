<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\CommentLike;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommentLikeController extends Controller
{
    public function store(Request $request, Comment $comment): JsonResponse
    {
        $this->abortUnlessMember($request, $comment);

        CommentLike::firstOrCreate([
            'comment_id' => $comment->id,
            'user_id' => $request->user()->id,
        ]);

        return $this->summary($comment, true);
    }

    public function destroy(Request $request, Comment $comment): JsonResponse
    {
        $this->abortUnlessMember($request, $comment);

        CommentLike::query()
            ->where('comment_id', $comment->id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return $this->summary($comment, false);
    }

    private function abortUnlessMember(Request $request, Comment $comment): void
    {
        $post = $comment->post()->firstOrFail();

        abort_unless(
            $request->user()->clubs()->where('clubs.id', $post->club_id)->exists(),
            403,
            'You must join this club first.'
        );
    }

    private function summary(Comment $comment, bool $liked): JsonResponse
    {
        return response()->json([
            'liked' => $liked,
            'likes_count' => $comment->likes()->count(),
        ]);
    }
}
