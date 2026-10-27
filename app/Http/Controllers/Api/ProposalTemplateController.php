<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProposalTemplate;
use App\Support\Programmes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProposalTemplateController extends Controller
{
    private const MAX_TEMPLATES_PER_USER = 20;

    /** PI saves the current wizard content as a reusable template. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'category' => ['required', Rule::in(Programmes::keys(true))],
            'title' => 'nullable|string|max:255',
            'abstract' => 'nullable|string',
            'keywords' => 'nullable|string|max:500',
            'focus_area' => 'nullable|string|max:255',
            'duration_months' => 'nullable|integer|min:1|max:120',
            'research_type' => 'nullable|string|max:100',
            'budget_items' => 'nullable|array',
            'budget_items.*.category' => 'required_with:budget_items|string|max:100',
            'budget_items.*.description' => 'required_with:budget_items|string|max:255',
            'budget_items.*.amount' => 'required_with:budget_items|numeric|min:0',
            'budget_items.*.justification' => 'nullable|string|max:1000',
        ]);

        $existingCount = ProposalTemplate::where('user_id', $request->user()->id)->count();
        if ($existingCount >= self::MAX_TEMPLATES_PER_USER) {
            return response()->json([
                'message' => 'You have reached the maximum of '.self::MAX_TEMPLATES_PER_USER.' saved templates. Delete one before saving another.',
            ], 422);
        }

        $template = ProposalTemplate::create([
            'user_id' => $request->user()->id,
            'category' => $validated['category'],
            'name' => $validated['name'],
            'template_data' => [
                'title' => $validated['title'] ?? '',
                'abstract' => $validated['abstract'] ?? '',
                'keywords' => $validated['keywords'] ?? '',
                'focus_area' => $validated['focus_area'] ?? '',
                'duration_months' => $validated['duration_months'] ?? null,
                'research_type' => $validated['research_type'] ?? '',
                'budget_items' => $validated['budget_items'] ?? [],
            ],
        ]);

        return response()->json(['data' => $template, 'message' => 'Template saved.'], 201);
    }

    /** PI's own saved templates, optionally filtered by category. */
    public function index(Request $request): JsonResponse
    {
        $templates = ProposalTemplate::where('user_id', $request->user()->id)
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->category))
            ->orderByDesc('created_at')
            ->get();

        return response()->json(['data' => $templates]);
    }

    /** PI deletes one of their own templates. */
    public function destroy(string $id, Request $request): JsonResponse
    {
        $template = ProposalTemplate::findOrFail($id);

        if ($template->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $template->delete();

        return response()->json(['message' => 'Template deleted.']);
    }
}
