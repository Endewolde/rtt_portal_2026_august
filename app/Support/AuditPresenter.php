<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\Award;
use App\Models\BudgetRequest;
use App\Models\BudgetSettlement;
use App\Models\College;
use App\Models\Complaint;
use App\Models\Conference;
use App\Models\ConferenceAbstract;
use App\Models\DefenceSession;
use App\Models\Department;
use App\Models\Disbursement;
use App\Models\EvaluationType;
use App\Models\ExternalFundAgency;
use App\Models\ExternalFundApplication;
use App\Models\ExternalFundAward;
use App\Models\ExternalFundOpportunity;
use App\Models\FundingRound;
use App\Models\Mentorship;
use App\Models\MidtermEvaluation;
use App\Models\Programme;
use App\Models\Proposal;
use App\Models\ProposalAppeal;
use App\Models\ProposalCall;
use App\Models\ResearchOutput;
use App\Models\ReviewAssignment;
use App\Models\ThematicArea;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Turns raw audit rows into plain language for people: "Abebe Kebede (abebe@uni.edu)
 * approved the proposal “Soil health in Wolaita”", with every ID in the stored data
 * replaced by the name or title it points to. All lookups for a page happen in one
 * query per kind of record.
 */
class AuditPresenter
{
    /** kind => [model class, label] */
    private const KINDS = [
        'user' => [User::class, 'user account'],
        'proposal' => [Proposal::class, 'proposal'],
        'call' => [ProposalCall::class, 'proposal call'],
        'college' => [College::class, 'college'],
        'department' => [Department::class, 'department'],
        'programme' => [Programme::class, 'programme'],
        'thematic_area' => [ThematicArea::class, 'thematic area'],
        'conference' => [Conference::class, 'conference'],
        'abstract' => [ConferenceAbstract::class, 'abstract'],
        'award' => [Award::class, 'award'],
        'budget_request' => [BudgetRequest::class, 'budget request'],
        'settlement' => [BudgetSettlement::class, 'settlement'],
        'disbursement' => [Disbursement::class, 'disbursement'],
        'defence_session' => [DefenceSession::class, 'defence session'],
        'complaint' => [Complaint::class, 'complaint'],
        'review_assignment' => [ReviewAssignment::class, 'review assignment'],
        'midterm' => [MidtermEvaluation::class, 'midterm evaluation'],
        'appeal' => [ProposalAppeal::class, 'appeal'],
        'mentorship' => [Mentorship::class, 'mentorship'],
        'research_output' => [ResearchOutput::class, 'research output'],
        'funding_round' => [FundingRound::class, 'funding round'],
        'ef_application' => [ExternalFundApplication::class, 'external fund application'],
        'ef_award' => [ExternalFundAward::class, 'external fund award'],
        'ef_agency' => [ExternalFundAgency::class, 'funding agency'],
        'ef_opportunity' => [ExternalFundOpportunity::class, 'funding opportunity'],
        'evaluation_type' => [EvaluationType::class, 'evaluation type'],
    ];

    /** Where an ID of unknown kind is looked for (older entries did not record the address). */
    private const PROBE = ['proposal', 'user', 'call', 'college', 'department', 'conference', 'abstract', 'funding_round', 'programme', 'ef_application', 'evaluation_type'];

    /** Address segment just before an ID → what the ID is. */
    private const SEGMENTS = [
        'users' => 'user', 'proposals' => 'proposal', 'proposal-calls' => 'call', 'calls' => 'call',
        'colleges' => 'college', 'departments' => 'department', 'programmes' => 'programme',
        'thematic-areas' => 'thematic_area', 'conferences' => 'conference', 'abstracts' => 'abstract',
        'awards' => 'award', 'budget-requests' => 'budget_request', 'settlements' => 'settlement',
        'disbursements' => 'disbursement', 'defence-sessions' => 'defence_session', 'complaints' => 'complaint',
        'review-assignments' => 'review_assignment', 'midterm-evaluations' => 'midterm', 'appeals' => 'appeal',
        'mentorships' => 'mentorship', 'research-outputs' => 'research_output', 'funding-rounds' => 'funding_round',
        'applications' => 'ef_application', 'agencies' => 'ef_agency', 'opportunities' => 'ef_opportunity',
    ];

