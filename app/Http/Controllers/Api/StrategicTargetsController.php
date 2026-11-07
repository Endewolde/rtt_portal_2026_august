<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Services\StrategicTargetsService;
use App\Support\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The year's strategic targets beside what has been achieved. */
class StrategicTargetsController extends Controller
{
    public function __construct(private StrategicTargetsService $targets) {}

    public function index(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('targets.view'), 403);
        $year = $this->year($request);

        return response()->json(['data' => $this->targets->report($year) + [
            'can_manage' => $request->user()->can('targets.manage'),
        ], 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function update(Request $request): JsonResponse
    {
        abort_unless($request->user()->can('targets.manage'), 403);
        $data = $request->validate([
            'academic_year' => ['required', 'regex:/^\d{4}-\d{4}$/'],
            'targets' => 'required|array',
            'targets.*' => 'nullable|numeric|min:0|max:999999999999',
        ]);
        $this->targets->save($data['academic_year'], $data['targets'], $request->user()->id);
        AuditLogger::log('targets.updated', 'StrategicTarget', $data['academic_year'], $request->user()->id, null, ['target_name' => $data['academic_year']] + $data['targets'], 200);

        return response()->json(['data' => $this->targets->report($data['academic_year']), 'message' => 'Targets saved.', 'errors' => [], 'meta' => []]);
    }

    private function year(Request $request): string
    {
        $year = (string) $request->query('academic_year', '');

        return preg_match('/^\d{4}-\d{4}$/', $year)
            ? $year
            : (AppSetting::where('key', 'current_academic_year')->value('value') ?: now()->subMonths(8)->format('Y').'-'.now()->subMonths(8)->addYear()->format('Y'));
    }
}
