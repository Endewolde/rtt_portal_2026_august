<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnnualReportService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class AnnualReportController extends Controller
{
    public function __construct(private readonly AnnualReportService $service) {}

    public function preview(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('annual_report.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        [$startYear, $endYear] = $this->parseAcademicYear($request->query('academic_year'));

        return response()->json([
            'data' => $this->service->compile($startYear, $endYear),
            'message' => 'Report data compiled.',
            'errors' => [],
        ]);
    }

    public function download(Request $request): Response|JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('annual_report.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        [$startYear, $endYear] = $this->parseAcademicYear($request->query('academic_year'));

        $data = $this->service->compile($startYear, $endYear);

        $data['org_name'] = DB::table('app_settings')
            ->where('key', 'organization_name')
            ->value('value') ?? 'University';

        $pdf = Pdf::loadView('pdf.annual-report', $data)
            ->setPaper('a4', 'portrait')
            ->setOption('defaultFont', 'DejaVu Sans');

        return $pdf->download("RTT-Annual-Report-{$startYear}-{$endYear}.pdf");
    }

    /** @return array{int, int} */
    private function parseAcademicYear(?string $raw): array
    {
        $currentYear = now()->year;

        if ($raw && preg_match('/^(\d{4})-(\d{4})$/', $raw, $m)) {
            $start = (int) $m[1];
            $end = (int) $m[2];

            if ($end === $start + 1 && $start >= 2020 && $start <= 2049) {
                return [$start, $end];
            }
        }

        return [$currentYear, $currentYear + 1];
    }
}
