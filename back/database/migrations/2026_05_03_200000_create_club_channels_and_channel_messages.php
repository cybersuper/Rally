<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('club_channels', function (Blueprint $table) {
            $table->id();
            $table->foreignId('club_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type')->default('text');
            $table->timestamps();

            $table->unique(['club_id', 'name']);
            $table->index(['club_id', 'type']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE messages ALTER COLUMN conversation_id DROP NOT NULL');
        }

        Schema::table('messages', function (Blueprint $table) {
            $table->foreignId('channel_id')->nullable()->after('conversation_id')->constrained('club_channels')->nullOnDelete();
            $table->index(['channel_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('channel_id');
        });

        Schema::dropIfExists('club_channels');
    }
};