    /** Stored record type (class or label) → kind, when the address does not say. */
    private const TYPES = [
        'User' => 'user', 'Proposal' => 'proposal', 'ProposalCall' => 'call', 'College' => 'college',
        'Department' => 'department', 'Programme' => 'programme', 'ThematicArea' => 'thematic_area',
        'Conference' => 'conference', 'ConferenceAbstract' => 'abstract', 'Award' => 'award',
        'BudgetRequest' => 'budget_request', 'Settlement' => 'settlement', 'BudgetSettlement' => 'settlement',
        'Disbursement' => 'disbursement', 'DefenceSession' => 'defence_session', 'Complaint' => 'complaint',
        'ReviewAssignment' => 'review_assignment', 'MidtermEvaluation' => 'midterm', 'Appeal' => 'appeal',
        'ProposalAppeal' => 'appeal', 'Mentorship' => 'mentorship', 'ResearchOutput' => 'research_output',
        'FundingRound' => 'funding_round', 'ExternalFundApplication' => 'ef_application',
        'ExternalFundAward' => 'ef_award', 'ExternalFundAgency' => 'ef_agency', 'ExternalFundOpportunity' => 'ef_opportunity',
    ];

    /** A field ending in _id / _ids → what it points to. */
    private const FIELDS = [
        'proposal' => 'proposal', 'user' => 'user', 'reviewer' => 'user', 'pi_user' => 'user', 'pi' => 'user',
        'member' => 'user', 'assigned_to' => 'user', 'supervisor' => 'user', 'mentor' => 'user', 'mentee' => 'user',
        'approved_by' => 'user', 'created_by' => 'user', 'recorded_by' => 'user', 'actor' => 'user', 'owner' => 'user',
        'complainant' => 'user', 'speaker' => 'user', 'college' => 'college', 'department' => 'department',
        'proposal_call' => 'call', 'call' => 'call', 'programme' => 'programme', 'thematic_area' => 'thematic_area',
        'conference' => 'conference', 'abstract' => 'abstract', 'agency' => 'ef_agency', 'opportunity' => 'ef_opportunity',
        'application' => 'ef_application', 'budget_request' => 'budget_request', 'award' => 'award',
        'funding_round' => 'funding_round', 'evaluation_type' => 'evaluation_type',
    ];

    /** Bookkeeping keys that mean nothing to a reader. */
    private const NOISE = ['_token', '_method', 'page', 'per_page', 'target_name', 'target_email', 'ip', 'attempted', 'id'];

    /** How each action reads in a sentence. */
    private const VERBS = [
        'created' => 'created', 'updated' => 'updated', 'deleted' => 'deleted', 'approved' => 'approved',
        'rejected' => 'rejected', 'submitted' => 'submitted', 'validated' => 'validated', 'closed' => 'closed',
        'reopened' => 'reopened', 'revoked' => 'revoked', 'disbursed' => 'disbursed', 'settled' => 'settled',
        'finalized' => 'finalised', 'verified' => 'verified', 'published' => 'published', 'unpublished' => 'unpublished',
        'signed' => 'signed', 'resolved' => 'resolved', 'escalated' => 'escalated', 'responded' => 'responded to',
        'scheduled' => 'scheduled', 'assigned' => 'assigned a reviewer to', 'reassigned' => 'reassigned a reviewer on',
        'removed' => 'removed someone from', 'extended' => 'extended the deadline of', 'scored' => 'scored',
        'appealed' => 'appealed', 'status_changed' => 'changed the status of', 'role_changed' => 'changed the role of',
        'roles_changed' => 'changed the roles of', 'permissions_changed' => 'changed the permissions of',
        'exported' => 'exported', 'downloaded' => 'downloaded a file from', 'imported' => 'imported',
        'returned_for_correction' => 'returned for correction', 'funding_changed' => 'changed the funding of',
        'central_decision' => 'recorded the central decision on', 'document_uploaded' => 'uploaded a document to',
        'bulk_updated' => 'bulk-updated', 'bulk_approved' => 'bulk-approved', 'transitioned' => 'moved',
        'impersonation_started' => 'started acting as', 'decided' => 'decided on', 'score_submitted' => 'submitted a score for',
        'budget_set' => 'set the budget of', 'college_shares_set' => 'set the college shares of', 'reviewer_added' => 'added a reviewer to',
        'result_processed' => 'processed the result of', 'quick_allocated' => 'allocated funds to', 'guidelines_updated' => 'updated the guidelines of',
        'award_details_updated' => 'updated the award details of', 'draft_created' => 'started a draft of', 'evidence_uploaded' => 'uploaded evidence to',
        'report_uploaded' => 'uploaded a report to', 'asset_uploaded' => 'uploaded a file to', 'generated' => 'generated', 'token_generated' => 'generated a token for',
    ];

    /** @var array<string, array<string, string>> kind => id => display name */
    private array $names = [];

    /** @var array<string, array{kind: string, name: string}> id => what it turned out to be, for IDs of unknown kind */
    private array $found = [];

