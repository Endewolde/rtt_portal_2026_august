<?php

namespace App\Services;

use App\Models\CommunityImpact;
use App\Models\ConferencePresentation;
use App\Models\Patent;
use App\Models\Proposal;
use App\Models\Publication;
use App\Models\RepositoryRecord;
use App\Models\ResearchOutput;
use App\Models\Technology;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class ResearchOutputService
{
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
        $allowedStatuses = ['funded', 'midterm_evaluation', 'completed', 'archived'];

        if (! in_array($proposal->status, $allowedStatuses)) {
            throw new \Exception(
                "Cannot record output for proposal in status: {$proposal->status}"
            );
        }

        return DB::transaction(function () use ($proposal, $type, $data, $recordedBy) {
            $output = ResearchOutput::create([
                'proposal_id' => $proposal->id,
                'output_type' => $type,
                'title'       => $data['title'],
                'description' => $data['description'] ?? null,
                'recorded_by' => $recordedBy->id,
            ]);

            $this->createTypeRecord($output->id, $type, $data);
            $this->updateRepositoryRecord($proposal);

            $centralOfficer = User::role('central_officer')->first();
            if ($centralOfficer) {
                $this->notificationService->send('output_recorded', $centralOfficer, [
                    'tracker_number' => $proposal->tracker_number,
                    'output_type'    => $type,
                    'title'          => $data['title'],
                ]);
            }

            return $output->fresh();
        });
    }

    private function createTypeRecord(string $outputId, string $type, array $data): void
    {
        $pick = fn (array $keys) => array_merge(
            ['research_output_id' => $outputId],
            array_intersect_key($data, array_flip($keys))
        );

        match ($type) {
            'journal_article'  => Publication::create($pick(['doi', 'journal_name', 'volume', 'issue', 'pages', 'year', 'publisher', 'is_scopus_indexed', 'is_wos_indexed', 'file_path'])),
            'conference_paper' => ConferencePresentation::create($pick(['conference_name', 'location', 'presentation_date', 'proceedings_isbn', 'doi', 'file_path'])),
            'patent'           => Patent::create($pick(['patent_number', 'jurisdiction', 'filing_date', 'grant_date', 'status', 'technical_specs', 'file_path'])),
            'software'         => Technology::create($pick(['version', 'repository_url', 'license', 'demo_url', 'technical_specs', 'file_path'])),
            'community_impact' => CommunityImpact::create($pick(['beneficiary_count', 'location', 'impact_category', 'evidence_file_path'])),
            default            => null,
        };
    }

    private function updateRepositoryRecord(Proposal $proposal): void
    {
        $record = RepositoryRecord::where('proposal_id', $proposal->id)->first();

        if (! $record) {
            return;
        }

        $record->update([
            'total_outputs'      => ResearchOutput::where('proposal_id', $proposal->id)->count(),
            'publications_count' => ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'journal_article')->count(),
            'patents_count'      => ResearchOutput::where('proposal_id', $proposal->id)->where('output_type', 'patent')->count(),
        ]);
    }
}
