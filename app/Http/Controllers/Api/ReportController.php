<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ReportSnapshot;
use App\Services\ReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private ReportService $service) {}

    public function index(Request $request): JsonResponse
    {
        $snapshots = ReportSnapshot::where('requested_by', $request->user()->id)
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json(['data' => $snapshots]);
    }

    public function generate(Request $request): JsonResponse
    {
        $request->validate(['type' => 'required|string']);

        $snapshot = $this->service->generate(
            $request->type,
            $request->input('filters', []),
            $request->user()
        );

        $status = $snapshot->status === 'processing' ? 202 : 200;

        return response()->json(['data' => $snapshot], $status);
    }

    public function show(string $id): JsonResponse
    {
        $snapshot = ReportSnapshot::findOrFail($id);

        return response()->json(['data' => $snapshot]);
    }
}
