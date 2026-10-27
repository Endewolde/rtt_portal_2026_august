<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\DeliverReportSubscriptionJob;
use App\Models\ReportSubscription;
use App\Services\ReportService;
use App\Services\ReportSubscriptionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** A person's own scheduled report emails. */
class ReportSubscriptionController extends Controller
{
    public function __construct(private ReportService $reports) {}

    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('reports.view_any')) {
            return $this->forbidden();
        }

        $subscriptions = ReportSubscription::where('user_id', $request->user()->id)->latest()->get();

        return $this->ok($subscriptions->map(fn ($s) => $this->present($s))->values());
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()?->can('reports.view_any')) {
            return $this->forbidden();
        }

        $data = $this->validated($request);
        if (ReportSubscription::where('user_id', $request->user()->id)->count() >= 20) {
            return response()->json(['data' => null, 'message' => 'You can schedule up to 20 reports. Remove one first.', 'errors' => []], 422);
        }

        $subscription = ReportSubscription::create($data + ['user_id' => $request->user()->id, 'active' => true]);

        return $this->ok($this->present($subscription), 'Scheduled. '.$this->describe($subscription).'.', 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $subscription = $this->own($request, $id);
        $data = $request->validate(['active' => 'sometimes|boolean']) + (
            $request->hasAny(['frequency', 'format', 'weekday', 'day_of_month', 'filters']) ? $this->validated($request, partial: true) : []
        );
        $subscription->update($data);

        return $this->ok($this->present($subscription->fresh()), $subscription->active ? 'Schedule updated.' : 'Paused — nothing is sent until you resume it.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        $this->own($request, $id)->delete();

        return $this->ok(null, 'Scheduled report removed.');
    }

    /** Send it straight away, to check how it looks. */
    public function sendNow(Request $request, string $id): JsonResponse
    {
        $subscription = $this->own($request, $id);
        DeliverReportSubscriptionJob::deliver($subscription->id);

        return $this->ok($this->present($subscription->fresh()), "On its way to {$request->user()->email}.");
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, bool $partial = false): array
    {
        $req = $partial ? 'sometimes' : 'required';

        $data = $request->validate([
            'report_type' => [$req, Rule::in(ReportService::LIVE_TYPES)],
            'frequency' => [$req, Rule::in(ReportSubscription::FREQUENCIES)],
            'format' => [$req, Rule::in(ReportSubscription::FORMATS)],
            'weekday' => ['nullable', 'integer', 'between:1,7'],
            'day_of_month' => ['nullable', 'integer', 'between:1,31'],
            'filters' => ['nullable', 'array'],
            'filters.academic_year' => ['nullable', 'string', 'max:20'],
            'filters.college_id' => ['nullable', 'string', 'max:64'],
            'filters.category' => ['nullable', 'string', 'max:50'],
        ]);

        if (array_key_exists('filters', $data)) {
            $data['filters'] = $this->reports->scopedFilters($request->user(), $data['filters'] ?? []);
        }

        return $data;
    }

    private function own(Request $request, string $id): ReportSubscription
    {
        return ReportSubscription::where('user_id', $request->user()->id)->findOrFail($id);
    }

    /** @return array<string, mixed> */
    private function present(ReportSubscription $s): array
    {
        return [
            'id' => $s->id,
            'report_type' => $s->report_type,
            'report_label' => ReportSubscriptionService::LABELS[$s->report_type] ?? $s->report_type,
            'filters' => $s->filters ?? [],
            'frequency' => $s->frequency,
            'weekday' => $s->weekday,
            'day_of_month' => $s->day_of_month,
            'format' => $s->format,
            'active' => $s->active,
            'schedule' => $this->describe($s),
            'last_sent_at' => $s->last_sent_at?->toIso8601String(),
            'next_run' => $s->nextRun()?->toDateString(),
        ];
    }

    private function describe(ReportSubscription $s): string
    {
        $days = [1 => 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        $format = $s->format === 'xlsx' ? 'Excel' : 'PDF';

        return $s->frequency === 'weekly'
            ? "Every {$days[$s->weekday ?: 1]} as {$format}"
            : 'Monthly on day '.($s->day_of_month ?: 1)." as {$format}";
    }

    private function ok(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => []], 403);
    }
}
