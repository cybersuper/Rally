<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\Streak;
use App\Support\PostPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimelineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $sort = (string) $request->query('sort', 'latest');
        $type = (string) $request->query('type', '');

        $userClubIds = $user->clubs()->pluck('clubs.id');

        $filterClubIdsParam = (string) $request->query('club_ids', '');
        $filterClubIds = collect(explode(',', $filterClubIdsParam))
            ->map(fn ($id) => (int) trim($id))
            ->filter(fn ($id) => $id > 0);

        $clubIds = $filterClubIds->isEmpty()
            ? $userClubIds
            : $userClubIds->intersect($filterClubIds);

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

        if (in_array($type, ['standard', 'question', 'log', 'lfg'], true)) {
            $postsQuery->where('type', $type);
        }

        match ($sort) {
            'most_helpful' => $postsQuery->orderByDesc('likes_count')->latest(),
            'highest_streak' => $postsQuery
                ->addSelect([
                    'streak_count' => Streak::query()
                        ->select('count')
                        ->whereColumn('streaks.user_id', 'posts.user_id')
                        ->whereColumn('streaks.club_id', 'posts.club_id')
                        ->limit(1),
                ])
                ->orderByDesc('streak_count')
                ->latest(),
            default => $postsQuery->latest(),
        };

        $posts = $postsQuery->paginate(20);

        PostPresenter::applyClubNicknames($posts);

        return response()->json($posts);
    }
}
