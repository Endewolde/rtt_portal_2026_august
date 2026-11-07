<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Innovation;
use App\Models\InnovationIncome;
use App\Models\Partnership;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The technology transfer office's two registers: agreements with partners (MoUs and
 * the like, with expiry reminders) and the pipeline that takes an invention from
 * disclosure through patenting to a licence or spin-off, with the income it brings.
 */
class TechTransferController extends Controller
{
    // ── Partnerships ──────────────────────────────────────────────────────────

    public function partnerships(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('partnerships.view'), 403);

        $rows = Partnership::with(['college:id,name', 'focalPerson:id,name', 'proposals:id,tracker_number,title'])
            ->when($request->query('state'), fn ($q, $s) => $q->inState($s))
            ->when($request->query('type'), fn ($q, $t) => $q->where('partner_type', $t))
            ->when($request->query('search'), fn ($q, $s) => $q->where(fn ($w) => $w->where('partner_name', 'like', "%{$s}%")->orWhere('title', 'like', "%{$s}%")->orWhere('country', 'like', "%{$s}%")))
            ->orderByRaw('expires_on is null, expires_on')
            ->get();

        $all = Partnership::get(['terminated', 'expires_on', 'partner_type']);

        return $this->ok($rows->map(fn ($p) => $p->toArray() + ['has_document' => filled($p->document_path)]), [
            'counts' => ['total' => $all->count()] + $all->countBy('state')->all(),
            'by_type' => $all->where('state', '!=', 'terminated')->countBy('partner_type'),
        ]);
    }

    public function storePartnership(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('partnerships.manage'), 403);
        $data = $this->validatePartnership($request);

        $partnership = Partnership::create($data + ['created_by' => $request->user()->id]);
        $this->syncPartnershipExtras($request, $partnership);
        AuditLogger::log('partnership.created', 'Partnership', $partnership->id, $request->user()->id, null, ['target_name' => $partnership->partner_name], 201);

        return $this->ok($partnership->fresh(['college:id,name', 'focalPerson:id,name', 'proposals:id,tracker_number,title']), [], 'Agreement added.', 201);
    }

    public function updatePartnership(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->can('partnerships.manage'), 403);
        $partnership = Partnership::findOrFail($id);
        $data = $this->validatePartnership($request);

        // A renewed end date starts the reminders afresh.
        if (array_key_exists('expires_on', $data) && (string) $data['expires_on'] !== (string) $partnership->expires_on?->toDateString()) {
            $data['reminded_on'] = null;
        }
        $partnership->update($data);
        $this->syncPartnershipExtras($request, $partnership);
        AuditLogger::log('partnership.updated', 'Partnership', $partnership->id, $request->user()->id, null, ['target_name' => $partnership->partner_name], 200);

        return $this->ok($partnership->fresh(['college:id,name', 'focalPerson:id,name', 'proposals:id,tracker_number,title']), [], 'Agreement saved.');
    }

    public function destroyPartnership(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->can('partnerships.manage'), 403);
        $partnership = Partnership::findOrFail($id);
        if ($partnership->document_path) {
            Storage::disk('local')->delete($partnership->document_path);
        }
        $partnership->delete();
        AuditLogger::log('partnership.deleted', 'Partnership', $id, $request->user()->id, ['target_name' => $partnership->partner_name], null, 200);

        return $this->ok(null, [], 'Agreement deleted.');
    }

    /** The signed agreement — kept private, so only people who may see the register can open it. */
    public function partnershipDocument(Request $request, string $id): StreamedResponse
    {
        abort_unless($request->user()->can('partnerships.view'), 403);
        $partnership = Partnership::findOrFail($id);
        abort_unless($partnership->document_path && Storage::disk('local')->exists($partnership->document_path), 404);

        return Storage::disk('local')->download($partnership->document_path, str($partnership->partner_name)->slug().'-agreement.'.pathinfo($partnership->document_path, PATHINFO_EXTENSION));
    }

    // ── Innovations ───────────────────────────────────────────────────────────

    public function innovations(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('innovations.view'), 403);

        $rows = Innovation::with(['college:id,name', 'proposal:id,tracker_number,title', 'partnership:id,partner_name', 'incomes'])
            ->when($request->query('stage'), fn ($q, $s) => $q->where('stage', $s))
            ->when($request->query('search'), fn ($q, $s) => $q->where(fn ($w) => $w->where('title', 'like', "%{$s}%")->orWhere('reference', 'like', "%{$s}%")->orWhere('filing_number', 'like', "%{$s}%")))
            ->latest()
            ->get();

        $incomes = InnovationIncome::get(['amount', 'currency', 'received_on']);

        return $this->ok($rows->map(fn ($i) => $i->toArray() + ['income_total' => (float) $i->incomes->where('currency', 'ETB')->sum('amount')]), [
            'by_stage' => collect(Innovation::STAGES)->mapWithKeys(fn ($s) => [$s => Innovation::where('stage', $s)->count()]),
            // Income in birr by the year it arrived; other currencies are listed per record.
            'income_by_year' => $incomes->where('currency', 'ETB')->groupBy(fn ($i) => $i->received_on->format('Y'))->map(fn ($g) => (float) $g->sum('amount'))->sortKeys(),
            'income_total' => (float) $incomes->where('currency', 'ETB')->sum('amount'),
        ]);
    }

    public function storeInnovation(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('innovations.manage'), 403);
        $innovation = Innovation::create($this->validateInnovation($request) + ['created_by' => $request->user()->id]);
        AuditLogger::log('innovation.created', 'Innovation', $innovation->id, $request->user()->id, null, ['target_name' => $innovation->title, 'stage' => $innovation->stage], 201);

        return $this->ok($innovation->fresh(['college:id,name', 'proposal:id,tracker_number,title', 'partnership:id,partner_name', 'incomes']), [], "Recorded as {$innovation->reference}.", 201);
    }

    public function updateInnovation(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->can('innovations.manage'), 403);
        $innovation = Innovation::findOrFail($id);
        $before = $innovation->stage;
        $innovation->update($this->validateInnovation($request));

        AuditLogger::log('innovation.updated', 'Innovation', $innovation->id, $request->user()->id, ['stage' => $before], ['stage' => $innovation->stage, 'target_name' => $innovation->title], 200);

        return $this->ok($innovation->fresh(['college:id,name', 'proposal:id,tracker_number,title', 'partnership:id,partner_name', 'incomes']), [], 'Saved.');
    }

    public function destroyInnovation(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->can('innovations.manage'), 403);
        $innovation = Innovation::findOrFail($id);
        $innovation->delete();
        AuditLogger::log('innovation.deleted', 'Innovation', $id, $request->user()->id, ['target_name' => $innovation->title], null, 200);

        return $this->ok(null, [], 'Deleted.');
    }

    public function addIncome(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->can('innovations.manage'), 403);
        $innovation = Innovation::findOrFail($id);
        $data = $request->validate([
            'amount' => 'required|numeric|min:0.01|max:999999999999',
            'currency' => 'required|string|size:3',
            'received_on' => 'required|date|before_or_equal:today',
            'source' => ['required', Rule::in(Innovation::INCOME_SOURCES)],
            'note' => 'nullable|string|max:255',
        ]);
        $income = $innovation->incomes()->create(['currency' => strtoupper($data['currency'])] + $data + ['recorded_by' => $request->user()->id]);
        AuditLogger::log('innovation.income', 'Innovation', $innovation->id, $request->user()->id, null, ['amount' => $income->amount, 'currency' => $income->currency, 'target_name' => $innovation->title], 201);

        return $this->ok($income, [], 'Income recorded.', 201);
    }

    public function removeIncome(Request $request, string $id, string $incomeId): JsonResponse
    {
        abort_unless($request->user()->can('innovations.manage'), 403);
        InnovationIncome::where('innovation_id', $id)->findOrFail($incomeId)->delete();

        return $this->ok(null, [], 'Income entry removed.');
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function validatePartnership(Request $request): array
    {
        return $request->validate([
            'partner_name' => 'required|string|max:255',
            'partner_type' => ['required', Rule::in(Partnership::PARTNER_TYPES)],
            'country' => 'nullable|string|max:80',
            'agreement_type' => ['required', Rule::in(Partnership::AGREEMENT_TYPES)],
            'title' => 'nullable|string|max:255',
            'scope' => 'nullable|string|max:5000',
            'signed_on' => 'nullable|date',
            'expires_on' => 'nullable|date|after_or_equal:signed_on',
            'terminated' => 'sometimes|boolean',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'focal_person_id' => 'nullable|uuid|exists:users,id',
            'partner_contact_name' => 'nullable|string|max:255',
            'partner_contact_email' => 'nullable|email|max:255',
        ], ['expires_on.after_or_equal' => 'The end date cannot be before the signing date.']);
    }

    private function syncPartnershipExtras(Request $request, Partnership $partnership): void
    {
        $request->validate([
            'proposal_ids' => 'sometimes|nullable|array|max:50',
            'proposal_ids.*' => 'uuid|exists:proposals,id',
            'document' => 'sometimes|file|mimes:pdf,doc,docx,jpg,jpeg,png|max:20480',
        ]);
        if ($request->has('proposal_ids')) {
            $partnership->proposals()->sync($request->input('proposal_ids') ?? []);
        }
        if ($request->hasFile('document')) {
            if ($partnership->document_path) {
                Storage::disk('local')->delete($partnership->document_path);
            }
            $partnership->update(['document_path' => $request->file('document')->store('partnerships', 'local')]);
        }
    }

    /** @return array<string, mixed> */
    private function validateInnovation(Request $request): array
    {
        return $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:5000',
            'inventors' => 'nullable|array|max:20',
            'inventors.*' => 'string|max:150',
            'college_id' => 'nullable|uuid|exists:colleges,id',
            'proposal_id' => 'nullable|uuid|exists:proposals,id',
            'ip_type' => ['required', Rule::in(Innovation::IP_TYPES)],
            'stage' => ['required', Rule::in(Innovation::STAGES)],
            'disclosed_on' => 'nullable|date',
            'filing_number' => [Rule::requiredIf(in_array($request->input('stage'), ['filed', 'granted'], true)), 'nullable', 'string', 'max:100'],
            'filed_on' => 'nullable|date',
            'granted_on' => [Rule::requiredIf($request->input('stage') === 'granted'), 'nullable', 'date', 'after_or_equal:filed_on'],
            'commercialisation' => [Rule::requiredIf($request->input('stage') === 'commercialised'), 'nullable', Rule::in(Innovation::COMMERCIALISATION)],
            'partnership_id' => 'nullable|uuid|exists:partnerships,id',
            'licensee' => 'nullable|string|max:255',
            'licensed_on' => 'nullable|date',
            'spin_off_name' => [Rule::requiredIf($request->input('commercialisation') === 'spin_off'), 'nullable', 'string', 'max:255'],
            'notes' => 'nullable|string|max:5000',
        ], [
            'filing_number.required' => 'A filed or granted patent needs its application number.',
            'granted_on.required' => 'Add the date it was granted.',
            'commercialisation.required' => 'Say how it was commercialised.',
            'spin_off_name.required' => 'Name the spin-off company.',
        ]);
    }

    private function ok(mixed $data, array $meta = [], string $message = '', int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => $meta], $status);
    }
}
