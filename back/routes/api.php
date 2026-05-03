<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TimelineController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\LfgApplicationController;
use App\Http\Controllers\Api\LikeController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\CommentLikeController;
use App\Http\Controllers\Api\ClubController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);

Route::get('/clubs', [ClubController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/clubs', [ClubController::class, 'store']);
    Route::get('/clubs/{club:slug}', [ClubController::class, 'show']);
    Route::patch('/clubs/{club:slug}', [ClubController::class, 'update']);
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
    Route::delete('/comments/{comment}', [CommentController::class, 'destroy']);
    Route::post('/comments/{comment}/likes', [CommentLikeController::class, 'store']);
    Route::delete('/comments/{comment}/likes', [CommentLikeController::class, 'destroy']);
});
