<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ProposalArchiveController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        if (! $request->user()?->can('proposal_archive.view')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = DB::table('proposals')
            ->join('users as pi', 'proposals.pi_user_id', '=', 'pi.id')
            ->join('colleges', 'proposals.college_id', '=', 'colleges.id')
            ->join('departments', 'proposals.department_id', '=', 'departments.id')
            ->where('proposals.status', '!=', 'draft')
            ->whereNull('proposals.deleted_at')
            ->select([
                'proposals.id',
                'proposals.tracker_number',
                'proposals.title',
                'proposals.category',
                'proposals.status',
                'proposals.academic_year',
                'proposals.submitted_at',
                'proposals.abstract',
                'proposals.keywords',
                'pi.id as pi_id',
                'pi.name as pi_name',
                'pi.email as pi_email',
                'colleges.id as college_id',
                'colleges.name as college_name',
                'departments.id as department_id',
                'departments.name as department_name',
            ]);

        if ($ay = $request->query('academic_year')) {
            $query->where('proposals.academic_year', $ay);
        }

        if ($cat = $request->query('category')) {
            $query->where('proposals.category', $cat);
        }

        if ($collegeId = $request->query('college_id')) {
            $query->where('proposals.college_id', $collegeId);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('proposals.title', 'like', "%{$search}%")
                    ->orWhere('proposals.tracker_number', 'like', "%{$search}%")
                    ->orWhere('pi.name', 'like', "%{$search}%");
            });
        }

        $proposals = $query->orderByDesc('proposals.submitted_at')->paginate(20);

        $ids = collect($proposals->items())->pluck('id');

        $members = DB::table('proposal_members')
            ->join('users', 'proposal_members.user_id', '=', 'users.id')
            ->whereIn('proposal_members.proposal_id', $ids)
            ->where('proposal_members.status', 'active')
            ->select([
                'proposal_members.proposal_id',
                'proposal_members.role',
                'proposal_members.contribution_percentage',
                'users.id as user_id',
                'users.name',
                'users.email',
            ])
            ->get()
            ->groupBy('proposal_id');

        $documents = DB::table('proposal_documents')
            ->whereIn('proposal_id', $ids)
            ->select(['id', 'proposal_id', 'document_type', 'original_filename', 'file_size', 'mime_type', 'created_at'])
            ->get()
            ->groupBy('proposal_id');

        $items = collect($proposals->items())->map(function ($p) use ($members, $documents) {
            return array_merge((array) $p, [
                'members' => $members->get($p->id, collect())->values(),
                'documents' => $documents->get($p->id, collect())->values(),
            ]);
        });

        return response()->json([
            'data' => [
                'items' => $items,
                'current_page' => $proposals->currentPage(),
                'last_page' => $proposals->lastPage(),
                'total' => $proposals->total(),
                'per_page' => $proposals->perPage(),
            ],
        ]);
    }

    public function downloadDocument(Request $request, string $documentId): mixed
    {
        if (! $request->user()?->can('proposal_archive.view')) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $doc = DB::table('proposal_documents')->where('id', $documentId)->first();

        abort_unless($doc, 404, 'Document not found.');

        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('private');

        abort_unless($disk->exists($doc->stored_path), 404, 'File not found on disk.');

        return $disk->download($doc->stored_path, $doc->original_filename);
    }
}
