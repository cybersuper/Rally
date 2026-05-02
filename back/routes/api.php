<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\TimelineController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\LfgApplicationController;
use App\Http\Controllers\Api\CommentController;
use Illuminate\Support\Facades\Route;

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::get('/timeline', [TimelineController::class, 'index']);
    Route::post('/posts', [PostController::class, 'store']);

    Route::post('/posts/{post}/lfg-applications', [LfgApplicationController::class, 'store']);

    Route::get('/posts/{post}/comments', [CommentController::class, 'index']);
    Route::post('/posts/{post}/comments', [CommentController::class, 'store']);
});