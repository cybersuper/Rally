<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Club;
use App\Models\Post;
use App\Support\PostPresenter;
use Cloudinary\Cloudinary;
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
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
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
                'category_id' => $validated['category_id'] ?? null,
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
        $user = auth('sanctum')->user();

        $clubs = Club::query()
            ->with('categoryModel')
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

    public function suggested(Request $request): JsonResponse
    {
        $user = $request->user();

        $joinedClubIds = $user->clubs()->pluck('clubs.id')->all();

        $categoryIds = $user->clubs()
            ->whereNotNull('clubs.category_id')
            ->distinct()
            ->pluck('clubs.category_id')
            ->filter()
            ->values();

        if ($categoryIds->isEmpty()) {
            return response()->json([
                'clubs' => [],
            ]);
        }

        $clubs = Club::query()
            ->with('categoryModel')
            ->withCount('users')
            ->whereIn('category_id', $categoryIds)
            ->when(count($joinedClubIds) > 0, fn ($query) => $query->whereNotIn('id', $joinedClubIds))
            ->orderByDesc('users_count')
            ->orderBy('name')
            ->limit(6)
            ->get();

        $data = $clubs->map(function (Club $club) {
            return $this->serializeClub(
                $club,
                null,
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
        $club->load('categoryModel');
        $club->load(['channels' => fn ($query) => $query->orderBy('category')->orderBy('id')]);
        $role = $this->membershipRole($user, $club);

        return response()->json([
            'club' => $this->serializeClub($club, $role, $club->users_count, $user),
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
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'visibility' => ['required', Rule::in(['public', 'private'])],
            'accent_color' => ['required', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'cover_image_url' => ['nullable', 'url', 'max:1000'],
            'cover_image' => ['nullable', 'image', 'max:8192'],
            'sticker_image' => ['nullable', 'image', 'mimes:png,jpg,jpeg,webp', 'max:4096'],
        ]);

        if ($request->hasFile('cover_image')) {
            $validated['cover_image_url'] = $this->uploadImage($request->file('cover_image'), 'club-covers');
        }

        if ($request->hasFile('sticker_image')) {
            $validated['sticker_image_url'] = $this->uploadImage($request->file('sticker_image'), 'club-stickers');
        }

        $club->fill([
            'name' => $validated['name'] ?? $club->name,
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'] ?? null,
            'category_id' => array_key_exists('category_id', $validated)
                ? $validated['category_id']
                : $club->category_id,
            'visibility' => $validated['visibility'],
            'accent_color' => $validated['accent_color'],
            'cover_image_url' => array_key_exists('cover_image_url', $validated)
                ? $validated['cover_image_url']
                : $club->cover_image_url,
            'sticker_image_url' => array_key_exists('sticker_image_url', $validated)
                ? $validated['sticker_image_url']
                : $club->sticker_image_url,
        ]);

        $club->save();
        $club->loadCount('users');

        return response()->json([
            'club' => $this->serializeClub($club, $role, $club->users_count, $request->user()),
        ]);
    }

    public function updateIdentity(Request $request, Club $club): JsonResponse
    {
        abort_unless($this->membershipRole($request->user(), $club) !== null, 403, 'Join this club first.');

        $validated = $request->validate([
            'nickname' => ['nullable', 'string', 'max:80'],
            'show_streak' => ['required', 'boolean'],
        ]);

        $request->user()->clubs()->updateExistingPivot($club->id, [
            'nickname' => $validated['nickname'] ?: null,
            'show_streak' => $validated['show_streak'],
        ]);

        $club->loadCount('users');

        return response()->json([
            'club' => $this->serializeClub(
                $club,
                $this->membershipRole($request->user(), $club),
                $club->users_count,
                $request->user()
            ),
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
                'likes as liked_by_me' => fn ($query) => $query->where('user_id', $request->user()->id),
            ])
            ->latest()
            ->paginate(20);

        PostPresenter::applyClubNicknames($posts);

        return response()->json($posts);
    }

    public function members(Request $request, Club $club): JsonResponse
    {
        abort_unless(
            $this->membershipRole($request->user(), $club) !== null,
            403,
            'You must join this club to view members.'
        );

        $members = $club->users()
            ->select('users.id', 'users.name', 'users.username', 'users.profile_photo_path')
            ->orderBy('users.name')
            ->get()
            ->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'profile_photo_path' => $user->profile_photo_path,
                'role' => $user->pivot?->role,
            ]);

        return response()->json([
            'members' => $members,
        ]);
    }

    public function join(Request $request, Club $club): JsonResponse
    {
        $user = $request->user();

        $role = $this->membershipRole($user, $club);
        $attached = false;

        if (! $role) {
            $user->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);
            $now = now();
            $reads = $club->channels()->pluck('id')->map(fn ($channelId) => [
                'club_channel_id' => $channelId,
                'user_id' => $user->id,
                'last_read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])->all();

            if ($reads) {
                DB::table('lounge_user_reads')->upsert(
                    $reads,
                    ['club_channel_id', 'user_id'],
                    ['last_read_at', 'updated_at'],
                );
            }

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

    private function serializeClub(Club $club, ?string $role = null, ?int $membersCount = null, $user = null): array
    {
        $identity = null;

        if ($user && $role) {
            $identity = $user->clubs()
                ->where('clubs.id', $club->id)
                ->first()?->pivot;
        }

        return [
            'id' => $club->id,
            'name' => $club->name,
            'slug' => $club->slug,
            'description' => $club->description,
            'category' => $club->category,
            'category_id' => $club->category_id,
            'category_model' => $club->relationLoaded('categoryModel') && $club->categoryModel
                ? [
                    'id' => $club->categoryModel->id,
                    'name' => $club->categoryModel->name,
                    'slug' => $club->categoryModel->slug,
                    'icon_url' => $club->categoryModel->icon_url,
                ]
                : null,
            'visibility' => $club->visibility ?? 'public',
            'accent_color' => $club->accent_color,
            'sticker_type' => $club->sticker_type,
            'cover_image_url' => $club->cover_image_url,
            'sticker_image_url' => $club->sticker_image_url,
            'members_count' => $membersCount,
            'is_member' => $role !== null,
            'membership_role' => $role,
            'my_nickname' => $identity?->nickname,
            'show_streak' => (bool) ($identity?->show_streak ?? true),
            'channels' => $club->relationLoaded('channels')
                ? $club->channels->map(fn ($channel) => [
                    'id' => $channel->id,
                    'club_id' => $channel->club_id,
                    'name' => $channel->name,
                    'type' => $channel->type,
                    'category' => $channel->category ?? 'Text Lounges',
                    'unread_count' => $user ? $this->loungeUnreadCount($channel, $user) : 0,
                ])
                : [],
        ];
    }

    private function loungeUnreadCount($channel, $user): int
    {
        $lastReadAt = DB::table('lounge_user_reads')
            ->where('club_channel_id', $channel->id)
            ->where('user_id', $user->id)
            ->value('last_read_at');

        return $channel->messages()
            ->where('sender_id', '!=', $user->id)
            ->when($lastReadAt, fn ($query) => $query->where('created_at', '>', $lastReadAt))
            ->count();
    }

    private function uploadImage($file, string $folder): string
    {
        abort_unless(
            config('services.cloudinary.url') || config('services.cloudinary.cloud_name'),
            422,
            'Cloudinary is not configured.'
        );

        $cloudinary = config('services.cloudinary.url')
            ? new Cloudinary(config('services.cloudinary.url'))
            : new Cloudinary([
                'cloud' => [
                    'cloud_name' => config('services.cloudinary.cloud_name'),
                    'api_key' => config('services.cloudinary.api_key'),
                    'api_secret' => config('services.cloudinary.api_secret'),
                ],
            ]);

        $result = $cloudinary->uploadApi()->upload($file->getRealPath(), [
            'folder' => "rally/{$folder}",
            'resource_type' => 'image',
        ]);

        return $result['secure_url'];
    }
}
