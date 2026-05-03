<?php

namespace Tests\Feature;

use App\Models\Club;
use App\Models\LfgApplication;
use App\Models\Post;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RallyPrivacyTest extends TestCase
{
    use RefreshDatabase;

    public function test_club_creation_assigns_the_creator_as_owner(): void
    {
        $user = User::factory()->create();

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/clubs', [
            'name' => 'Miniature Painters',
            'slug' => 'miniature-painters',
            'description' => 'Tiny brushes, big patience.',
            'accent_color' => '#ef4444',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('club.slug', 'miniature-painters')
            ->assertJsonPath('club.membership_role', Club::ROLE_OWNER);

        $this->assertDatabaseHas('club_user', [
            'user_id' => $user->id,
            'role' => Club::ROLE_OWNER,
        ]);
    }

    public function test_club_join_does_not_downgrade_existing_owner_role(): void
    {
        $user = User::factory()->create();
        $club = $this->club();

        $user->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);

        Sanctum::actingAs($user);

        $this->postJson("/api/clubs/{$club->id}/join")
            ->assertOk()
            ->assertJsonPath('membership_role', Club::ROLE_OWNER);

        $this->assertDatabaseHas('club_user', [
            'club_id' => $club->id,
            'user_id' => $user->id,
            'role' => Club::ROLE_OWNER,
        ]);
    }

    public function test_only_club_managers_can_update_admin_fields(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $member->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);

        Sanctum::actingAs($member);

        $this->patchJson("/api/clubs/{$club->slug}", [
            'description' => 'Members should not be able to rewrite this.',
            'category' => 'Strategy',
            'visibility' => 'private',
            'accent_color' => '#ef4444',
        ])->assertForbidden();

        Sanctum::actingAs($owner);

        $this->patchJson("/api/clubs/{$club->slug}", [
            'description' => 'Campaign scheduling and table talk.',
            'category' => 'Tabletop',
            'visibility' => 'private',
            'accent_color' => '#ef4444',
        ])
            ->assertOk()
            ->assertJsonPath('club.category', 'Tabletop')
            ->assertJsonPath('club.visibility', 'private')
            ->assertJsonPath('club.accent_color', '#ef4444');
    }

    public function test_only_the_lfg_post_author_can_read_private_application_answers(): void
    {
        $owner = User::factory()->create();
        $moderator = User::factory()->create();
        $applicant = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $moderator->clubs()->attach($club->id, ['role' => Club::ROLE_MODERATOR]);
        $applicant->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);

        $post = $this->lfgPost($owner, $club);

        LfgApplication::create([
            'post_id' => $post->id,
            'user_id' => $applicant->id,
            'status' => 'pending',
            'answers' => ['message' => 'private character idea'],
        ]);

        Sanctum::actingAs($moderator);

        $this->getJson("/api/posts/{$post->id}/lfg-applications")
            ->assertForbidden();

        Sanctum::actingAs($owner);

        $this->getJson("/api/posts/{$post->id}/lfg-applications")
            ->assertOk()
            ->assertJsonPath('applications.0.answers.message', 'private character idea');
    }

    public function test_accepting_and_declining_lfg_applications_updates_remaining_spots(): void
    {
        $owner = User::factory()->create();
        $applicant = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $applicant->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);

        $post = $this->lfgPost($owner, $club, ['spots_total' => 2], 0);
        $application = LfgApplication::create([
            'post_id' => $post->id,
            'user_id' => $applicant->id,
            'status' => 'pending',
            'answers' => ['message' => 'ready'],
        ]);

        Sanctum::actingAs($owner);

        $this->patchJson("/api/lfg-applications/{$application->id}", [
            'status' => 'accepted',
        ])
            ->assertOk()
            ->assertJsonPath('application.status', 'accepted')
            ->assertJsonPath('post.metadata.spots_filled', 1)
            ->assertJsonPath('post.metadata.spots_remaining', 1);

        $this->patchJson("/api/lfg-applications/{$application->id}", [
            'status' => 'rejected',
        ])
            ->assertOk()
            ->assertJsonPath('application.status', 'rejected')
            ->assertJsonPath('post.metadata.spots_filled', 0)
            ->assertJsonPath('post.metadata.spots_remaining', 2);
    }

    public function test_lfg_application_fields_are_saved_and_answers_use_question_ids(): void
    {
        $owner = User::factory()->create();
        $applicant = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $applicant->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);

        Sanctum::actingAs($owner);

        $postId = $this->postJson('/api/posts', [
            'club_id' => $club->id,
            'title' => 'Ranked stack',
            'content' => 'Looking for a calm ranked squad.',
            'type' => 'lfg',
            'metadata' => [
                'spots_total' => 3,
                'application_fields' => [
                    [
                        'id' => 'rank',
                        'label' => 'What is your rank?',
                        'type' => 'select',
                        'required' => true,
                        'options' => ['Gold', 'Platinum', 'Diamond'],
                    ],
                    [
                        'id' => 'mic',
                        'label' => 'Do you have a mic?',
                        'type' => 'boolean',
                    ],
                ],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('post.metadata.application_fields.0.key', 'rank')
            ->assertJsonPath('post.metadata.form_fields_count', 2)
            ->json('post.id');

        Sanctum::actingAs($applicant);

        $this->postJson("/api/posts/{$postId}/lfg-applications", [
            'answers' => [
                'rank' => 'Platinum',
                'mic' => true,
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('application.answers.rank', 'Platinum')
            ->assertJsonPath('application.answers.mic', true);
    }

    public function test_only_club_members_can_comment_and_like_posts(): void
    {
        $owner = User::factory()->create();
        $outsider = User::factory()->create();
        $club = $this->club();
        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $post = $this->lfgPost($owner, $club);

        Sanctum::actingAs($outsider);

        $this->getJson("/api/posts/{$post->id}/comments")->assertForbidden();
        $this->postJson("/api/posts/{$post->id}/comments", [
            'content' => 'I should not see this.',
        ])->assertForbidden();
        $this->postJson("/api/posts/{$post->id}/likes")->assertForbidden();

        Sanctum::actingAs($owner);

        $this->postJson("/api/posts/{$post->id}/comments", [
            'content' => 'Welcome in.',
        ])->assertCreated();

        $this->postJson("/api/posts/{$post->id}/likes")
            ->assertOk()
            ->assertJsonPath('liked', true)
            ->assertJsonPath('likes_count', 1);

        $this->getJson('/api/timeline')
            ->assertOk()
            ->assertJsonPath('data.0.likes_count', 1)
            ->assertJsonPath('data.0.liked_by_me', true)
            ->assertJsonPath('data.0.total_comments_count', 1)
            ->assertJsonPath('data.0.top_level_comments_count', 1);

        $this->deleteJson("/api/posts/{$post->id}/likes")
            ->assertOk()
            ->assertJsonPath('liked', false)
            ->assertJsonPath('likes_count', 0);
    }

    public function test_post_authors_and_club_moderators_can_delete_content(): void
    {
        $owner = User::factory()->create();
        $moderator = User::factory()->create();
        $member = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $moderator->clubs()->attach($club->id, ['role' => Club::ROLE_MODERATOR]);
        $member->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);

        $post = $this->lfgPost($owner, $club);
        $comment = $post->comments()->create([
            'user_id' => $member->id,
            'content' => 'Needs moderation.',
        ]);

        Sanctum::actingAs($moderator);

        $this->deleteJson("/api/comments/{$comment->id}")->assertOk();
        $this->assertDatabaseMissing('comments', ['id' => $comment->id]);

        $this->deleteJson("/api/posts/{$post->id}")->assertOk();
        $this->assertDatabaseMissing('posts', ['id' => $post->id]);
    }

    public function test_regular_members_cannot_delete_other_people_content(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $member->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);

        $post = $this->lfgPost($owner, $club);
        $comment = $post->comments()->create([
            'user_id' => $owner->id,
            'content' => 'Keep this.',
        ]);

        Sanctum::actingAs($member);

        $this->deleteJson("/api/comments/{$comment->id}")->assertForbidden();
        $this->deleteJson("/api/posts/{$post->id}")->assertForbidden();
    }

    public function test_post_detail_requires_club_membership(): void
    {
        $owner = User::factory()->create();
        $outsider = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $post = $this->lfgPost($owner, $club);

        Sanctum::actingAs($outsider);

        $this->getJson("/api/posts/{$post->id}")->assertForbidden();

        Sanctum::actingAs($owner);

        $this->getJson("/api/posts/{$post->id}")
            ->assertOk()
            ->assertJsonPath('post.id', $post->id);
    }

    public function test_comments_can_be_threaded_and_sorted_by_likes(): void
    {
        $owner = User::factory()->create();
        $voter = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $voter->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);
        $post = $this->lfgPost($owner, $club);

        $first = $post->comments()->create([
            'user_id' => $owner->id,
            'content' => 'First answer.',
        ]);

        $best = $post->comments()->create([
            'user_id' => $owner->id,
            'content' => 'Best answer.',
        ]);

        $reply = $post->comments()->create([
            'user_id' => $voter->id,
            'parent_id' => $best->id,
            'content' => 'Nested reply.',
        ]);

        Sanctum::actingAs($voter);

        $this->postJson("/api/comments/{$best->id}/likes")
            ->assertOk()
            ->assertJsonPath('liked', true)
            ->assertJsonPath('likes_count', 1);

        $this->getJson("/api/posts/{$post->id}/comments")
            ->assertOk()
            ->assertJsonPath('comments.0.id', $best->id)
            ->assertJsonPath('comments.0.likes_count', 1)
            ->assertJsonPath('comments.0.replies.0.id', $reply->id)
            ->assertJsonPath('comments.1.id', $first->id);

        $this->getJson("/api/posts/{$post->id}/comments?preview=1")
            ->assertOk()
            ->assertJsonCount(2, 'comments')
            ->assertJsonPath('comments.0.parent_id', null)
            ->assertJsonPath('comments.0.replies', []);
    }

    public function test_notifications_are_created_for_post_likes_and_comment_replies(): void
    {
        $owner = User::factory()->create();
        $actor = User::factory()->create();
        $club = $this->club();

        $owner->clubs()->attach($club->id, ['role' => Club::ROLE_OWNER]);
        $actor->clubs()->attach($club->id, ['role' => Club::ROLE_MEMBER]);
        $post = $this->lfgPost($owner, $club);
        $comment = $post->comments()->create([
            'user_id' => $owner->id,
            'content' => 'Original comment.',
        ]);

        Sanctum::actingAs($actor);

        $this->postJson("/api/posts/{$post->id}/likes")->assertOk();
        $this->postJson("/api/posts/{$post->id}/comments", [
            'content' => 'Replying in-thread.',
            'parent_id' => $comment->id,
        ])->assertCreated();

        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $owner->id,
            'type' => 'like',
        ]);

        $this->assertDatabaseHas('notifications', [
            'notifiable_type' => User::class,
            'notifiable_id' => $owner->id,
            'type' => 'comment',
        ]);

        Sanctum::actingAs($owner);

        $this->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 2);

        $notificationId = $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonCount(2, 'notifications')
            ->json('notifications.0.id');

        $this->patchJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('notification.read_at', fn ($value) => $value !== null);

        $this->getJson('/api/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);
    }

    private function club(): Club
    {
        return Club::create([
            'name' => 'DnD Table',
            'slug' => 'dnd-table-'.fake()->unique()->numberBetween(1000, 9999),
            'description' => 'One-shots and campaigns.',
            'accent_color' => '#facc15',
            'sticker_type' => 'd20',
        ]);
    }

    private function lfgPost(User $owner, Club $club, array $metadata = [], int $filled = 0): Post
    {
        return Post::create([
            'user_id' => $owner->id,
            'club_id' => $club->id,
            'title' => 'Moonlit Heist',
            'content' => 'Level 4 mystery.',
            'type' => 'lfg',
            'metadata' => Post::normalizeLfgMetadata($metadata, $filled),
        ]);
    }
}
