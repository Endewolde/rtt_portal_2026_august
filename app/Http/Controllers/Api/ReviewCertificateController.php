<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReviewCertificate;
use App\Services\ReviewCertificateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class ReviewCertificateController extends Controller
{
    public function __construct(private ReviewCertificateService $certificates) {}

    /** The signed-in reviewer's completed reviews per academic year. */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $issued = ReviewCertificate::where('user_id', $user->id)->pluck('code', 'academic_year');

        return response()->json([
            'data' => $this->certificates->summary($user)->map(fn ($year) => $year + ['code' => $issued[$year['academic_year']] ?? null])->values(),
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function download(Request $request): Response|JsonResponse
    {
        // Query parameter, not a path segment: academic years can contain "/".
        $academicYear = (string) $request->validate(['academic_year' => 'required|string|max:20'])['academic_year'];

        try {
            $certificate = $this->certificates->issue($request->user(), $academicYear);
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 404);
        }

        return $this->certificates->pdf($certificate->load('user'));
    }

    /** Public: confirm a certificate is genuine (name, year, counts — nothing confidential). */
    public function verify(string $code): JsonResponse
    {
        $certificate = ReviewCertificate::with('user:id,name,title')->where('code', strtoupper($code))->first();

        if (! $certificate) {
            return response()->json(['data' => null, 'message' => 'No certificate with this number was found.', 'errors' => [], 'meta' => []], 404);
        }

        return response()->json([
            'data' => [
                'code' => $certificate->code,
                'reviewer' => trim(($certificate->user->title ? $certificate->user->title.' ' : '').$certificate->user->name),
                'academic_year' => $certificate->academic_year,
                'blind_reviews' => $certificate->blind_reviews,
                'defence_reviews' => $certificate->defence_reviews,
                'total' => $certificate->total(),
                'issued_at' => $certificate->issued_at->toIso8601String(),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }
}
