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

    /** The signed-in reviewer's years: completed reviews, release status, eligibility. */
    public function index(Request $request): JsonResponse
    {
        return $this->ok($this->certificates->summary($request->user()));
    }

    public function download(Request $request): Response|JsonResponse
    {
        // Query parameter, not a path segment: academic years can contain "/".
        $academicYear = (string) $request->validate(['academic_year' => 'required|string|max:20'])['academic_year'];

        try {
            $certificate = $this->certificates->downloadable($request->user(), $academicYear);
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 404);
        }

        return $this->certificates->pdf($certificate->load('user'));
    }

    /** Central office: one academic year's reviewers, eligibility, and issued certificates. */
    public function overview(Request $request): JsonResponse
    {
        if (! $request->user()?->can('review_certificates.manage')) {
            return $this->forbidden();
        }

        $academicYear = $request->validate(['academic_year' => 'nullable|string|max:20'])['academic_year'] ?? null;

        return $this->ok($this->certificates->overview($academicYear));
    }

    public function release(Request $request): JsonResponse
    {
        if (! $request->user()?->can('review_certificates.manage')) {
            return $this->forbidden();
        }

        $academicYear = (string) $request->validate(['academic_year' => 'required|string|max:20'])['academic_year'];

        try {
            $release = $this->certificates->release($academicYear, $request->user());
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        return $this->ok(
            $this->certificates->overview($academicYear),
            "Released {$release->certificates_issued} certificate".($release->certificates_issued === 1 ? '' : 's')." for {$academicYear}. Reviewers have been notified."
        );
    }

    /** Withdraw every certificate of a released year at once, e.g. when the release was a mistake. */
    public function close(Request $request): JsonResponse
    {
        if (! $request->user()?->can('review_certificates.manage')) {
            return $this->forbidden();
        }

        $validated = $request->validate([
            'academic_year' => 'required|string|max:20',
            'reason' => 'required|string|min:10|max:500',
        ]);

        try {
            $this->certificates->close($validated['academic_year'], $request->user(), $validated['reason']);
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        return $this->ok($this->certificates->overview($validated['academic_year']), "Certificates for {$validated['academic_year']} are closed. Reviewers have been notified.");
    }

    public function reopen(Request $request): JsonResponse
    {
        if (! $request->user()?->can('review_certificates.manage')) {
            return $this->forbidden();
        }

        $academicYear = (string) $request->validate(['academic_year' => 'required|string|max:20'])['academic_year'];

        try {
            $this->certificates->reopen($academicYear);
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        return $this->ok($this->certificates->overview($academicYear), "Certificates for {$academicYear} are open again. Reviewers have been notified.");
    }

    public function revoke(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('review_certificates.manage')) {
            return $this->forbidden();
        }

        $reason = (string) $request->validate(['reason' => 'required|string|min:10|max:500'])['reason'];
        $certificate = ReviewCertificate::with('user')->findOrFail($id);

        try {
            $this->certificates->revoke($certificate, $request->user(), $reason);
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        return $this->ok($this->certificates->overview($certificate->academic_year), 'Certificate revoked. The reviewer has been notified.');
    }

    public function reinstate(Request $request, string $id): JsonResponse
    {
        if (! $request->user()?->can('review_certificates.manage')) {
            return $this->forbidden();
        }

        $certificate = ReviewCertificate::with('user')->findOrFail($id);

        try {
            $this->certificates->reinstate($certificate);
        } catch (\RuntimeException $e) {
            return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
        }

        return $this->ok($this->certificates->overview($certificate->academic_year), 'Certificate reinstated.');
    }

    /** Public: confirm a certificate is genuine (name, year, counts — nothing confidential). */
    public function verify(string $code): JsonResponse
    {
        $certificate = ReviewCertificate::with(['user:id,name,title', 'release'])->where('code', strtoupper($code))->first();

        // Only certificates of a released year were ever valid.
        if (! $certificate || ! $certificate->release) {
            return response()->json(['data' => null, 'message' => 'No certificate with this number was found.', 'errors' => [], 'meta' => []], 404);
        }

        return $this->ok([
            'code' => $certificate->code,
            'status' => $certificate->isRevoked() ? 'revoked' : ($certificate->release->isClosed() ? 'withdrawn' : 'valid'),
            'reviewer' => trim(($certificate->user->title ? $certificate->user->title.' ' : '').$certificate->user->name),
            'academic_year' => $certificate->academic_year,
            'blind_reviews' => $certificate->blind_reviews,
            'defence_reviews' => $certificate->defence_reviews,
            'total' => $certificate->total(),
            'issued_at' => $certificate->issued_at->toIso8601String(),
            'revoked_at' => $certificate->revoked_at?->toIso8601String(),
            'withdrawn_at' => $certificate->release->closed_at?->toIso8601String(),
        ]);
    }

    private function ok(mixed $data, string $message = ''): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json(['data' => null, 'message' => 'Unauthorized.', 'errors' => [], 'meta' => []], 403);
    }
}
