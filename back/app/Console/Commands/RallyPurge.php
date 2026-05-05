<?php

namespace App\Console\Commands;

use App\Models\Club;
use App\Models\Comment;
use App\Models\Conversation;
use App\Models\LfgApplication;
use App\Models\Message;
use App\Models\Post;
use App\Models\RallyNotification;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RallyPurge extends Command
{
    protected $signature = 'rally:purge {--keep-email= : Email of the user to keep (admin).} {--yes : Skip confirmation prompt.}';

    protected $description = 'Purge demo data (clubs/posts/comments/messages/etc) while keeping a chosen admin user.';

    public function handle(): int
    {
        $keepEmail = (string) ($this->option('keep-email') ?? '');
        $skipConfirm = (bool) $this->option('yes');

        $keepUser = null;

        if ($keepEmail !== '') {
            $keepUser = User::query()->where('email', $keepEmail)->first();

            if (!$keepUser) {
                $this->error("No user found with email: {$keepEmail}");
                return self::FAILURE;
            }
        }

        if (!$skipConfirm) {
            $label = $keepUser ? "Keeping user {$keepUser->email} (id={$keepUser->id})." : 'No user will be kept.';
            $this->warn('This will delete demo data from your database.');
            $this->line($label);

            if (!$this->confirm('Continue?')) {
                return self::SUCCESS;
            }
        }

        DB::transaction(function () use ($keepUser) {
            $keepUserId = $keepUser?->id;

            if ($keepUserId) {
                DB::table('club_user')->where('user_id', '!=', $keepUserId)->delete();
                DB::table('club_user')->where('user_id', $keepUserId)->update(['role' => Club::ROLE_OWNER]);
            } else {
                DB::table('club_user')->delete();
            }

            DB::table('comment_likes')->delete();
            DB::table('likes')->delete();
            DB::table('lounge_user_reads')->delete();

            Message::query()->forceDelete();
            Conversation::query()->delete();

            LfgApplication::query()->delete();
            Comment::query()->delete();
            Post::query()->delete();

            DB::table('club_channels')->delete();
            Club::query()->delete();

            RallyNotification::query()->delete();

            if ($keepUserId) {
                User::withTrashed()->where('id', '!=', $keepUserId)->forceDelete();
            } else {
                User::withTrashed()->forceDelete();
            }
        });

        $this->info('Rally demo data purged.');

        return self::SUCCESS;
    }
}
