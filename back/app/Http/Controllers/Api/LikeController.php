<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Events\NotificationSent;
use App\Models\Like;
use App\Models\Post;
use App\Models\RallyNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LikeController extends Controller
{
    public function store(Request $request, Post $post): JsonResponse
    {
        $this->abortUnlessMember($request, $post);

        $like = Like::firstOrCreate([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
        ]);

        if ($like->wasRecentlyCreated && $post->user_id !== $request->user()->id) {
            $notification = RallyNotification::create([
                'type' => 'like',
                'notifiable_type' => User::class,
                'notifiable_id' => $post->user_id,
                'data' => [
                    'target' => 'post',
                    'post_id' => $post->id,
                    'post_title' => $post->title,
                    'club_slug' => $post->club()->value('slug'),
                    'actor_id' => $request->user()->id,
                    'actor_name' => $request->user()->name,
                ],
            ]);

            NotificationSent::dispatch($notification);
        }

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
