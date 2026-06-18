<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DefenceSession;
use App\Models\ExternalFundOpportunity;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Support\ICalBuilder;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CalendarController extends Controller
{
    public function export(Request $request): StreamedResponse|JsonResponse
    {
        // Browser downloads cannot send Authorization headers, so we accept ?token= as fallback.
        $user = $request->user();

        if (! $user && $request->query('token')) {
            $pat = PersonalAccessToken::findToken($request->query('token'));
            $user = $pat?->tokenable;
        }

        if (! $user) {
            return response()->json(['data' => null, 'message' => 'Unauthenticated.', 'errors' => [], 'meta' => []], 401);
        }
        $cal = new ICalBuilder('RTT Platform Calendar');

        // All users — open proposal calls
        ProposalCall::active()
            ->where('end_date', '>=', now())
            ->get(['id', 'title', 'start_date', 'end_date', 'category'])
            ->each(function ($call) use ($cal) {
                $cal->addEvent(
                    'call-'.$call->id,
                    'Call Deadline: '.$call->title,
                    Carbon::parse($call->start_date),
                    Carbon::parse($call->end_date),
                    'Category: '.ucfirst(str_replace('_', ' ', $call->category)),
                );
            });

        // All users — open external fund opportunities
        ExternalFundOpportunity::where('status', 'open')
            ->where('deadline', '>=', now())
            ->get(['id', 'title', 'opening_date', 'deadline', 'category'])
            ->each(function ($opp) use ($cal) {
                $start = Carbon::parse($opp->opening_date ?? $opp->deadline)->startOfDay();
                $end = Carbon::parse($opp->deadline)->endOfDay();
                $cal->addEvent(
                    'fund-'.$opp->id,
                    'Funding Deadline: '.$opp->title,
                    $start,
                    $end,
                    'Category: '.ucfirst(str_replace('_', ' ', $opp->category)),
                );
            });

        // Reviewers — review assignment due dates
        if ($user->hasAnyRole(['reviewer', 'super_admin', 'admin', 'central_officer'])) {
            $assignmentQuery = ReviewAssignment::with('proposal:id,tracker_number,title')
                ->whereIn('status', ['pending', 'in_progress'])
                ->whereNotNull('due_date');

            if ($user->hasRole('reviewer')) {
                $assignmentQuery->where('reviewer_id', $user->id);
            }

            $assignmentQuery->get(['id', 'proposal_id', 'due_date', 'assigned_at'])
                ->each(function ($a) use ($cal) {
                    $start = Carbon::parse($a->assigned_at ?? $a->due_date)->startOfDay();
                    $end = Carbon::parse($a->due_date)->endOfDay();
                    $cal->addEvent(
                        'review-'.$a->id,
                        'Review Due: '.($a->proposal?->tracker_number ?? 'Unknown'),
                        $start,
                        $end,
                        $a->proposal?->title,
                    );
                });
        }

        // PI — upcoming defence sessions
        DefenceSession::with('proposal:id,tracker_number,title,pi_user_id')
            ->where('status', 'scheduled')
            ->where('scheduled_date', '>=', now()->toDateString())
            ->whereHas('proposal', fn ($q) => $q->where('pi_user_id', $user->id))
            ->get(['id', 'proposal_id', 'scheduled_date', 'scheduled_time', 'venue'])
            ->each(function ($d) use ($cal) {
                $time = $d->scheduled_time ?? '09:00:00';
                $start = Carbon::parse($d->scheduled_date->toDateString().' '.$time);
                $end = $start->copy()->addHours(2);
                $cal->addEvent(
                    'defence-'.$d->id,
                    'Defence: '.($d->proposal?->tracker_number ?? 'Unknown'),
                    $start,
                    $end,
                    $d->venue ? 'Venue: '.$d->venue : null,
                );
            });

        $content = $cal->build();

        return response()->streamDownload(
            function () use ($content) {
                echo $content;
            },
            'rtt-calendar.ics',
            [
                'Content-Type' => 'text/calendar; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="rtt-calendar.ics"',
            ]
        );
    }
}
