<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'username' => ['nullable', 'string', 'max:32', 'regex:/^[a-zA-Z0-9_]+$/', 'unique:users,username'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'username' => $validated['username'] ?? $this->uniqueUsername($validated['name'], $validated['email']),
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
        ]);

        $token = $user->createToken('rally-client')->plainTextToken;

        return response()->json([
            'user' => $this->serializeUser($user->load('clubs')),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        $token = $user->createToken('rally-client')->plainTextToken;

        return response()->json([
            'user' => $this->serializeUser($user->load('clubs')),
            'token' => $token,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('clubs');

        return response()->json([
            'user' => $this->serializeUser($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out.',
        ]);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'bio' => $user->bio,
            'profile_photo_path' => $user->profile_photo_path,
            'cover_photo_path' => $user->cover_photo_path,
            'current_streak' => $user->current_streak,
            'longest_streak' => $user->longest_streak,
            'private_profile' => (bool) $user->private_profile,
            'clubs' => $user->clubs->map(fn ($club) => [
                'id' => $club->id,
                'name' => $club->name,
                'slug' => $club->slug,
                'description' => $club->description,
                'category' => $club->category,
                'visibility' => $club->visibility ?? 'public',
                'accent_color' => $club->accent_color,
                'sticker_type' => $club->sticker_type,
                    'cover_image_url' => $club->cover_image_url,
                    'membership_role' => $club->pivot->role,
                    'nickname' => $club->pivot->nickname,
                ]),
        ];
    }

    private function uniqueUsername(string $name, string $email): string
    {
        $base = Str::of(Str::before($email, '@') ?: $name)
            ->slug('')
            ->lower()
            ->limit(24, '')
            ->value() ?: 'rally';

        $candidate = $base;
        $suffix = 1;

        while (User::where('username', $candidate)->exists()) {
            $candidate = "{$base}{$suffix}";
            $suffix++;
        }

        return $candidate;
    }
}
