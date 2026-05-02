<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('club_user', function (Blueprint $table) {
            $table->string('role')->default('MEMBER');
            $table->index(['club_id', 'role']);
        });
    }

    public function down(): void
    {
        Schema::table('club_user', function (Blueprint $table) {
            $table->dropIndex(['club_id', 'role']);
            $table->dropColumn('role');
        });
    }
};
