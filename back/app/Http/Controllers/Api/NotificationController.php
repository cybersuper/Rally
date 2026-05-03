<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RallyNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $this->queryForUser($request)
            ->latest()
            ->limit(50)
            ->get();

        return response()->json([
            'notifications' => $notifications->map(fn (RallyNotification $notification) => $this->serialize($notification)),
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json([
            'unread_count' => $this->queryForUser($request)
                ->whereNull('read_at')
                ->count(),
        ]);
    }

    public function markRead(Request $request, RallyNotification $notification): JsonResponse
    {
        abort_unless(
            $notification->notifiable_type === User::class
                && (int) $notification->notifiable_id === (int) $request->user()->id,
            403,
            'Not allowed.'
        );

        if (! $notification->read_at) {
            $notification->read_at = now();
            $notification->save();
        }

        return response()->json([
            'notification' => $this->serialize($notification),
        ]);
    }

    private function queryForUser(Request $request)
    {
        return RallyNotification::query()
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $request->user()->id);
    }

    private function serialize(RallyNotification $notification): array
    {
        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'data' => $notification->data,
            'read_at' => $notification->read_at,
            'created_at' => $notification->created_at,
        ];
    }
}
