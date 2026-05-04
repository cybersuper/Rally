<?php

namespace App\Console\Commands;

use App\Events\NotificationSent;
use App\Models\Conversation;
use App\Models\RallyNotification;
use App\Models\User;
use Illuminate\Console\Command;

class SendPartyMeetingReminders extends Command
{
    protected $signature = 'party:meeting-reminders';

    protected $description = 'Broadcast Party meeting reminders due within 15 minutes.';

    public function handle(): int
    {
        $conversations = Conversation::query()
            ->with('users:id,name')
            ->whereNotNull('next_meeting_at')
            ->whereNull('meeting_reminder_sent_at')
            ->whereBetween('next_meeting_at', [now(), now()->addMinutes(15)])
            ->get();

        foreach ($conversations as $conversation) {
            foreach ($conversation->users as $user) {
                $notification = RallyNotification::create([
                    'type' => 'party_meeting',
                    'notifiable_type' => User::class,
                    'notifiable_id' => $user->id,
                    'data' => [
                        'conversation_id' => $conversation->id,
                        'post_title' => $conversation->title,
                        'meeting_label' => $conversation->meeting_label,
                        'next_meeting_at' => $conversation->next_meeting_at?->toIso8601String(),
                        'actor_name' => 'Rally',
                    ],
                ]);

                NotificationSent::dispatch($notification);
            }

            $conversation->forceFill(['meeting_reminder_sent_at' => now()])->save();
        }

        $this->info("Sent reminders for {$conversations->count()} parties.");

        return self::SUCCESS;
    }
}
