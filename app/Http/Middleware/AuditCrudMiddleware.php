<?php

namespace App\Http\Middleware;

use App\Support\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AuditCrudMiddleware
{
    private const SKIP_PATHS = [
        'auth/login', 'auth/logout', 'auth/register',
        'auth/forgot-password', 'auth/reset-password',
        'auth/2fa', 'auth/avatar', 'auth/telegram',
        'health',
        'notifications', 'settings/clear-cache',
        'settings/upload-editor-image',
        'system-monitor/preferences',
        'feedback',
        // Every mutating user-management action already writes its own detailed,
        // target-identified audit_logs entry (see UserController) — old_values,
        // new_values, and who it was actually done TO. Leaving this path unskipped
        // means this generic middleware ALSO writes a second, less useful entry
        // (raw request body, no target name, old_values always null) under the exact
        // same event name — a same-second duplicate that displaces the real one
        // whenever the log is queried "latest first".
        'users',
    ];

    // Map URI path segments → human-readable resource label
    private const RESOURCE_MAP = [
        'proposals' => 'Proposal',
        'proposal-calls' => 'ProposalCall',
        'users' => 'User',
        'colleges' => 'College',
        'departments' => 'Department',
        'roles' => 'Role',
        'reviews' => 'Review',
        'review-assignments' => 'ReviewAssignment',
        'defence-sessions' => 'DefenceSession',
        'budget-requests' => 'BudgetRequest',
        'budget-allocations' => 'BudgetAllocation',
        'settlements' => 'Settlement',
        'disbursements' => 'Disbursement',
        'awards' => 'Award',
        'complaints' => 'Complaint',
        'midterm-evaluations' => 'MidtermEvaluation',
        'completion-workshops' => 'CompletionWorkshop',
        'research-outputs' => 'ResearchOutput',
        'thematic-areas' => 'ThematicArea',
        'reports' => 'Report',
        'settings' => 'Setting',
        'features' => 'Feature',
        'external-funds' => 'ExternalFund',
        'repository' => 'Repository',
        'appeals' => 'Appeal',
        'validation' => 'Validation',
        'conferences' => 'Conference',
        'abstracts' => 'ConferenceAbstract',
        'funding-rounds' => 'FundingRound',
        'programmes' => 'Programme',
        'ongoing-proposals' => 'Proposal',
    ];

    /** Path prefixes that only group routes and say nothing about the record. */
    private const NAMESPACES = ['admin', 'reviewer', 'my', 'me'];

    // Map HTTP method + terminal action segment → verb
    private const ACTION_VERBS = [
        'approve' => 'approved',
        'reject' => 'rejected',
        'return' => 'returned_for_correction',
        'validate' => 'validated',
        'submit' => 'submitted',
        'close' => 'closed',
        'reopen' => 'reopened',
        'revoke' => 'revoked',
        'disburse' => 'disbursed',
        'settle' => 'settled',
        'finalize' => 'finalized',
        'verify' => 'verified',
        'publish' => 'published',
        'unpublish' => 'unpublished',
        'sign' => 'signed',
        'resolve' => 'resolved',
        'escalate' => 'escalated',
        'respond' => 'responded',
        'schedule' => 'scheduled',
        'bulk-approve' => 'bulk_approved',
        'bulk-schedule' => 'bulk_scheduled',
        'process-result' => 'result_processed',
        'add-reviewer' => 'reviewer_added',
        'assign' => 'assigned',
        'reassign' => 'reassigned',
        'remove' => 'removed',
        'extend' => 'extended',
        'score' => 'scored',
        'appeal' => 'appealed',
        'impersonate' => 'impersonated',
        'status' => 'status_changed',
        'role' => 'role_changed',
        'roles' => 'roles_changed',
        'permissions' => 'permissions_changed',
        'quick-allocate' => 'quick_allocated',
        'guidelines' => 'guidelines_updated',
        'award-details' => 'award_details_updated',
        'draft' => 'draft_created',
        'documents' => 'document_uploaded',
        'evidence' => 'evidence_uploaded',
        'upload-report' => 'report_uploaded',
        'upload-asset' => 'asset_uploaded',
        'send-email' => 'broadcast_email_sent',
        'test-email' => 'test_email_sent',
        'run-backup' => 'backup_run',
        'toggle-maintenance' => 'maintenance_toggled',
        'generate-token' => 'token_generated',
        'bulk' => 'bulk_updated',
        'import' => 'imported',
        'generate' => 'generated',
        'central' => 'central_decision',
        'funding' => 'funding_changed',
    ];

    /** Read requests that take data away (files, exports) are recorded too. */
    private const DATA_OUT_SEGMENTS = [
        'export' => 'exported', 'exports' => 'exported', 'csv' => 'exported', 'excel' => 'exported',
        'download' => 'downloaded', 'pdf' => 'downloaded', 'print' => 'downloaded', 'backup' => 'downloaded',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        try {
            $this->record($request, $response);
        } catch (\Throwable $e) {
            // The audit trail must never break the action itself.
            report($e);
        }

        return $response;
    }

    private function record(Request $request, Response $response): void
    {
        $method = strtoupper($request->method());
        $status = $response->getStatusCode();
        $path = preg_replace('#^api/v1/#', '', ltrim($request->path(), '/'));
        $mutating = in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true);
        $lastSegment = Str::lower((string) Str::of($path)->explode('/')->last());
        $dataOut = $method === 'GET' ? (self::DATA_OUT_SEGMENTS[$lastSegment] ?? null) : null;

        // What is worth keeping: changes that went through, changes that were refused
        // for lack of permission, and data that left the system.
        $denied = $mutating && $status === 403;
        if (! ($mutating && $status < 400) && ! $denied && ! ($dataOut && $status < 400)) {
            return;
        }

        foreach (self::SKIP_PATHS as $skip) {
            if (str_starts_with($path, $skip) && ! $denied && ! $dataOut) {
                return;
            }
        }

        [$resource, $resourceId, $action] = $this->parseRoute($path, $method, $request);

        $event = match (true) {
            $denied => Str::snake($resource).'.denied',
            $dataOut !== null => Str::snake($resource).'.'.$dataOut,
            default => $this->buildEvent($resource, $action, $method),
        };

        $newValues = $mutating
            ? $this->filterBody($request->except(AuditLogger::SENSITIVE_FIELDS))
            : ($request->query() ? $this->filterBody($request->query()) : null);

        if ($denied) {
            $newValues = ['attempted' => $this->buildEvent($resource, $action, $method)] + ($newValues ?? []);
        }

        AuditLogger::log(
            event: $event,
            auditableType: $resource,
            auditableId: $resourceId ?? 'system',
            actorId: $request->user()?->id,
            newValues: $newValues,
            statusCode: $status,
        );
    }

    private function parseRoute(string $path, string $method, Request $request): array
    {
        // Split path into segments, treating UUIDs/IDs as resource identifiers
        $segments = explode('/', $path);
        $resource = 'Unknown';
        $resourceId = null;
        $actions = [];
        $uuidPattern = '/^[0-9a-f\-]{36}$|^\d+$/i';

        foreach ($segments as $i => $seg) {
            if ($i === 0 && in_array($seg, self::NAMESPACES, true) && count($segments) > 1) {
                continue;
            }
            if (preg_match($uuidPattern, $seg)) {
                $resourceId ??= $seg;
            } elseif (isset(self::RESOURCE_MAP[$seg])) {
                if ($resource === 'Unknown') {
                    $resource = self::RESOURCE_MAP[$seg];
                } else {
                    $actions[] = $seg;
                }
            } else {
                $actions[] = $seg;
            }
        }

        // Last non-empty action segment determines the verb
        $action = end($actions) ?: null;

        // Fallback: use the first segment as resource label
        $first = in_array($segments[0] ?? '', self::NAMESPACES, true) && isset($segments[1]) ? $segments[1] : ($segments[0] ?? '');
        if ($resource === 'Unknown' && $first !== '') {
            $resource = Str::studly(str_replace('-', '_', $first));
        }

        return [$resource, $resourceId, $action];
    }

    private function buildEvent(string $resource, ?string $action, string $method): string
    {
        $resourceSlug = Str::snake($resource);

        if ($action && isset(self::ACTION_VERBS[$action])) {
            return "{$resourceSlug}.".self::ACTION_VERBS[$action];
        }

        $verb = match ($method) {
            'POST' => 'created',
            'PUT', 'PATCH' => 'updated',
            'DELETE' => 'deleted',
            default => 'changed',
        };

        return "{$resourceSlug}.{$verb}";
    }

    private function filterBody(array $body): ?array
    {
        if (empty($body)) {
            return null;
        }

        // Truncate very long text fields and replace file objects with metadata
        array_walk_recursive($body, function (&$value) {
            if ($value instanceof UploadedFile) {
                $value = '[file: '.$value->getClientOriginalName().']';
            } elseif (is_object($value)) {
                $value = '[object]';
            } elseif (is_string($value) && mb_strlen($value) > 500) {
                $value = mb_substr($value, 0, 500).'…';
            }
        });

        return $body;
    }
}
