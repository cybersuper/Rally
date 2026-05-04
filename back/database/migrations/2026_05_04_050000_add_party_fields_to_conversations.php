<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('conversations', function (Blueprint $table) {
            $table->string('title')->nullable()->after('id');
            $table->string('photo_path')->nullable()->after('title');
            $table->foreignId('party_post_id')->nullable()->after('photo_path')->constrained('posts')->nullOnDelete();
            $table->foreignId('leader_id')->nullable()->after('party_post_id')->constrained('users')->nullOnDelete();
            $table->timestamp('next_meeting_at')->nullable()->after('leader_id');
            $table->string('meeting_label')->nullable()->after('next_meeting_at');
            $table->timestamp('meeting_reminder_sent_at')->nullable()->after('meeting_label');
        });

        Schema::table('conversation_user', function (Blueprint $table) {
            $table->string('member_title')->nullable()->after('user_id');
        });
    }

    public function down(): void
    {
        Schema::table('conversation_user', function (Blueprint $table) {
            $table->dropColumn('member_title');
        });

        Schema::table('conversations', function (Blueprint $table) {
            $table->dropConstrainedForeignId('leader_id');
            $table->dropConstrainedForeignId('party_post_id');
            $table->dropColumn(['title', 'photo_path', 'next_meeting_at', 'meeting_label', 'meeting_reminder_sent_at']);
        });
    }
};
