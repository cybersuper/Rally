<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Support\PostPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimelineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $sort = (string) $request->query('sort', 'date');

        $clubIds = $user->clubs()->pluck('clubs.id');

        $postsQuery = Post::query()
            ->whereIn('club_id', $clubIds)
            ->with([
                'user:id,name,email,username,profile_photo_path',
                'club:id,name,slug,accent_color,sticker_type,sticker_image_url',
                'featuredComment.user:id,name,email,username,profile_photo_path',
            ])
            ->withCount([
                'comments as total_comments_count',
                'comments as top_level_comments_count' => fn ($query) => $query->whereNull('parent_id'),
                'likes',
                'lfgApplications',
            ])
            ->withExists([
                'likes as liked_by_me' => fn ($query) => $query->where('user_id', $user->id),
            ]);

        match ($sort) {
            'popularity' => $postsQuery->orderByDesc('likes_count')->latest(),
            'replies' => $postsQuery->orderByDesc('total_comments_count')->latest(),
            'type' => $postsQuery->orderBy('type')->latest(),
            default => $postsQuery->latest(),
        };

        $posts = $postsQuery->paginate(20);

        PostPresenter::applyClubNicknames($posts);

        return response()->json($posts);
    }
}
