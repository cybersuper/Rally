<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        $idType = DB::table('information_schema.columns')
            ->where('table_schema', 'public')
            ->where('table_name', 'notifications')
            ->where('column_name', 'id')
            ->value('data_type');

        if ($idType === 'uuid') {
            return;
        }

        DB::statement('CREATE EXTENSION IF NOT EXISTS pgcrypto');
        DB::statement('ALTER TABLE notifications ALTER COLUMN id DROP DEFAULT');
        DB::statement('ALTER TABLE notifications ALTER COLUMN id TYPE uuid USING gen_random_uuid()');
        DB::statement('ALTER TABLE notifications ALTER COLUMN id SET DEFAULT gen_random_uuid()');
    }

    public function down(): void
    {
        //
    }
};
