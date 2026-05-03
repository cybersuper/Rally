<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ClubController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'slug' => ['required', 'string', 'max:120', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:clubs,slug'],
            'description' => ['nullable', 'string', 'max:400'],
            'category' => ['nullable', 'string', 'max:80'],
            'visibility' => ['nullable', Rule::in(['public', 'private'])],
            'accent_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'cover_image_url' => ['nullable', 'url', 'max:1000'],
        ]);

        $club = DB::transaction(function () use ($validated, $user) {
            $club = Club::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'description' => $validated['description'] ?? null,
                'category' => $validated['category'] ?? null,
                'visibility' => $validated['visibility'] ?? 'public',
                'accent_color' => $validated['accent_color'],
                'sticker_type' => 'sparkle',
                'cover_image_url' => $validated['cover_image_url'] ?? null,
            ]);

            $user->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);

            return $club;
        });

        return response()->json([
            'club' => $this->serializeClub($club, Club::ROLE_OWNER, 1),
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $clubs = Club::query()
            ->withCount('users')
            ->orderBy('name')
            ->get();

        $memberLookup = [];

        if ($user) {
            $memberLookup = $user->clubs()
                ->pluck('club_user.role', 'clubs.id')
                ->all();
        }

        $data = $clubs->map(function (Club $club) use ($memberLookup) {
            return $this->serializeClub(
                $club,
                $memberLookup[$club->id] ?? null,
                $club->users_count
            );
        });

        return response()->json([
            'clubs' => $data,
        ]);
    }

    public function show(Request $request, Club $club): JsonResponse
    {
        $user = $request->user();

        $club->loadCount('users');
        $role = $this->membershipRole($user, $club);

        return response()->json([
            'club' => $this->serializeClub($club, $role, $club->users_count),
        ]);
    }

    public function update(Request $request, Club $club): JsonResponse
    {
        $role = $this->membershipRole($request->user(), $club);

        abort_unless($this->canManageClub($role), 403, 'Not allowed.');

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:400'],
            'category' => ['nullable', 'string', 'max:80'],
            'visibility' => ['required', Rule::in(['public', 'private'])],
            'accent_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'cover_image_url' => ['nullable', 'url', 'max:1000'],
        ]);

        $club->fill([
            'name' => $validated['name'] ?? $club->name,
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'] ?? null,
            'visibility' => $validated['visibility'],
            'accent_color' => $validated['accent_color'],
            'cover_image_url' => $validated['cover_image_url'] ?? null,
        ]);

        $club->save();
        $club->loadCount('users');

        return response()->json([
            'club' => $this->serializeClub($club, $role, $club->users_count),
        ]);
    }

    public function timeline(Request $request, Club $club): JsonResponse
    {
        abort_unless(
            $this->membershipRole($request->user(), $club) !== null,
            403,
            'You must join this club to view its timeline.'
        );

        $posts = Post::query()
            ->where('club_id', $club->id)
            ->with([
                'user:id,name,email',
                'club:id,name,slug,accent_color,sticker_type',
            ])
            ->withCount([
                'comments',
                'likes',
                'lfgApplications',
            ])
            ->withExists([
                'likes as liked_by_me' => fn ($query) => $query->where('user_id', $request->user()->id),
            ])
            ->latest()
            ->paginate(20);

        return response()->json($posts);
    }

    public function join(Request $request, Club $club): JsonResponse
    {
        $user = $request->user();

        $role = $this->membershipRole($user, $club);
        $attached = false;

        if (! $role) {
            $user->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);
            $role = Club::ROLE_MEMBER;
            $attached = true;
        }

        return response()->json([
            'message' => 'Joined club.',
            'membership_role' => $role,
        ], $attached ? 201 : 200);
    }

    public function leave(Request $request, Club $club): JsonResponse
    {
        $user = $request->user();
        $role = $this->membershipRole($user, $club);

        abort_if(
            $role === Club::ROLE_OWNER,
            422,
            'Club owners cannot leave until ownership transfer is available.'
        );

        $user->clubs()->detach($club->id);

        return response()->json([
            'message' => 'Left club.',
        ]);
    }

    private function membershipRole($user, Club $club): ?string
    {
        return $user->clubs()
            ->where('clubs.id', $club->id)
            ->value('club_user.role');
    }

    private function canManageClub(?string $role): bool
    {
        return in_array($role, [
            Club::ROLE_OWNER,
            Club::ROLE_ADMIN,
            Club::ROLE_MODERATOR,
        ], true);
    }

    private function serializeClub(Club $club, ?string $role = null, ?int $membersCount = null): array
    {
        return [
            'id' => $club->id,
            'name' => $club->name,
            'slug' => $club->slug,
            'description' => $club->description,
            'category' => $club->category,
            'visibility' => $club->visibility ?? 'public',
            'accent_color' => $club->accent_color,
            'sticker_type' => $club->sticker_type,
            'cover_image_url' => $club->cover_image_url,
            'members_count' => $membersCount,
            'is_member' => $role !== null,
            'membership_role' => $role,
        ];
    }
}
