<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\College;
use App\Models\Proposal;
use App\Services\TurnaroundService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TurnaroundController extends Controller
{
    public function __construct(private TurnaroundService $turnaround) {}

    /** Turnaround dashboard — scoped like the rest of the app (college / category officers). */
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('turnaround.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $filters = $this->filters($request);

        return response()->json([
            'data' => array_merge($this->turnaround->report($filters), [
                'filters' => $filters,
                'targets' => collect(TurnaroundService::STAGES)->map(fn ($s) => ['label' => $s['label'], 'target' => $s['target']]),
                'academic_years' => Proposal::whereNotNull('academic_year')->where('status', '!=', 'draft')
                    ->distinct()->orderByDesc('academic_year')->pluck('academic_year'),
                'college_options' => $request->_college_scope ? [] : College::where('status', 'active')->orderBy('name')->get(['id', 'name']),
            ]),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    /** Nudge whoever has to act next on a stuck proposal (once a day per stage). */
    public function remind(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('turnaround.view')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
        }

        $proposal = $this->turnaround->scoped($this->filters($request, withYear: false))->findOrFail($id);
        $result = $this->turnaround->remind($proposal, $request->user());

        $message = match (true) {
            $result['cooldown_until'] !== null => 'A reminder for this stage was already sent in the last 24 hours.',
            $result['sent'] === 0 => 'Nobody is currently responsible for the next step, so no reminder was sent.',
            default => "Reminder sent to {$result['sent']} ".($result['sent'] === 1 ? 'person' : 'people').'.',
        };

        return response()->json([
            'data' => $result,
            'message' => $message,
            'errors' => [],
            'meta' => [],
        ], $result['cooldown_until'] !== null ? 429 : 200);
    }

    /** @return array{academic_year: string|null, college_id: string|null, category: string|null} */
    private function filters(Request $request, bool $withYear = true): array
    {
        return [
            'academic_year' => $withYear
                ? ($request->input('academic_year') ?: DB::table('app_settings')->where('key', 'current_academic_year')->value('value'))
                : null,
            'college_id' => $request->_college_scope ?: $request->input('college_id'),
            'category' => $request->_category_scope ?: $request->input('category'),
        ];
    }
}
