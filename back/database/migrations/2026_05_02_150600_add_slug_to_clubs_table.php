<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clubs', function (Blueprint $table) {
            $table->string('slug')->nullable()->after('name');
        });

        $clubs = DB::table('clubs')->select('id', 'name')->orderBy('id')->get();

        foreach ($clubs as $club) {
            $base = Str::slug($club->name);
            $slug = $base;
            $i = 2;

            while (DB::table('clubs')->where('slug', $slug)->where('id', '!=', $club->id)->exists()) {
                $slug = $base.'-'.$i;
                $i++;
            }

            DB::table('clubs')->where('id', $club->id)->update(['slug' => $slug]);
        }

        Schema::table('clubs', function (Blueprint $table) {
            $table->string('slug')->nullable(false)->change();
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::table('clubs', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
