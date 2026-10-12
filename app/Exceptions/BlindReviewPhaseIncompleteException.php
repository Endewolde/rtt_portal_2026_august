<?php

namespace App\Exceptions;

use Illuminate\Support\Collection;

class BlindReviewPhaseIncompleteException extends \RuntimeException
{
    /**
     * @param  Collection<int, array{id: string, tracker_number: string|null, title: string|null, status: string}>  $pendingProposals
     */
    public function __construct(
        public readonly string $collegeName,
        public readonly Collection $pendingProposals,
    ) {
        $count = $pendingProposals->count();
        $noun = $count === 1 ? 'proposal is' : 'proposals are';

        parent::__construct(
            "Open defence scheduling is on hold for {$collegeName}. {$count} {$noun} still in the blind review phase. "
                .'Once every blind review in your college has been completed, you will be able to schedule open defence sessions.'
        );
    }
}
