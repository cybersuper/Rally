<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Models\User;
use App\Support\PostPresenter;
use Cloudinary\Cloudinary;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function show(Request $request, string $username): JsonResponse
    {
        $profile = User::query()
            ->where('username', $username)
            ->with([
                'clubs:id,name,slug,accent_color,sticker_type,sticker_image_url,cover_image_url',
                'flairs.club:id,name,slug',
            ])
            ->firstOrFail();

        $this->abortIfPrivate($profile, $request->user());

        return response()->json([
            'profile' => $this->serializeProfile($profile, $request->user()),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'username' => [
                'required',
                'string',
                'max:32',
                'regex:/^[a-zA-Z0-9_]+$/',
                Rule::unique('users', 'username')->ignore($user->id),
            ],
            'bio' => ['nullable', 'string', 'max:500'],
            'profile_photo' => ['nullable', 'image', 'max:4096'],
            'cover_photo' => ['nullable', 'image', 'max:8192'],
        ]);

        if ($request->hasFile('profile_photo')) {
            $validated['profile_photo_path'] = $this->uploadImage($request->file('profile_photo'), 'profiles', 400, 400);
        }

        if ($request->hasFile('cover_photo')) {
            $validated['cover_photo_path'] = $this->uploadImage($request->file('cover_photo'), 'covers', 1500, 500);
        }

        unset($validated['profile_photo'], $validated['cover_photo']);

        $user->update($validated);

        return response()->json([
            'profile' => $this->serializeProfile($user->fresh()->load([
                'clubs:id,name,slug,accent_color,sticker_type,sticker_image_url,cover_image_url',
                'flairs.club:id,name,slug',
            ]), $user),
        ]);
    }

    public function posts(Request $request, string $username): JsonResponse
    {
        $profile = User::query()
            ->where('username', $username)
            ->firstOrFail();

        $this->abortIfPrivate($profile, $request->user());

        $visibleClubIds = $request->user()->clubs()->pluck('clubs.id');

        $posts = Post::query()
            ->where('user_id', $profile->id)
            ->whereIn('club_id', $visibleClubIds)
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

    private function serializeProfile(User $profile, User $viewer): array
    {
        return [
            'id' => $profile->id,
            'name' => $profile->name,
            'username' => $profile->username,
            'bio' => $profile->bio,
            'profile_photo_path' => $profile->profile_photo_path,
            'cover_photo_path' => $profile->cover_photo_path,
            'current_streak' => $profile->current_streak,
            'longest_streak' => $profile->longest_streak,
            'private_profile' => (bool) $profile->private_profile,
            'is_owner' => $viewer->id === $profile->id,
            'clubs' => $profile->clubs->map(fn ($club) => [
                'id' => $club->id,
                'name' => $club->name,
                'slug' => $club->slug,
                'accent_color' => $club->accent_color,
                'sticker_type' => $club->sticker_type,
                'sticker_image_url' => $club->sticker_image_url,
                'cover_image_url' => $club->cover_image_url,
                'membership_role' => $club->pivot?->role,
                'nickname' => $club->pivot?->nickname,
            ]),
            'flairs' => $profile->flairs->map(fn ($flair) => [
                'id' => $flair->id,
                'name' => $flair->name,
                'color' => $flair->color,
                'club' => $flair->club,
            ]),
        ];
    }

    private function abortIfPrivate(User $profile, User $viewer): void
    {
        if (! $profile->private_profile || $profile->id === $viewer->id) {
            return;
        }

        $viewerClubIds = $viewer->clubs()->pluck('clubs.id');

        abort_unless(
            $profile->clubs()->whereIn('clubs.id', $viewerClubIds)->exists(),
            403,
            'This profile is private.'
        );
    }

    private function uploadImage($file, string $folder, ?int $width = null, ?int $height = null): string
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

        $options = [
            'folder' => "rally/{$folder}",
            'resource_type' => 'image',
        ];

        if ($width && $height) {
            $options['transformation'] = [
                'width' => $width,
                'height' => $height,
                'crop' => 'fill',
                'gravity' => 'auto',
            ];
        }

        $result = $cloudinary->uploadApi()->upload($file->getRealPath(), $options);

        return $result['secure_url'];
    }
}
