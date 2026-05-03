<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('club_channels', function (Blueprint $table) {
            $table->string('category')->default('Text Lounges')->after('type');
            $table->index(['club_id', 'category']);
        });
    }

    public function down(): void
    {
        Schema::table('club_channels', function (Blueprint $table) {
            $table->dropIndex(['club_id', 'category']);
            $table->dropColumn('category');
        });
    }
};
