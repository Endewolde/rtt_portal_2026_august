<?php

namespace App\Support;

use App\Models\ConferenceAbstract;
use App\Models\ConferenceCommitteeMember;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Who may do what for one conference. The conferences.manage permission covers every
 * conference; a committee role covers only its own:
 *
 *  - chair:       everything for that conference — abstracts and decisions, attendance,
 *                 certificates, feedback, its committee and history
 *  - track_chair: the abstracts of one track — read them and their reviews, assign and
 *                 remove reviewers; the decision stays with the chairs
 *  - checkin:     the registration desk
 */
class ConferenceAccess
{
    public static function isOrganiser(?User $user): bool
    {
        return (bool) $user?->can('conferences.manage');
    }

    /** Chair-level control of one conference. */
    public static function manages(?User $user, ?string $conferenceId): bool
    {
        return self::isOrganiser($user) || ($conferenceId && self::roles($user)->contains(
            fn ($m) => $m->conference_id === $conferenceId && $m->role === 'chair'
        ));
    }

    public static function checksIn(?User $user, ?string $conferenceId): bool
    {
        return self::manages($user, $conferenceId) || ($conferenceId && self::roles($user)->contains(
            fn ($m) => $m->conference_id === $conferenceId && $m->role === 'checkin'
        ));
    }

    /** May read this abstract and choose its reviewers. */
    public static function handlesAbstract(?User $user, ConferenceAbstract $abstract): bool
    {
        return self::manages($user, $abstract->conference_id) || ($abstract->track_id && self::roles($user)->contains(
            fn ($m) => $m->role === 'track_chair' && $m->conference_id === $abstract->conference_id && $m->track_id === $abstract->track_id
        ));
    }

    /** Whether the user can open the committee pages at all. */
    public static function handlesAnyAbstracts(?User $user): bool
    {
        return self::isOrganiser($user) || self::roles($user)->whereIn('role', ['chair', 'track_chair'])->isNotEmpty();
    }

    /**
     * Narrow an abstracts query to those the user handles. Organisers see everything.
     *
     * @param  Builder<ConferenceAbstract>  $query
     * @return Builder<ConferenceAbstract>
     */
    public static function scopeAbstracts(Builder $query, ?User $user): Builder
    {
        if (self::isOrganiser($user)) {
            return $query;
        }
        $roles = self::roles($user);
        $chaired = $roles->where('role', 'chair')->pluck('conference_id')->all();
        $tracks = $roles->where('role', 'track_chair')->whereNotNull('track_id')->pluck('track_id')->all();

        return $query->where(fn ($q) => $q
            ->whereIn('conference_abstracts.conference_id', $chaired ?: ['-'])
            ->orWhereIn('conference_abstracts.track_id', $tracks ?: ['-']));
    }

    /** Conferences the user has any committee role on. @return list<string> */
    public static function conferenceIds(?User $user): array
    {
        return self::roles($user)->pluck('conference_id')->unique()->values()->all();
    }

    /** @return Collection<int, ConferenceCommitteeMember> */
    public static function roles(?User $user): Collection
    {
        if (! $user) {
            return collect();
        }

        // Loaded once per user instance, i.e. once per request.
        return $user->conferenceRoles;
    }
}
