<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendRawMailJob;
use App\Models\AppSetting;
use App\Models\SupportApplication;
use App\Models\SupportScheme;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Small grants staff apply for directly — publication incentives, article fees, travel —
 * without the full proposal workflow: apply with evidence, the office decides, then pays.
 */
class SupportGrantController extends Controller
{
    // ── Applicants ────────────────────────────────────────────────────────────

    /** Open schemes and the person's own applications. */
    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();

        return $this->ok([
            'schemes' => SupportScheme::where('active', true)->orderBy('closes_on')->get()
                ->filter->isOpen()->values()
                ->map(fn ($s) => $s->only(['id', 'name', 'kind', 'description', 'max_award', 'max_per_person', 'closes_on'])
                    + ['used' => $s->applications()->where('applicant_id', $user->id)->whereNotIn('status', ['rejected', 'withdrawn'])->count()]),
            'applications' => SupportApplication::with('scheme:id,name,kind')->where('applicant_id', $user->id)->latest()->get(),
            'can_manage' => $user->can('support_grants.manage'),
        ]);
    }

    public function apply(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'scheme_id' => 'required|uuid|exists:support_schemes,id',
            'title' => 'required|string|max:255',
            'venue' => 'nullable|string|max:255',
            'doi' => 'nullable|string|max:200',
            'justification' => 'nullable|string|max:3000',
            'amount_requested' => 'required|numeric|min:1|max:99999999',
            'evidence' => 'required|file|mimes:pdf,jpg,jpeg,png|max:10240',
        ], ['evidence.required' => 'Attach the evidence — the acceptance letter, published paper or invitation.']);

        $scheme = SupportScheme::findOrFail($data['scheme_id']);
        if (! $scheme->isOpen()) {
            return $this->fail('This scheme is not open for applications.');
        }
        if ($scheme->max_award && $data['amount_requested'] > $scheme->max_award) {
            return $this->fail('This scheme pays at most '.number_format($scheme->max_award).' per award.', ['amount_requested' => ['At most '.number_format($scheme->max_award).'.']]);
        }
        $used = $scheme->applications()->where('applicant_id', $user->id)->whereNotIn('status', ['rejected', 'withdrawn'])->count();
        if ($scheme->max_per_person && $used >= $scheme->max_per_person) {
            return $this->fail("You have already applied {$used} time(s) under this scheme, its limit.");
        }

        $application = SupportApplication::create([
            ...collect($data)->except('evidence')->all(),
            'applicant_id' => $user->id,
            'evidence_path' => $request->file('evidence')->store('support-grants', 'local'),
        ]);
        AuditLogger::log('support_grant.applied', 'SupportApplication', $application->id, $user->id, null, ['target_name' => $application->title, 'scheme' => $scheme->name], 201);

        return $this->ok($application->load('scheme:id,name,kind'), "Application {$application->reference} submitted.", 201);
    }

    public function withdraw(Request $request, string $id): JsonResponse
    {
        $application = SupportApplication::where('applicant_id', $request->user()->id)->findOrFail($id);
        if ($application->status !== 'submitted') {
            return $this->fail('Only applications still waiting for a decision can be withdrawn.');
        }
        $application->update(['status' => 'withdrawn']);

        return $this->ok($application, 'Application withdrawn.');
    }

    /** The evidence file, for the applicant and the office only. */
    public function evidence(Request $request, string $id): StreamedResponse
    {
        $application = SupportApplication::findOrFail($id);
        abort_unless($application->applicant_id === $request->user()->id || $request->user()->can('support_grants.manage'), 403);
        abort_unless($application->evidence_path && Storage::disk('local')->exists($application->evidence_path), 404);

        return Storage::disk('local')->download($application->evidence_path, $application->reference.'.'.pathinfo($application->evidence_path, PATHINFO_EXTENSION));
    }

    // ── Office ────────────────────────────────────────────────────────────────

    public function schemes(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('support_grants.manage'), 403);

        $schemes = SupportScheme::withCount(['applications as pending_count' => fn ($q) => $q->where('status', 'submitted')])
            ->orderByDesc('active')->orderByDesc('created_at')->get()
            ->map(fn ($s) => $s->toArray() + ['committed' => $s->committed(), 'paid' => (float) $s->applications()->where('status', 'paid')->sum('amount_approved'), 'is_open' => $s->isOpen()]);

        $applications = SupportApplication::with(['scheme:id,name,kind', 'applicant:id,name,email,college_id', 'applicant.college:id,name'])
            ->when($request->query('status'), fn ($q, $s) => $q->where('status', $s))
            ->when($request->query('scheme_id'), fn ($q, $s) => $q->where('scheme_id', $s))
            ->orderByRaw("status = 'submitted' desc")->latest()->limit(300)->get();

        return $this->ok(['schemes' => $schemes, 'applications' => $applications]);
    }

    public function saveScheme(Request $request, ?string $id = null): JsonResponse
    {
        abort_unless($request->user()->can('support_grants.manage'), 403);
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'kind' => ['required', Rule::in(SupportScheme::KINDS)],
            'description' => 'nullable|string|max:3000',
            'academic_year' => ['nullable', 'regex:/^\d{4}-\d{4}$/'],
            'budget' => 'nullable|numeric|min:0',
            'max_award' => 'nullable|numeric|min:0',
            'max_per_person' => 'nullable|integer|min:1|max:50',
            'opens_on' => 'nullable|date',
            'closes_on' => 'nullable|date|after_or_equal:opens_on',
            'active' => 'boolean',
        ]);

        $scheme = $id ? tap(SupportScheme::findOrFail($id))->update($data) : SupportScheme::create($data + ['created_by' => $request->user()->id]);

        return $this->ok($scheme->fresh(), $id ? 'Scheme saved.' : 'Scheme created.', $id ? 200 : 201);
    }

    /** Approve (with the amount), reject, or mark an approved application paid. */
    public function decide(Request $request, string $id): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->can('support_grants.manage'), 403);
        $application = SupportApplication::with(['scheme', 'applicant:id,name,email'])->findOrFail($id);

        $data = $request->validate([
            'action' => 'required|in:approve,reject,pay',
            'amount_approved' => 'required_if:action,approve|nullable|numeric|min:1',
            'decision_note' => 'required_if:action,reject|nullable|string|max:2000',
            'paid_on' => 'nullable|date|before_or_equal:today',
        ], ['decision_note.required_if' => 'Tell the applicant why it was not approved.']);

        $allowed = ['approve' => ['submitted'], 'reject' => ['submitted', 'approved'], 'pay' => ['approved']][$data['action']];
        if (! in_array($application->status, $allowed, true)) {
            return $this->fail("An application that is {$application->status} cannot be {$data['action']}d.");
        }

        $result = DB::transaction(function () use ($application, $data, $user) {
            $scheme = $application->scheme()->lockForUpdate()->first();
            if ($data['action'] === 'approve' && $scheme->budget !== null && $scheme->committed() + $data['amount_approved'] > $scheme->budget) {
                return 'This would go over the scheme\'s budget — '.number_format($scheme->budget - $scheme->committed()).' is left.';
            }
            $application->update(match ($data['action']) {
                'approve' => ['status' => 'approved', 'amount_approved' => $data['amount_approved'], 'decision_note' => $data['decision_note'] ?? null, 'decided_by' => $user->id, 'decided_at' => now()],
                'reject' => ['status' => 'rejected', 'amount_approved' => null, 'decision_note' => $data['decision_note'], 'decided_by' => $user->id, 'decided_at' => now()],
                'pay' => ['status' => 'paid', 'paid_on' => $data['paid_on'] ?? today()],
            });

            return null;
        });
        if ($result) {
            return $this->fail($result);
        }

        AuditLogger::log('support_grant.'.$data['action'], 'SupportApplication', $application->id, $user->id, null, ['target_name' => $application->title, 'status' => $application->status], 200);
        $this->notify($application->fresh(['scheme', 'applicant']));

        return $this->ok($application->fresh(['scheme:id,name,kind', 'applicant:id,name,email']), match ($data['action']) {
            'approve' => 'Approved and the applicant emailed.', 'reject' => 'Not approved — the applicant has been told why.', default => 'Marked as paid.',
        });
    }

    private function notify(SupportApplication $application): void
    {
        if (! $application->applicant?->email) {
            return;
        }
        SendRawMailJob::deliver(
            view('emails.support_grant_decision', [
                'application' => $application,
                'senderName' => AppSetting::where('key', 'system_name')->value('value') ?? config('mail.from.name'),
                'url' => rtrim(config('app.url'), '/').'/support-grants',
            ])->render(),
            $application->applicant->email,
            $application->applicant->name,
            match ($application->status) {
                'approved' => "Approved — {$application->scheme->name}", 'rejected' => "Not approved — {$application->scheme->name}", default => "Paid — {$application->scheme->name}",
            }
        );
    }

    private function ok(mixed $data, string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []], $status);
    }

    private function fail(string $message, array $errors = []): JsonResponse
    {
        return response()->json(['data' => null, 'message' => $message, 'errors' => $errors, 'meta' => []], 422);
    }
}
