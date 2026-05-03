<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable()->unique()->after('name');
            $table->string('nickname')->nullable()->after('username');
            $table->text('bio')->nullable()->after('email');
            $table->string('profile_photo_path')->nullable()->after('bio');
            $table->string('cover_photo_path')->nullable()->after('profile_photo_path');
            $table->unsignedInteger('current_streak')->default(0)->after('cover_photo_path');
            $table->unsignedInteger('longest_streak')->default(0)->after('current_streak');
        });

        DB::table('users')
            ->select(['id', 'name', 'email'])
            ->orderBy('id')
            ->each(function ($user) {
                $base = Str::slug(Str::before((string) $user->email, '@') ?: (string) $user->name) ?: 'rally';

                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['username' => "{$base}{$user->id}"]);
            });

        Schema::table('users', function (Blueprint $table) {
            $table->string('username')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'username',
                'nickname',
                'bio',
                'profile_photo_path',
                'cover_photo_path',
                'current_streak',
                'longest_streak',
            ]);
        });
    }
};
