<?php

use App\Events\NotificationSent;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TimelineController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\ClubChannelController;
use App\Http\Controllers\Api\LfgApplicationController;
use App\Http\Controllers\Api\LikeController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\CommentLikeController;
use App\Http\Controllers\Api\ClubController;
use App\Http\Controllers\Api\NotificationController;
use App\Models\RallyNotification;
use App\Models\User;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get('/clubs', [ClubController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::get('/test-broadcast', function () {
        $user = request()->user();

        $notification = RallyNotification::create([
            'type' => 'comment',
            'notifiable_type' => User::class,
            'notifiable_id' => $user->id,
            'data' => [
                'post_title' => 'Realtime test',
                'actor_id' => $user->id,
                'actor_name' => 'Rally System',
            ],
        ]);

        NotificationSent::dispatch($notification);

        return response()->json([
            'message' => 'Broadcast sent.',
            'notification' => $notification,
        ]);
    });

    Route::post('/clubs', [ClubController::class, 'store']);
    Route::get('/profiles/{username}', [ProfileController::class, 'show']);
    Route::patch('/profiles/me', [ProfileController::class, 'update']);
    Route::post('/profiles/me', [ProfileController::class, 'update']);
    Route::get('/profiles/{username}/posts', [ProfileController::class, 'posts']);
    Route::patch('/settings/account', [SettingsController::class, 'updateAccount']);
    Route::patch('/settings/password', [SettingsController::class, 'updatePassword']);
    Route::patch('/settings/privacy', [SettingsController::class, 'updatePrivacy']);
    Route::delete('/settings/account', [SettingsController::class, 'deactivate']);
    Route::get('/conversations', [ConversationController::class, 'index']);
    Route::get('/chat-users', [ConversationController::class, 'users']);
    Route::get('/messages/search', [ConversationController::class, 'search']);
    Route::post('/conversations', [ConversationController::class, 'start']);
    Route::get('/conversations/{conversation}', [ConversationController::class, 'show']);
    Route::patch('/conversations/{conversation}', [ConversationController::class, 'update']);
    Route::post('/conversations/{conversation}/messages', [ConversationController::class, 'store']);
    Route::post('/conversations/{conversation}/read', [ConversationController::class, 'markRead']);
    Route::patch('/conversations/{conversation}/meeting', [ConversationController::class, 'planMeeting']);
    Route::post('/posts/{post}/party-conversation', [ConversationController::class, 'createParty']);
    Route::get('/clubs/{club:slug}', [ClubController::class, 'show']);
    Route::patch('/clubs/{club:slug}', [ClubController::class, 'update']);
    Route::post('/clubs/{club:slug}', [ClubController::class, 'update']);
    Route::patch('/clubs/{club:slug}/identity', [ClubController::class, 'updateIdentity']);
    Route::get('/clubs/{club:slug}/channels', [ClubChannelController::class, 'index']);
    Route::post('/clubs/{club:slug}/channels', [ClubChannelController::class, 'store']);
    Route::post('/clubs/{club:slug}/rooms', [ClubChannelController::class, 'storeRoom']);
    Route::post('/lounges/{lounge}/read', [ClubChannelController::class, 'markRead']);
    Route::get('/clubs/{club:slug}/channels/{channel}/messages', [ClubChannelController::class, 'messages']);
    Route::post('/clubs/{club:slug}/channels/{channel}/messages', [ClubChannelController::class, 'send']);
    Route::put('/messages/{message}/pin', [ClubChannelController::class, 'pin']);
    Route::patch('/messages/{message}', [ClubChannelController::class, 'updateMessage']);
    Route::delete('/messages/{message}', [ClubChannelController::class, 'deleteMessage']);
    Route::get('/clubs/{club:slug}/timeline', [ClubController::class, 'timeline']);
    Route::post('/clubs/{club}/join', [ClubController::class, 'join']);
    Route::delete('/clubs/{club}/leave', [ClubController::class, 'leave']);

    Route::get('/timeline', [TimelineController::class, 'index']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::get('/posts/{post}', [PostController::class, 'show']);
    Route::delete('/posts/{post}', [PostController::class, 'destroy']);
    Route::post('/posts/{post}/likes', [LikeController::class, 'store']);
    Route::delete('/posts/{post}/likes', [LikeController::class, 'destroy']);
    Route::get('/me/lfg-posts', [LfgApplicationController::class, 'ownedPosts']);

    Route::post('/posts/{post}/lfg-applications', [LfgApplicationController::class, 'store']);
    Route::get('/posts/{post}/lfg-applications', [LfgApplicationController::class, 'index']);
    Route::patch('/lfg-applications/{application}', [LfgApplicationController::class, 'update']);

    Route::get('/posts/{post}/comments', [CommentController::class, 'index']);
    Route::post('/posts/{post}/comments', [CommentController::class, 'store']);
    Route::patch('/comments/{comment}', [CommentController::class, 'update']);
    Route::patch('/comments/{comment}/helpful', [CommentController::class, 'helpful']);
    Route::delete('/comments/{comment}', [CommentController::class, 'destroy']);
    Route::post('/comments/{comment}/likes', [CommentLikeController::class, 'store']);
    Route::delete('/comments/{comment}/likes', [CommentLikeController::class, 'destroy']);
});
