<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DashboardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private DashboardService $service) {}

    public function index(Request $request): JsonResponse
    {
        $widgets = $this->service->getWidgets($request->user());

        return response()->json(['data' => $widgets]);
    }

    public function widget(string $name, Request $request): JsonResponse
    {
        $widgets = $this->service->getWidgets($request->user());

        if (! array_key_exists($name, $widgets)) {
            return response()->json(['message' => "Widget '{$name}' not available for your role."], 404);
        }

        return response()->json(['data' => $widgets[$name]]);
    }
}
