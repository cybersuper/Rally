<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('club_user', 'nickname')) {
            Schema::table('club_user', function (Blueprint $table) {
                $table->string('nickname')->nullable()->after('role');
            });
        }

        if (Schema::hasColumn('users', 'nickname')) {
            if (DB::getDriverName() === 'pgsql') {
                DB::statement('
                    UPDATE club_user
                    SET nickname = users.nickname
                    FROM users
                    WHERE users.id = club_user.user_id
                      AND users.nickname IS NOT NULL
                ');
            } else {
                DB::statement('
                    UPDATE club_user
                    SET nickname = (
                        SELECT users.nickname
                        FROM users
                        WHERE users.id = club_user.user_id
                    )
                    WHERE EXISTS (
                        SELECT 1
                        FROM users
                        WHERE users.id = club_user.user_id
                          AND users.nickname IS NOT NULL
                    )
                ');
            }

            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('nickname');
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('nickname')->nullable()->after('username');
        });

        Schema::table('club_user', function (Blueprint $table) {
            $table->dropColumn('nickname');
        });
    }
};
