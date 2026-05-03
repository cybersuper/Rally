<?php

namespace App\Support;

use Illuminate\Pagination\AbstractPaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PostPresenter
{
    public static function applyClubNicknames(AbstractPaginator|Collection $posts): AbstractPaginator|Collection
    {
        $collection = $posts instanceof AbstractPaginator ? $posts->getCollection() : $posts;

        $pairs = $collection
            ->map(fn ($post) => [$post->club_id, $post->user_id])
            ->unique(fn ($pair) => $pair[0].':'.$pair[1])
            ->values();

        if ($pairs->isEmpty()) {
            return $posts;
        }

        $nicknames = DB::table('club_user')
            ->where(function ($query) use ($pairs) {
                foreach ($pairs as [$clubId, $userId]) {
                    $query->orWhere(fn ($inner) => $inner
                        ->where('club_id', $clubId)
                        ->where('user_id', $userId));
                }
            })
            ->get(['club_id', 'user_id', 'nickname'])
            ->mapWithKeys(fn ($row) => [$row->club_id.':'.$row->user_id => $row->nickname]);

        $collection->each(function ($post) use ($nicknames) {
            if (! $post->relationLoaded('user') || ! $post->user) {
                return;
            }

            $post->user->setAttribute(
                'club_nickname',
                $nicknames->get($post->club_id.':'.$post->user_id)
            );
        });

        return $posts;
    }
}
