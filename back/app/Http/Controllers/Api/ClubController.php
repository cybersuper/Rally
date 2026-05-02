<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClubController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $clubs = Club::query()
            ->withCount('users')
            ->orderBy('name')
            ->get();

        $memberLookup = [];

        if ($user) {
            $memberIds = $user->clubs()->pluck('clubs.id')->all();
            $memberLookup = array_fill_keys($memberIds, true);
        }

        $data = $clubs->map(function (Club $club) use ($memberLookup) {
            return [
                'id' => $club->id,
                'name' => $club->name,
                'slug' => $club->slug,
                'description' => $club->description,
                'accent_color' => $club->accent_color,
                'sticker_type' => $club->sticker_type,
                'cover_image_url' => $club->cover_image_url,
                'members_count' => $club->users_count,
                'is_member' => isset($memberLookup[$club->id]),
            ];
        });

        return response()->json([
            'clubs' => $data,
        ]);
    }

    public function show(Request $request, Club $club): JsonResponse
    {
        $user = $request->user();

        $isMember = $user->clubs()->where('clubs.id', $club->id)->exists();

        return response()->json([
            'club' => [
                'id' => $club->id,
                'name' => $club->name,
                'slug' => $club->slug,
                'description' => $club->description,
                'accent_color' => $club->accent_color,
                'sticker_type' => $club->sticker_type,
                'cover_image_url' => $club->cover_image_url,
                'is_member' => $isMember,
            ],
        ]);
    }

    public function timeline(Request $request, Club $club): JsonResponse
    {
        $posts = Post::query()
            ->where('club_id', $club->id)
            ->with([
                'user:id,name,email',
                'club:id,name,slug,accent_color,sticker_type',
            ])
            ->withCount([
                'comments',
                'lfgApplications',
            ])
            ->latest()
            ->paginate(20);

        return response()->json($posts);
    }

    public function join(Request $request, Club $club): JsonResponse
    {
        $user = $request->user();

        $user->clubs()->syncWithoutDetaching([$club->id]);

        return response()->json([
            'message' => 'Joined club.',
        ], 201);
    }

    public function leave(Request $request, Club $club): JsonResponse
    {
        $user = $request->user();

        $user->clubs()->detach($club->id);

        return response()->json([
            'message' => 'Left club.',
        ]);
    }
}
