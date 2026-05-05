<?php

namespace App\Console\Commands;

use App\Models\Club;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillClubOwners extends Command
{
    protected $signature = 'rally:backfill-club-owners {--user= : User ID to assign as owner when a club has none} {--dry-run : Show what would change without writing}';

    protected $description = 'Ensure every club has at least one OWNER membership (club_user.role = OWNER).';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $fallbackUserId = $this->option('user') ? (int) $this->option('user') : null;

        $clubsMissingOwners = Club::query()
            ->whereDoesntHave('users', fn ($q) => $q->wherePivot('role', Club::ROLE_OWNER))
            ->get(['id', 'name', 'slug']);

        if ($clubsMissingOwners->isEmpty()) {
            $this->info('All clubs already have an OWNER.');
            return self::SUCCESS;
        }

        $this->warn("Found {$clubsMissingOwners->count()} club(s) without an OWNER.");

        foreach ($clubsMissingOwners as $club) {
            $ownerId = $fallbackUserId;

            if (! $ownerId) {
                $ownerId = DB::table('club_user')
                    ->where('club_id', $club->id)
                    ->orderBy('created_at')
                    ->value('user_id');
            }

            if (! $ownerId) {
                $ownerId = User::query()->orderBy('id')->value('id');
            }

            if (! $ownerId) {
                $this->error("No users exist to assign as owner for club {$club->id} ({$club->slug}).");
                continue;
            }

            $this->line("Club {$club->id} ({$club->slug}) -> OWNER user_id={$ownerId}" . ($dryRun ? ' (dry-run)' : ''));

            if (! $dryRun) {
                DB::table('club_user')->updateOrInsert(
                    ['club_id' => $club->id, 'user_id' => $ownerId],
                    ['role' => Club::ROLE_OWNER, 'updated_at' => now(), 'created_at' => now()]
                );
            }
        }

        $this->info('Done.');

        return self::SUCCESS;
    }
}