    /**
     * Adds `description`, `subject` and `changes` to each log.
     *
     * @param  Collection<int, AuditLog>  $logs
     */
    public function present(Collection $logs): void
    {
        $this->resolveNames($logs);

        foreach ($logs as $log) {
            $subject = $this->subject($log);
            $log->setAttribute('subject', $subject);
            $log->setAttribute('changes', $this->changes($log));
            $log->setAttribute('description', $this->describe($log, $subject));
        }
    }

    /** @param  Collection<int, AuditLog>  $logs */
    private function resolveNames(Collection $logs): void
    {
        $wanted = [];
        $unknown = [];
        foreach ($logs as $log) {
            if (Str::isUuid((string) $log->auditable_id)) {
                if ($kind = $this->subjectKind($log)) {
                    $wanted[$kind][] = $log->auditable_id;
                } else {
                    $unknown[] = $log->auditable_id;
                }
            }
            foreach ([$log->old_values ?? [], $log->new_values ?? []] as $values) {
                foreach ((array) $values as $key => $value) {
                    if (Str::isUuid((string) $key)) {
                        $unknown[] = (string) $key;
                    } elseif (is_string($value) && Str::isUuid($value) && ! $this->fieldKind((string) $key)) {
                        $unknown[] = $value;
                    }
                    if ($kind = $this->fieldKind((string) $key)) {
                        foreach ((array) $value as $id) {
                            if (is_string($id) && Str::isUuid($id)) {
                                $wanted[$kind][] = $id;
                            }
                        }
                    }
                }
            }
        }

        foreach ($wanted as $kind => $ids) {
            $this->names[$kind] = $this->lookup($kind, array_values(array_unique($ids)));
        }

        $unknown = array_values(array_unique($unknown));
        foreach (self::PROBE as $kind) {
            if (! $unknown) {
                break;
            }
            foreach ($this->lookup($kind, $unknown) as $id => $name) {
                $this->found[$id] = ['kind' => $kind, 'name' => $name];
                $this->names[$kind][$id] = $name;
            }
            $unknown = array_values(array_diff($unknown, array_keys($this->found)));
        }
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, string>
     */
    private function lookup(string $kind, array $ids): array
    {
        [$class] = self::KINDS[$kind];
        $query = $class::query()->whereKey($ids);
        if (in_array(SoftDeletes::class, class_uses_recursive($class), true)) {
            $query->withTrashed();
        }

        $with = match ($kind) {
            'award', 'budget_request', 'defence_session', 'complaint', 'midterm', 'appeal', 'mentorship' => ['proposal:id,title'],
            'review_assignment' => ['proposal:id,title', 'reviewer:id,name,email'],
            'disbursement' => ['budgetRequest.proposal:id,title'],
            'funding_round' => ['call:id,title', 'college:id,name'],
            default => [],
        };

        try {
            return $query->with($with)->get()->mapWithKeys(fn (Model $m) => [$m->getKey() => $this->nameOf($kind, $m)])->all();
        } catch (\Throwable) {
            return [];
        }
    }

    private function nameOf(string $kind, Model $m): string
    {
        $quoted = fn (?string $t) => $t ? "“{$t}”" : 'untitled';

        return match ($kind) {
            'user' => $m->email ? "{$m->name} ({$m->email})" : (string) $m->name,
            'award', 'budget_request', 'defence_session', 'complaint', 'midterm', 'appeal', 'mentorship' => 'for '.$quoted($m->proposal?->title),
            'review_assignment' => ($m->reviewer?->name ?? 'a reviewer').' on '.$quoted($m->proposal?->title),
            'disbursement' => 'for '.$quoted($m->budgetRequest?->proposal?->title),
            'funding_round' => $quoted($m->call?->title).($m->college ? " — {$m->college->name}" : ''),
            'ef_application', 'ef_opportunity' => $quoted($m->title).($m->ref_number ? " ({$m->ref_number})" : ''),
            'ef_award' => $quoted($m->title).($m->award_number ? " ({$m->award_number})" : ''),
            'research_output', 'proposal', 'call', 'conference', 'abstract' => $quoted($m->title),
            default => (string) ($m->name ?? $m->title ?? ''),
        };
    }

    private function subjectKind(AuditLog $log): ?string
    {
        // The address is the most precise: …/external-funds/applications/{id} is an application.
        if ($log->url && $log->auditable_id) {
            $segments = explode('/', trim($log->url, '/'));
            $at = array_search($log->auditable_id, $segments, true);
            if ($at !== false && $at > 0) {
                $segment = $segments[$at - 1];
                if ($segment === 'awards' && in_array('external-funds', $segments, true)) {
                    return 'ef_award';
                }
                if (isset(self::SEGMENTS[$segment])) {
                    return self::SEGMENTS[$segment];
                }
            }
        }

        $type = Str::singular(class_basename((string) $log->auditable_type));

        return self::TYPES[$type] ?? null;
    }

    /** The kind, also for older entries whose kind is only known from looking the ID up. */
    private function resolvedKind(AuditLog $log): ?string
    {
        return $this->subjectKind($log) ?? ($this->found[$log->auditable_id]['kind'] ?? null);
    }

    private function fieldKind(string $key): ?string
    {
        if (! preg_match('/^(.+?)_ids?$/', $key, $m) && ! in_array($key, ['approved_by', 'created_by', 'recorded_by', 'assigned_to'], true)) {
            return null;
        }

        return self::FIELDS[$m[1] ?? $key] ?? null;
    }

    /** @return array{type: string, name: ?string} */
    private function subject(AuditLog $log): array
    {
        $kind = $this->resolvedKind($log);
        $values = ($log->new_values ?? []) + ($log->old_values ?? []);
        $type = $kind ? self::KINDS[$kind][1] : Str::lower(Str::headline(Str::singular(class_basename((string) $log->auditable_type))));

        $name = $kind ? ($this->names[$kind][$log->auditable_id] ?? null) : null;
        $name ??= $values['target_name'] ?? null;
        if ($name && isset($values['target_email']) && ! str_contains($name, '@')) {
            $name .= " ({$values['target_email']})";
        }
        $name ??= isset($values['title']) && is_string($values['title']) ? "“{$values['title']}”" : null;
        $name ??= isset($values['name']) && is_string($values['name']) ? $values['name'] : null;

        if (! $name && Str::isUuid((string) $log->auditable_id)) {
            $name = str_ends_with($log->event, '.deleted') ? '(now deleted)' : '(no longer exists)';
        }

        return ['type' => $type, 'name' => $name];
    }

    private function describe(AuditLog $log, array $subject): string
    {
        $actor = $log->actor ? $log->actor->name : ($log->user_agent === 'console' ? 'The system' : 'A visitor (not signed in)');
        $v = $log->new_values ?? [];
        $o = $log->old_values ?? [];
        $about = trim($subject['type'].' '.($subject['name'] ?? ''));
        $who = $subject['name'] ?? ($v['email'] ?? 'an account');

        $fixed = match ($log->event) {
            'user.login' => "{$actor} signed in",
            'user.logout' => "{$actor} signed out",
            'user.registered' => "{$actor} created their account",
            'user.login_failed' => "Failed sign-in for {$who}".(isset($v['reason']) ? ' — '.Str::lower($v['reason']) : ''),
            'user.login_blocked' => "Sign-in blocked for {$who}".(isset($v['reason']) ? ' — '.Str::lower($v['reason']) : ''),
            'user.account_locked' => "Account locked: {$who}".(isset($v['reason']) ? ' — '.Str::lower($v['reason']) : ''),
            'user.2fa_failed' => "Wrong verification code entered for {$who}",
            'user.password_reset_requested' => "Password reset link sent to {$who}",
            'user.password_reset' => "{$actor} reset their password (all their sessions were signed out)",
            'user.session_evicted' => "{$actor}'s oldest session was signed out (too many devices)",
            'conference.registration_created' => ($subject['name'] ?? 'Someone').' registered for “'.($v['conference'] ?? 'a conference').'”',
            'abstract.submitted', 'abstract.resubmitted', 'abstract.draft_saved', 'abstract.withdrawn' => ($v['submitter'] ?? 'The submitter').' '.[
                'abstract.submitted' => 'submitted the abstract',
                'abstract.resubmitted' => 'resubmitted a revised abstract',
                'abstract.draft_saved' => 'saved a draft of the abstract',
                'abstract.withdrawn' => 'withdrew the abstract',
            ][$log->event].($subject['name'] ? " {$subject['name']}" : '').(isset($v['conference']) ? " for “{$v['conference']}”" : ''),
            'audit_logs.exported' => "{$actor} exported the audit log",
            default => null,
        };
        if ($fixed) {
            return $fixed;
        }

        $action = Str::after($log->event, '.');

        if ($action === 'denied') {
            $attempt = Str::after((string) ($v['attempted'] ?? ''), '.');
            $verb = self::VERBS[$attempt] ?? Str::lower(Str::headline($attempt ?: 'change'));

            return "{$actor} tried to {$this->infinitive($verb)} {$about} but was not allowed";
        }

        if ($action === 'status_changed' && (isset($v['status']) || isset($o['status']))) {
            return "{$actor} changed the status of {$about}".(isset($o['status']) ? ' from “'.Str::headline($o['status']).'”' : '').(isset($v['status']) ? ' to “'.Str::headline($v['status']).'”' : '');
        }

        if ($action === 'transitioned') {
            return 'The '.$about.' moved'.(isset($o['status']) ? ' from “'.Str::headline($o['status']).'”' : '').(isset($v['status']) ? ' to “'.Str::headline($v['status']).'”' : '');
        }

        if (in_array($action, ['exported', 'downloaded'], true) && ! $subject['name']) {
            return "{$actor} ".($action === 'exported' ? 'exported' : 'downloaded').' '.Str::plural($subject['type']).' data';
        }

        if (! isset(self::VERBS[$action])) {
            return "{$actor} — ".Str::ucfirst(Str::lower(Str::headline($action))).": {$about}";
        }

        return "{$actor} ".self::VERBS[$action]." the {$about}";
    }

    /** "approved" → "approve", "assigned a reviewer to" → "assign a reviewer to". */
    private function infinitive(string $verb): string
    {
        $first = Str::before($verb, ' ');
        $rest = Str::after($verb, $first);
        $base = match (true) {
            $first === 'created' => 'create', $first === 'updated' => 'update', $first === 'deleted' => 'delete',
            str_ends_with($first, 'ied') => substr($first, 0, -3).'y',
            str_ends_with($first, 'ed') && in_array(substr($first, -3, 1), ['v', 's', 'c', 'g', 'z'], true) => substr($first, 0, -1),
            str_ends_with($first, 'ed') => substr($first, 0, -2),
            default => $first,
        };

        return $base.$rest;
    }

    /** @return list<array{field: string, from: ?string, to: ?string}> */
    private function changes(AuditLog $log): array
    {
        $old = (array) ($log->old_values ?? []);
        $new = (array) ($log->new_values ?? []);
        $rows = [];

        foreach (array_unique([...array_keys($old), ...array_keys($new)]) as $key) {
            if (in_array($key, self::NOISE, true)) {
                continue;
            }
            $from = array_key_exists($key, $old) ? $this->value((string) $key, $old[$key]) : null;
            $to = array_key_exists($key, $new) ? $this->value((string) $key, $new[$key]) : null;
            if ($from !== null && $from === $to) {
                continue;
            }
            $field = Str::isUuid((string) $key) ? ($this->found[$key]['name'] ?? 'A linked record') : $this->label((string) $key);
            $rows[] = ['field' => $field, 'from' => $from, 'to' => $to];
        }

        return $rows;
    }

    private function label(string $key): string
    {
        $key = preg_replace('/_ids?$/', '', $key);

        return Str::ucfirst(Str::lower(Str::headline($key)));
    }

    private function value(string $key, mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($kind = $this->fieldKind($key)) {
            $names = array_map(fn ($id) => is_string($id)
                ? ($this->names[$kind][$id] ?? (Str::isUuid($id) ? '(no longer exists)' : $this->value('', $id)))
                : (string) $id, (array) $value);

            return implode(', ', $names);
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_array($value)) {
            if (array_is_list($value) && collect($value)->every(fn ($v) => is_scalar($v))) {
                return Str::limit(implode(', ', array_map(fn ($v) => $this->value('', $v) ?? '', $value)), 300);
            }

            if (array_is_list($value)) {
                return count($value).' '.Str::plural('item', count($value));
            }

            $parts = [];
            foreach ($value as $k => $v) {
                $parts[] = is_int($k) ? (is_array($v) ? '['.count($v).' fields]' : (string) $v) : $this->label((string) $k).': '.(is_array($v) ? count($v).' item(s)' : (is_bool($v) ? ($v ? 'Yes' : 'No') : (string) $v));
            }

            return Str::limit(implode('; ', $parts), 300);
        }

        $text = (string) $value;
        if (Str::isUuid($text)) {
            return $this->found[$text]['name'] ?? '(a linked record)';
        }
        // Stored codes like "under_review" read as "Under review".
        if (preg_match('/^[a-z]+(_[a-z]+)*$/', $text) && strlen($text) <= 40) {
            return Str::ucfirst(str_replace('_', ' ', $text));
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}(T|\s)\d{2}:\d{2}/', $text)) {
            try {
                return Carbon::parse($text)->timezone(config('app.timezone'))->format('j M Y, H:i');
            } catch (\Throwable) {
            }
        }

        return Str::limit($text, 300);
    }
}
