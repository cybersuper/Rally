<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('private_profile')->default(false)->after('longest_streak');
            $table->softDeletes();
        });

        Schema::table('club_user', function (Blueprint $table) {
            $table->boolean('show_streak')->default(true)->after('nickname');
        });
    }

    public function down(): void
    {
        Schema::table('club_user', function (Blueprint $table) {
            $table->dropColumn('show_streak');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('private_profile');
            $table->dropSoftDeletes();
        });
    }
};
