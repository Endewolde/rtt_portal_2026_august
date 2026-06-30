<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AuditCrudMiddleware
{
    private const SKIP_PATHS = [
        'auth/login', 'auth/logout', 'auth/register',
        'auth/forgot-password', 'auth/reset-password',
        'auth/2fa', 'auth/avatar', 'auth/telegram',
        'health', 'audit-logs',
        'notifications', 'settings/clear-cache',
        'settings/upload-editor-image',
        'system-monitor/preferences',
        'feedback',
    ];

    private const SENSITIVE_FIELDS = [
        'password', 'password_confirmation', 'token', 'secret',
        'current_password', 'new_password',
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
    ];

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

    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $method = strtoupper($request->method());

        // Only log mutating operations
        if (! in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            return $response;
        }

        // Skip non-successful responses (4xx/5xx)
        $statusCode = $response->getStatusCode();
        if ($statusCode >= 400) {
            return $response;
        }

        $path = ltrim($request->path(), '/');
        $path = preg_replace('#^api/v1/#', '', $path);

        // Skip noisy or sensitive paths
        foreach (self::SKIP_PATHS as $skip) {
            if (str_starts_with($path, $skip)) {
                return $response;
            }
        }

        $actor = $request->user();
        if (! $actor) {
            return $response;
        }

        [$resource, $resourceId, $action] = $this->parseRoute($path, $method, $request);

        $event = $this->buildEvent($resource, $action, $method);

        $newValues = $this->filterBody($request->except(self::SENSITIVE_FIELDS));

        DB::table('audit_logs')->insert([
            'id' => Str::uuid()->toString(),
            'auditable_type' => $resource,
            'auditable_id' => $resourceId ?? 'system',
            'event' => $event,
            'actor_id' => $actor->id,
            'old_values' => null,
            'new_values' => $newValues ? json_encode($newValues) : null,
            'ip_address' => $request->ip() ?? '127.0.0.1',
            'user_agent' => $request->userAgent() ?? '',
            'created_at' => now(),
        ]);

        return $response;
    }

    private function parseRoute(string $path, string $method, Request $request): array
    {
        // Split path into segments, treating UUIDs/IDs as resource identifiers
        $segments = explode('/', $path);
        $resource = 'Unknown';
        $resourceId = null;
        $actions = [];
        $uuidPattern = '/^[0-9a-f\-]{36}$|^\d+$/i';

        foreach ($segments as $seg) {
            if (preg_match($uuidPattern, $seg)) {
                $resourceId = $seg;
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
        if ($resource === 'Unknown' && ! empty($segments[0])) {
            $resource = Str::studly(str_replace('-', '_', $segments[0]));
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
