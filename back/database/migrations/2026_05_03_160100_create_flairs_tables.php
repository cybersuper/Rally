<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flairs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('color', 7)->default('#ff4444');
            $table->foreignId('club_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['club_id', 'name']);
        });

        Schema::create('flair_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flair_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['flair_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flair_user');
        Schema::dropIfExists('flairs');
    }
};
