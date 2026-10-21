<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Proposal;
use App\Models\ProposalClosureChecklist;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ClosureChecklistController extends Controller
{
    /** Get (or lazily create) the closure checklist for a proposal. */
    public function show(string $proposalId, Request $request): JsonResponse
    {
        if (! $request->user()?->can('closure.view')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        Proposal::findOrFail($proposalId);

        $checklist = ProposalClosureChecklist::firstOrCreate(
            ['proposal_id' => $proposalId],
            ['items' => ProposalClosureChecklist::defaultItems()]
        );

        return response()->json(['data' => $this->present($checklist)]);
    }

    /** Toggle one checklist item. */
    public function update(string $proposalId, Request $request): JsonResponse
    {
        if (! $request->user()?->can('closure.view')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'key' => ['required', 'string', 'in:'.implode(',', ProposalClosureChecklist::ITEM_KEYS)],
            'checked' => ['required', 'boolean'],
        ]);

        Proposal::findOrFail($proposalId);

        $checklist = ProposalClosureChecklist::firstOrCreate(
            ['proposal_id' => $proposalId],
            ['items' => ProposalClosureChecklist::defaultItems()]
        );

        $items = array_merge(ProposalClosureChecklist::defaultItems(), $checklist->items ?? []);
        $items[$validated['key']] = $validated['checked'];

        $checklist->update([
            'items' => $items,
            'updated_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $this->present($checklist->fresh()), 'message' => 'Checklist updated.']);
    }

    private function present(ProposalClosureChecklist $checklist): array
    {
        return [
            'id' => $checklist->id,
            'proposal_id' => $checklist->proposal_id,
            'items' => array_merge(ProposalClosureChecklist::defaultItems(), $checklist->items ?? []),
            'is_complete' => $checklist->isComplete(),
            'updated_by' => $checklist->updatedBy?->only(['id', 'name']),
            'updated_at' => $checklist->updated_at,
        ];
    }
}
