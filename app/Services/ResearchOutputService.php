<?php

namespace App\Services;

use App\Models\Patent;
use App\Models\Proposal;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ResearchOutputService
{
    /** Projects that can have outputs recorded: funded, at mid-term, completed or archived. */
    public const RECORDABLE_STATUSES = ['funded', 'midterm_evaluation', 'completed', 'archived'];

    /** The detail record each output type keeps, and its fields. */
    private const TYPE_RECORDS = [
        'journal_article' => ['publication', ['doi', 'journal_name', 'volume', 'issue', 'pages', 'year', 'publisher', 'is_scopus_indexed', 'is_wos_indexed', 'file_path']],
        'book' => ['publication', ['doi', 'journal_name', 'volume', 'issue', 'pages', 'year', 'publisher', 'is_scopus_indexed', 'is_wos_indexed', 'file_path']],
        'conference_paper' => ['conferencePresentation', ['conference_name', 'location', 'presentation_date', 'proceedings_isbn', 'doi', 'file_path']],
        'patent' => ['patent', ['patent_number', 'jurisdiction', 'filing_date', 'grant_date', 'status', 'technical_specs', 'file_path']],
        'software' => ['technology', ['version', 'repository_url', 'license', 'demo_url', 'technical_specs', 'file_path']],
        'community_impact' => ['communityImpact', ['beneficiary_count', 'location', 'impact_category', 'evidence_file_path']],
    ];

    public function __construct(
        private NotificationService $notificationService
    ) {}

    /**
     * Record a research output for a proposal.
     *
     * @throws \Exception
     */
    public function record(
        Proposal $proposal,
        string $type,
        array $data,
        User $recordedBy
    ): ResearchOutput {
        if (! in_array($proposal->status, self::RECORDABLE_STATUSES)) {
            throw new \Exception(
                "Cannot record output for proposal in status: {$proposal->status}"
            );
        }

        return DB::transaction(function () use ($proposal, $type, $data, $recordedBy) {
            $output = ResearchOutput::create([
                'proposal_id' => $proposal->id,
                'output_type' => $type,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'recorded_by' => $recordedBy->id,
            ]);

            $this->createTypeRecord($output->id, $type, $data);
            $this->updateRepositoryRecord($proposal);

            $centralOfficer = User::role('central_officer')->first();
            if ($centralOfficer) {
                $this->notificationService->send('output_recorded', $centralOfficer, [
                    'tracker_number' => $proposal->tracker_number,
                    'output_type' => $type,
                    'title' => $data['title'],
                ]);
            }

            return $output->fresh();
        });
    }

    private function createTypeRecord(string $outputId, string $type, array $data): void
    {
        [$relation, $fields] = self::TYPE_RECORDS[$type] ?? [null, []];
        if (! $relation) {
            return;
        }

        ResearchOutput::find($outputId)->{$relation}()->create(array_intersect_key($this->withPatentStatus($data), array_flip($fields)));
    }

    /** The form calls a patent's status patent_status; the patent record calls it status. */
    private function withPatentStatus(array $data): array
    {
        if (array_key_exists('patent_status', $data)) {
            $data['status'] = $data['patent_status'];
        }

        return $data;
    }

    /** Save changed details (DOI, journal, patent number…) on an output's detail record. */
    public function updateDetails(ResearchOutput $output, array $data): void
    {
        [$relation, $fields] = self::TYPE_RECORDS[$output->output_type] ?? [null, []];
        $changes = array_intersect_key($this->withPatentStatus($data), array_flip($fields));
        if (! $relation || ! $changes) {
            return;
        }

        $record = $output->{$relation};
        $record ? $record->update($changes) : $output->{$relation}()->create($changes);
    }

    private function updateRepositoryRecord(Proposal $proposal): void
    {
        $record = RepositoryRecord::where('proposal_id', $proposal->id)->first();

        if (! $record) {
            return;
        }

        $record->update([
            'total_outputs' => ResearchOutput::where('proposal_id', $proposal->id)->count(),
            'publications_count' => ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'journal_article')->count(),
            'patents_count' => ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'patent')->count(),
        ]);
    }
}
