<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('type')->default('standard')->after('content');
            $table->jsonb('metadata')->nullable()->after('type');

            $table->index(['type', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndex(['type', 'created_at']);
            $table->dropColumn(['type', 'metadata']);
        });
    }
};