<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Award;
use App\Models\Proposal;
use App\Services\AwardService;
use App\Support\AuditLogger;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AwardController extends Controller
{
    public function __construct(private AwardService $service) {}

    public function store(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('awards.create')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'awarded_amount' => 'required|numeric|min:0',
            'approval_notes' => 'nullable|string',
        ]);

        $proposal = Proposal::findOrFail($id);

        // If award already exists, update it instead of failing
        $existing = Award::where('proposal_id', $id)->first();
        if ($existing) {
            $existing->update([
                'awarded_amount' => (float) $request->awarded_amount,
                'approval_notes' => $request->approval_notes ?? $existing->approval_notes,
            ]);

            return response()->json([
                'data' => $existing->fresh()->load('approvedBy:id,name'),
                'message' => 'Award updated.',
                'errors' => [],
                'meta' => [],
            ]);
        }

        try {
            $award = $this->service->generate($proposal, $request->user(), (float) $request->awarded_amount);

            if ($request->filled('approval_notes')) {
                $award->update(['approval_notes' => $request->approval_notes]);
            }

            AuditLogger::log(
                'award.issued',
                Proposal::class,
                $proposal->id,
                $request->user()->id,
                null,
                ['grant_reference' => $award->grant_reference, 'awarded_amount' => $request->awarded_amount, 'tracker' => $proposal->tracker_number],
            );

            return response()->json([
                'data' => $award->fresh()->load('approvedBy:id,name'),
                'message' => 'Award generated. Grant: '.$award->grant_reference,
                'errors' => [],
                'meta' => [],
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'data' => null,
                'message' => $e->getMessage(),
                'errors' => [],
                'meta' => [],
            ], 422);
        }
    }

    public function show(string $id): JsonResponse
    {
        $award = Award::where('proposal_id', $id)
            ->with('approvedBy:id,name')
            ->first();

        if (! $award) {
            return response()->json([
                'data' => null,
                'message' => '',
                'errors' => [],
                'meta' => [],
            ]);
        }

        return response()->json([
            'data' => $award,
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function update(string $id, Request $request): JsonResponse
    {
        if (! $request->user()?->can('awards.update')) {
            return response()->json(['data' => null, 'message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'awarded_amount' => 'nullable|numeric|min:0',
            'approval_notes' => 'nullable|string',
        ]);

        $award = Award::where('proposal_id', $id)->firstOrFail();

        $updates = [];
        if ($request->has('awarded_amount')) {
            $updates['awarded_amount'] = (float) $request->awarded_amount;
        }
        if ($request->has('approval_notes')) {
            $updates['approval_notes'] = $request->approval_notes;
        }

        if (! empty($updates)) {
            $old = $award->only(array_keys($updates));
            $award->update($updates);
            AuditLogger::log(
                'award.updated',
                Award::class,
                $award->id,
                $request->user()->id,
                $old,
                $updates,
            );
        }

        return response()->json([
            'data' => $award->fresh()->load('approvedBy:id,name'),
            'message' => 'Award updated successfully.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function exportAwarded(Request $request): StreamedResponse
    {
        $user = $request->user();

        // Previously unchecked — a plain staff/PI user doesn't match any of the
        // category-officer roles below, so $allowedCategories stayed null ("all")
        // and they could bulk-export every awarded proposal's PI/co-PI names,
        // emails, and amounts. Same officer set approveLetters() already uses.
        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'college_officer',
            'research_officer', 'community_officer', 'technology_officer', 'support_officer'])) {
            abort(403, 'Unauthorized.');
        }

        $roleCategories = [
            'research_officer' => 'research',
            'community_officer' => 'community_engagement',
            'technology_officer' => 'technology_transfer',
        ];

        // Determine which categories this user may export
        $allowedCategories = null; // null = all
        foreach ($roleCategories as $role => $cat) {
            if ($user->hasRole($role)) {
                $allowedCategories = [$cat];
                break;
            }
        }

        // Admin/super_admin/central_officer can optionally filter by a specific category
        $requestedCategory = $request->query('category');
        if ($allowedCategories !== null && $requestedCategory && ! in_array($requestedCategory, $allowedCategories)) {
            abort(403, 'You are not allowed to export this category.');
        }

        $fundedStatuses = ['funded', 'midterm_evaluation', 'completed', 'archived'];

        $query = Proposal::with([
            'pi:id,name,email',
            'college:id,name',
            'department:id,name',
            'award',
            'activeMembers.user:id,name,email',
            'contractSignedBy:id,name',
        ])
            ->whereIn('status', $fundedStatuses)
            ->orderBy('academic_year', 'desc')
            ->orderBy('created_at', 'desc');

        if ($allowedCategories !== null) {
            $query->whereIn('category', $allowedCategories);
        } elseif ($requestedCategory) {
            $query->where('category', $requestedCategory);
        }

        if ($year = $request->query('year')) {
            $query->where('academic_year', $year);
        }

        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }

        $proposals = $query->get();

        $categoryLabels = [
            'research' => 'Research',
            'community_engagement' => 'Community Engagement',
            'technology_transfer' => 'Technology Transfer',
            'innovation' => 'Innovation',
            'other' => 'Other',
        ];

        $categorySlug = $requestedCategory
            ? ($categoryLabels[$requestedCategory] ?? $requestedCategory)
            : ($allowedCategories ? ($categoryLabels[$allowedCategories[0]] ?? $allowedCategories[0]) : 'All');

        $filename = 'awarded_proposals_'.strtolower(str_replace(' ', '_', $categorySlug)).'_'.date('Y-m-d').'.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
            'Cache-Control' => 'no-cache',
        ];

        return response()->stream(function () use ($proposals, $categoryLabels) {
            $handle = fopen('php://output', 'w');
            fwrite($handle, "\xEF\xBB\xBF");

            fputcsv($handle, [
                'Grant Reference', 'Title', 'Category', 'Principal Investigator', 'PI Email',
                'Co-Investigators', 'Co-Investigator Emails',
                'College', 'Department', 'Academic Year', 'Status',
                'Awarded Amount (ETB)', 'Award Date', 'Approval Notes',
                'Contract Status', 'Contract Submitted', 'Contract Signed', 'Contract Signed By', 'Contract Rejection Reason',
            ]);

            foreach ($proposals as $p) {
                $award = $p->award;
                $coIs = $p->activeMembers->where('role', 'co_investigator');

                fputcsv($handle, [
                    $award?->grant_reference ?? '',
                    $p->title,
                    $categoryLabels[$p->category] ?? $p->category,
                    $p->pi?->name ?? '',
                    $p->pi?->email ?? '',
                    $coIs->pluck('user.name')->filter()->implode('; '),
                    $coIs->pluck('user.email')->filter()->implode('; '),
                    $p->college?->name ?? '',
                    $p->department?->name ?? '',
                    $p->academic_year ?? '',
                    Proposal::statusLabel($p->status),
                    $award ? number_format((float) $award->awarded_amount, 2) : '',
                    $award?->approved_at?->format('Y-m-d') ?? '',
                    $award?->approval_notes ?? '',
                    $p->contract_status ? ucfirst($p->contract_status) : 'Not submitted',
                    $p->contract_submitted_at?->format('Y-m-d') ?? '',
                    $p->contract_signed_at?->format('Y-m-d') ?? '',
                    $p->contractSignedBy?->name ?? '',
                    $p->contract_rejection_reason ?? '',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }

    /**
     * Officers bulk-approve grant letters: saves template fields and generates one
     * PDF per funded proposal, stored on the private disk.
     */
    public function approveLetters(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasAnyRole(['super_admin', 'admin', 'central_officer', 'college_officer',
            'research_officer', 'community_officer', 'technology_officer', 'support_officer'])) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'signatoryName' => 'required|string|max:255',
            'signatoryTitle' => 'nullable|string|max:255',
            'fileNo' => 'nullable|string|max:100',
            'date' => 'nullable|string|max:100',
            'cc' => 'nullable|array',
            'cc.*' => 'string',
        ]);

        $settings = DB::table('app_settings')
            ->whereIn('key', ['organization_name', 'org_name_amharic', 'org_sub_amharic', 'address', 'fax', 'mail_from_address', 'system_logo'])
            ->pluck('value', 'key');

        $awards = Award::whereHas('proposal', fn ($q) => $q->where('status', 'funded'))
            ->with(['proposal.pi:id,name,email', 'proposal.members.user:id,name', 'proposal.college:id,name'])
            ->get();

        $signatoryTitle = $request->signatoryTitle ?? 'Vice President, Research and Technology Transfer';
        $letterDate = $request->date ?? now()->format('d F Y');
        $cc = $request->cc ?? [];
        $count = 0;

        foreach ($awards as $award) {
            $proposal = $award->proposal;
            if (! $proposal) {
                continue;
            }

            $amount = (float) $award->awarded_amount;
            $amountFmt = 'ETB '.number_format($amount, 2).' ('.self::numberToWords($amount).' Ethiopian Birr)';
            $category = str_replace('_', ' ', $proposal->category ?? '');

            $members = [];
            if ($proposal->pi) {
                $members[] = ['name' => $proposal->pi->name, 'role' => 'PI'];
            }
            foreach ($proposal->members ?? [] as $m) {
                if ($m->role === 'co_investigator' && $m->status === 'active' && $m->user) {
                    $members[] = ['name' => $m->user->name, 'role' => 'Member'];
                }
            }

            $pdf = Pdf::loadView('pdf.grant_letter', [
                'members' => $members,
                'orgName' => $settings['organization_name'] ?? config('app.name'),
                'orgNameAmharic' => $settings['org_name_amharic'] ?? '',
                'orgSubAmharic' => $settings['org_sub_amharic'] ?? '',
                'address' => $settings['address'] ?? '',
                'fax' => $settings['fax'] ?? '',
                'email' => $settings['mail_from_address'] ?? '',
                'logoUrl' => $settings['system_logo'] ?? null,
                'signatoryName' => $request->signatoryName,
                'signatoryTitle' => $signatoryTitle,
                'fileNo' => $request->fileNo ?? '',
                'letterDate' => $letterDate,
                'cc' => $cc,
                'refNo' => $award->grant_reference,
                'amountFmt' => $amountFmt,
                'category' => $category,
                'body' => $this->buildLetterBody($proposal, $amountFmt, $category, $settings),
            ])->setPaper('a4', 'portrait');

            $path = 'grant-letters/'.$award->grant_reference.'.pdf';
            Storage::disk('private')->put($path, $pdf->output());

            $award->update([
                'grant_letter_approved_at' => now(),
                'grant_letter_approved_by' => $user->id,
                'letter_signatory_name' => $request->signatoryName,
                'letter_signatory_title' => $signatoryTitle,
                'letter_file_no' => $request->fileNo,
                'letter_date' => $letterDate,
                'letter_cc' => json_encode($cc),
                'grant_letter_path' => $path,
            ]);

            $count++;
        }

        return response()->json([
            'data' => ['count' => $count],
            'message' => "{$count} grant letter(s) generated and saved. PIs may now download their letters.",
            'errors' => [],
            'meta' => [],
        ]);
    }

    /**
     * PI downloads their pre-generated award letter PDF.
     */
    public function downloadLetter(Request $request, string $id)
    {
        $proposal = Proposal::findOrFail($id);

        if ($request->user()?->id !== $proposal->pi_user_id) {
            return response()->json(['message' => 'You can only download your own award letter.', 'errors' => []], 403);
        }

        $award = Award::where('proposal_id', $id)->firstOrFail();

        if (! $award->grant_letter_path || ! Storage::disk('private')->exists($award->grant_letter_path)) {
            return response()->json(['message' => 'Your award letter has not been generated yet. Please check back later.', 'errors' => []], 403);
        }

        $filename = 'Award-Letter-'.$award->grant_reference.'.pdf';

        return Storage::disk('private')->download($award->grant_letter_path, $filename, [
            'Content-Type' => 'application/pdf',
        ]);
    }

    private function buildLetterBody(Proposal $proposal, string $amountFmt, string $category, Collection $settings): string
    {
        $orgName = $settings['organization_name'] ?? config('app.name');
        $title = $proposal->title ?? '';

        return "{$orgName} is pleased to inform you that your {$category} proposal entitled \"{$title}\" has undergone a thorough evaluation and assessment by the Evaluation Management System and is accepted for funding amounting to {$amountFmt} for one year.\n\nThus, we are pleased to inform you that the office of the Vice President for Research and Technology Transfer has approved your proposal for the aforementioned budget grant. Upon completion of the project and when all functional requirements are met, you are required to hand over the system to the university. In the meantime, training, support and maintenance should be provided by the team members whenever deemed necessary by the office of the Vice President for Research and Technology Transfer during the grant period. We wish you success in your research project and look forward to receiving tangible outputs and successful implementation of the project.";
    }

    private static function numberToWords(float $num): string
    {
        $n = (int) round($num);
        if ($n === 0) {
            return 'Zero';
        }
        $ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
            'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
            'Seventeen', 'Eighteen', 'Nineteen'];
        $tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

        $convert = function (int $n) use (&$convert, $ones, $tens): string {
            if ($n < 20) {
                return $ones[$n];
            }
            if ($n < 100) {
                return $tens[(int) ($n / 10)].($n % 10 ? ' '.$ones[$n % 10] : '');
            }
            if ($n < 1000) {
                return $ones[(int) ($n / 100)].' Hundred'.($n % 100 ? ' and '.$convert($n % 100) : '');
            }
            if ($n < 1_000_000) {
                return $convert((int) ($n / 1000)).' Thousand'.($n % 1000 ? ' '.$convert($n % 1000) : '');
            }

            return $convert((int) ($n / 1_000_000)).' Million'.($n % 1_000_000 ? ' '.$convert($n % 1_000_000) : '');
        };

        return $convert($n);
    }
}
