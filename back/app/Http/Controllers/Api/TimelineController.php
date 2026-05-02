<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimelineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $clubIds = $user->clubs()->pluck('clubs.id');

        $posts = Post::query()
            ->whereIn('club_id', $clubIds)
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
}