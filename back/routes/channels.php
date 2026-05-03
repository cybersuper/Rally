<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('users.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('user.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('conversations.{id}', function ($user, $id) {
    return $user->conversations()->whereKey((int) $id)->exists();
});

Broadcast::channel('club.{id}', function ($user, $id) {
    if (! $user->clubs()->where('clubs.id', $id)->exists()) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
        'username' => $user->username,
        'profile_photo_path' => $user->profile_photo_path,
    ];
});

Broadcast::channel('clubs.{clubId}.rooms.{roomId}', function ($user, $clubId, $roomId) {
    $isMember = $user->clubs()->where('clubs.id', $clubId)->exists();

    if (! $isMember) {
        return false;
    }

    $roomBelongsToClub = \App\Models\ClubChannel::query()
        ->whereKey((int) $roomId)
        ->where('club_id', (int) $clubId)
        ->exists();

    if (! $roomBelongsToClub) {
        return false;
    }

    return [
        'id' => $user->id,
        'name' => $user->name,
        'username' => $user->username,
        'profile_photo_path' => $user->profile_photo_path,
    ];
});
