<?php

namespace App\Support;

use App\Models\Proposal;
use App\Models\ProposalCall;

/**
 * A call's own review route (Calls → Review route), layered over the organisation's
 * standard one. Anything left empty follows Settings → Review Thresholds.
 *
 * Pass marks are RAW points against the evaluation criteria weights, exactly like
 * the standard thresholds — never percentages.
 */
class ReviewRoute
{
    public const THRESHOLD_KEYS = ['blind_threshold', 'defence_threshold', 'combined_threshold'];

    /** @var array{open_defence: bool, blind_reviewers: ?int, defence_reviewers: ?int, blind_threshold: ?float, defence_threshold: ?float, combined_threshold: ?float} */
    public const STANDARD = [
        'open_defence' => true,
        'blind_reviewers' => null,
        'defence_reviewers' => null,
        'blind_threshold' => null,
        'defence_threshold' => null,
        'combined_threshold' => null,
    ];

    /** @return array<string, list<string>> */
    public static function rules(): array
    {
        return [
            'open_defence' => ['required', 'boolean'],
            'blind_reviewers' => ['nullable', 'integer', 'min:1', 'max:10'],
            'defence_reviewers' => ['nullable', 'integer', 'min:1', 'max:15'],
            'blind_threshold' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'defence_threshold' => ['nullable', 'numeric', 'min:0', 'max:1000'],
            'combined_threshold' => ['nullable', 'numeric', 'min:0', 'max:2000'],
        ];
    }

    /**
     * Store only what differs from the standard route; null when nothing does.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>|null
     */
    public static function clean(array $data): ?array
    {
        $route = [
            'open_defence' => (bool) ($data['open_defence'] ?? true),
            'blind_reviewers' => isset($data['blind_reviewers']) ? (int) $data['blind_reviewers'] : null,
            'defence_reviewers' => isset($data['defence_reviewers']) ? (int) $data['defence_reviewers'] : null,
        ];
        foreach (self::THRESHOLD_KEYS as $key) {
            $route[$key] = isset($data[$key]) && $data[$key] !== '' ? (float) $data[$key] : null;
        }

        // Without a defence, its reviewers and pass marks mean nothing.
        if (! $route['open_defence']) {
            $route['defence_reviewers'] = $route['defence_threshold'] = $route['combined_threshold'] = null;
        }

        return $route === self::STANDARD ? null : $route;
    }

    /**
     * The route a proposal (or call) follows: the call's settings over the standard.
     *
     * @return array{open_defence: bool, blind_reviewers: ?int, defence_reviewers: ?int, blind_threshold: ?float, defence_threshold: ?float, combined_threshold: ?float}
     */
    public static function for(Proposal|ProposalCall|null $subject): array
    {
        $call = $subject instanceof Proposal ? $subject->proposalCall : $subject;
        if (! $call) {
            return self::STANDARD;
        }

        // Lists sometimes load only a few columns of the call: read the route itself
        // rather than silently deciding on the standard one.
        $stored = array_key_exists('review_route', $call->getAttributes())
            ? $call->review_route
            : ProposalCall::whereKey($call->getKey())->value('review_route');
        $stored = is_array($stored) ? $stored : [];

        return array_merge(self::STANDARD, array_intersect_key($stored, self::STANDARD));
    }

    /** The call's own pass mark for this threshold key, or null to use the standard. */
    public static function threshold(Proposal $proposal, string $key): ?float
    {
        $value = self::for($proposal)[$key] ?? null;

        return $value === null ? null : (float) $value;
    }

    public static function skipsDefence(Proposal $proposal): bool
    {
        return ! self::for($proposal)['open_defence'];
    }
}
