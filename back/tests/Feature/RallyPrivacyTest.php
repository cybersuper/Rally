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
