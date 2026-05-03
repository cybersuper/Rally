<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('notifiable_type')->nullable()->after('type');
            $table->unsignedBigInteger('notifiable_id')->nullable()->after('notifiable_type');
            $table->index(['notifiable_type', 'notifiable_id', 'read_at'], 'notifications_notifiable_read_index');
        });

        DB::table('notifications')->update([
            'notifiable_type' => 'App\\Models\\User',
            'notifiable_id' => DB::raw('user_id'),
        ]);

        Schema::table('notifications', function (Blueprint $table) {
            $table->string('notifiable_type')->nullable(false)->change();
            $table->unsignedBigInteger('notifiable_id')->nullable(false)->change();
            $table->dropIndex(['user_id', 'read_at']);
            $table->dropIndex(['user_id', 'created_at']);
            $table->dropConstrainedForeignId('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('user_id')
                ->nullable()
                ->after('id')
                ->constrained()
                ->cascadeOnDelete();
        });

        DB::table('notifications')->update([
            'user_id' => DB::raw('notifiable_id'),
        ]);

        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable(false)->change();
            $table->index(['user_id', 'read_at']);
            $table->index(['user_id', 'created_at']);
            $table->dropIndex('notifications_notifiable_read_index');
            $table->dropColumn(['notifiable_type', 'notifiable_id']);
        });
    }
};
