<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Services\AnnualReportService;
use App\Support\PdfAssets;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

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

        // Years that actually have proposals, in the report's "YYYY-YYYY" form.
        $years = Proposal::query()->whereNotNull('academic_year')->where('academic_year', 'like', '____-____')
            ->distinct()->orderByDesc('academic_year')->pluck('academic_year');

        return response()->json([
            'data' => $this->service->compile($startYear, $endYear),
            'message' => 'Report data compiled.',
            'errors' => [],
            'meta' => ['academic_years' => $years],
        ], 200, [], JSON_INVALID_UTF8_SUBSTITUTE);
    }

    public function download(Request $request): Response|JsonResponse
    {
        $user = $request->user();

        if (! $user?->can('annual_report.view')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        [$startYear, $endYear] = $this->parseAcademicYear($request->query('academic_year'));

        $data = $this->service->compile($startYear, $endYear);

        $settings = DB::table('app_settings')->whereIn('key', ['organization_name', 'system_logo'])->pluck('value', 'key');
        $data['org_name'] = $settings['organization_name'] ?? 'University';
        $data['logo'] = PdfAssets::embeddedImage($settings['system_logo'] ?? null);

        $filename = "RTT-Annual-Report-{$startYear}-{$endYear}.pdf";

        // The Ethiopic font is prepared on first use (written to storage/fonts). If that
        // fails on a server, fall back to the standard fonts rather than no report at all.
        foreach ([false, true] as $standardFontsOnly) {
            try {
                return Pdf::loadView('pdf.annual-report', $data + ['standardFontsOnly' => $standardFontsOnly])
                    ->setPaper('a4', 'portrait')
                    ->setOption('defaultFont', 'DejaVu Sans')
                    ->download($filename);
            } catch (\Throwable $e) {
                Log::error('Annual report PDF '.($standardFontsOnly ? 'with standard fonts ' : '')."failed for {$startYear}-{$endYear}: {$e->getMessage()}", ['exception' => $e]);
            }
        }

        return response()->json([
            'data' => null,
            'message' => 'The PDF could not be generated. The error has been logged for the administrator.',
            'errors' => [],
        ], 500);
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
