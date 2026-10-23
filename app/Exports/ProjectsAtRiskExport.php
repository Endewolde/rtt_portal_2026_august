<?php

namespace App\Exports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\WithMultipleSheets;

/** Projects at risk workbook: a summary, one row per project, and one row per warning. */
class ProjectsAtRiskExport implements WithMultipleSheets
{
    /**
     * @param  Collection<int, array<string, mixed>>  $projects  ProjectRiskService::assess()
     * @param  array<string, mixed>  $summary  ProjectRiskService::summary()
     * @param  list<string>  $scope
     */
    public function __construct(
        private readonly Collection $projects,
        private readonly array $summary,
        private readonly array $scope,
    ) {}

    public function sheets(): array
    {
        return [
            new ProjectsAtRiskSummarySheet($this->projects, $this->summary, $this->scope),
            new ProjectsAtRiskProjectsSheet($this->projects),
            new ProjectsAtRiskWarningsSheet($this->projects),
        ];
    }
}
