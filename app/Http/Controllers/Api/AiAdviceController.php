<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiInsight;
use App\Models\Proposal;
use App\Services\AiClient;
use App\Services\ProgressReportService;
use App\Services\ProposalAiCoachService;
use App\Services\ReviewSummaryService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/** The AI writing coach (research team, before submission) and the AI review summary (central committee). */
class AiAdviceController extends Controller
{
    public function __construct(private AiClient $ai) {}

    public function coach(string $id, Request $request, ProposalAiCoachService $coach, ProgressReportService $access): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        if (! $access->isTeamMember($proposal, $request->user())) {
            return $this->fail('Only the research team can see the writing coach.', 403);
        }

        return $this->ok([
            'enabled' => $this->enabled('ai_coach_enabled'),
            'available' => $this->ai->available(),
            'can_request' => $proposal->status === 'draft',
            'used_today' => $coach->usedToday($proposal),
            'daily_limit' => ProposalAiCoachService::DAILY_LIMIT,
            'latest' => $this->present($coach->latest($proposal)),
        ]);
    }

    public function runCoach(string $id, Request $request, ProposalAiCoachService $coach, ProgressReportService $access): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        if (! $access->isTeamMember($proposal, $request->user())) {
            return $this->fail('Only the research team can use the writing coach.', 403);
        }
        if (! $this->enabled('ai_coach_enabled')) {
            return $this->fail('The writing coach is switched off.', 422);
        }
        if ($proposal->status !== 'draft') {
            return $this->fail('The writing coach is for proposals that have not been submitted yet.', 422);
        }

        return $this->attempt(fn () => $coach->run($proposal, $request->user()), $proposal);
    }

    public function summary(string $id, Request $request, ReviewSummaryService $summaries): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        if (! $this->canSeeSummary($request, $proposal)) {
            return $this->fail('Unauthorized.', 403);
        }
        $latest = $summaries->latest($proposal);

        return $this->ok([
            'enabled' => $this->enabled('ai_review_summary_enabled'),
            'available' => $this->ai->available(),
            'reviews' => $latest['reviews'],
            'stale' => $latest['stale'],
            'latest' => $this->present($latest['insight']),
        ]);
    }

    public function runSummary(string $id, Request $request, ReviewSummaryService $summaries): JsonResponse
    {
        $proposal = Proposal::findOrFail($id);
        if (! $this->canSeeSummary($request, $proposal)) {
            return $this->fail('Unauthorized.', 403);
        }
        if (! $this->enabled('ai_review_summary_enabled')) {
            return $this->fail('The AI review summary is switched off.', 422);
        }

        return $this->attempt(fn () => $summaries->run($proposal, $request->user()), $proposal);
    }

    private function attempt(callable $run, Proposal $proposal): JsonResponse
    {
        // AI replies can take up to a minute or two. Web requests only: in a long-lived
        // console process (tests, workers) this would cap the whole process instead.
        if (! app()->runningInConsole()) {
            @set_time_limit(150);
        }

        try {
            return $this->ok($this->present($run()));
        } catch (ConnectionException $e) {
            Log::error('AI advice: provider unreachable', ['proposal_id' => $proposal->id, 'error' => $e->getMessage()]);

            return $this->fail('The AI service could not be reached. Please try again later.', 503);
        } catch (\RuntimeException $e) {
            Log::warning('AI advice failed', ['proposal_id' => $proposal->id, 'error' => $e->getMessage()]);

            return $this->fail(str_starts_with($e->getMessage(), 'Groq API error') || str_contains($e->getMessage(), 'API error')
                ? 'The AI service returned an error. Please try again later.'
                : $e->getMessage(), 422);
        }
    }

    /** Decision-makers only, and only within their own college (RTT managers) or category (directors). */
    private function canSeeSummary(Request $request, Proposal $proposal): bool
    {
        return $request->user()->can('ai.review_summary')
            && (! $request->_college_scope || $proposal->college_id === $request->_college_scope)
            && (! $request->_category_scope || $proposal->category === $request->_category_scope);
    }

    private function enabled(string $key): bool
    {
        return DB::table('app_settings')->where('key', $key)->value('value') !== 'false';
    }

    private function present(?AiInsight $insight): ?array
    {
        return $insight ? [
            'result' => $insight->result,
            'created_at' => $insight->created_at->toIso8601String(),
            'requested_by' => $insight->requester?->name,
            'model' => $insight->model,
        ] : null;
    }

    private function ok(mixed $data): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    private function fail(string $message, int $status): JsonResponse
    {
        return response()->json(['data' => null, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }
}
