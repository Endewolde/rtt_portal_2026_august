<?php

namespace App\Services;

use App\Models\DefenceSession;
use App\Models\Proposal;
use App\Models\ReviewAssignment;
use App\Models\User;
use App\Support\PdfAssets;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The official record of an open defence: when and where it was held, the panel, each
 * panel member's score and comments, the combined result and the outcome — ready to sign
 * and file, so nobody has to write minutes by hand.
 */
class DefenceRecordService
{
    public function __construct(private ReviewScoreService $scores) {}

    /** @return array<string, mixed>|null null when the proposal never had a defence */
    public function data(Proposal $proposal): ?array
    {
        $session = DefenceSession::where('proposal_id', $proposal->id)->latest()->first();
        if (! $session) {
            return null;
        }

        $proposal->loadMissing(['pi:id,name,title', 'college:id,name', 'department:id,name', 'activeMembers.user:id,name,title']);

        $panel = ReviewAssignment::with(['reviewer:id,name,title', 'scores.evaluationQuestion:id,question_text'])
            ->where('proposal_id', $proposal->id)
            ->whereHas('evaluationType', fn ($q) => $q->where('name', 'like', 'open_defence%'))
            ->whereNotIn('status', ['declined', 'cancelled'])
            ->orderBy('assigned_at')
            ->get()
            ->map(function (ReviewAssignment $a) {
                $submitted = $a->status === 'submitted';
                $display = $submitted ? $this->scores->calculateWeightedDisplay($a) : null;

                return [
                    'name' => $this->fullName($a->reviewer),
                    'submitted' => $submitted,
                    'submitted_at' => $a->submitted_at,
                    'score' => $display['score'] ?? null,
                    'max' => $display['max'] ?? null,
                    'comments' => $a->scores->pluck('comment')->filter()->values()->all(),
                    'recommendation' => $a->scores->pluck('recommendation')->filter()->last(),
                ];
            });

        $snapshot = $this->scores->recalculateSnapshot($proposal);

        return [
            'session' => $session,
            'proposal' => $proposal,
            'pi' => $this->fullName($proposal->pi),
            'team' => $proposal->activeMembers->map(fn ($m) => $this->fullName($m->user))->filter()->reject(fn ($n) => $n === $this->fullName($proposal->pi))->values()->all(),
            'panel' => $panel,
            'snapshot' => $snapshot,
            'outcome' => Proposal::statusLabel($proposal->status),
        ];
    }

    /** @throws \RuntimeException */
    public function pdf(Proposal $proposal, User $generatedBy): Response
    {
        $data = $this->data($proposal);
        if (! $data) {
            throw new \RuntimeException('This proposal has no open defence session yet.');
        }

        $settings = DB::table('app_settings')->whereIn('key', ['organization_name', 'system_logo'])->pluck('value', 'key');

        return Pdf::loadView('pdf.defence_record', $data + [
            'orgName' => $settings['organization_name'] ?? 'Wolaita Sodo University',
            'logo' => PdfAssets::embeddedImage($settings['system_logo'] ?? null),
            'generatedBy' => $this->fullName($generatedBy),
            'generatedAt' => now(),
        ])->setPaper('a4')->download('defence-record-'.Str::slug($proposal->tracker_number).'.pdf');
    }

    private function fullName(?User $user): ?string
    {
        return $user ? trim(($user->title ? $user->title.' ' : '').$user->name) : null;
    }
}
