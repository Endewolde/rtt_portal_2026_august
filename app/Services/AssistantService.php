<?php

namespace App\Services;

use App\Models\AssistantQuery;
use App\Models\DefenceSession;
use App\Models\HelpArticle;
use App\Models\ProgressReport;
use App\Models\Proposal;
use App\Models\ProposalCall;
use App\Models\ReviewAssignment;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The "Ask" assistant, without an AI provider. Questions about the person's own work are
 * recognised by pattern and answered from live data with their permissions; everything
 * else is matched to help articles (full-text search, widened with synonyms and typo
 * correction). It never invents an answer — if nothing fits, it says so and the question
 * is logged for the office.
 */
class AssistantService
{
    /** Who may look up any proposal by tracker number (others: their own, or ones they oversee). */
    private const SEE_ALL_ROLES = ['super_admin', 'admin', 'central_officer', 'finance_officer', 'support_officer'];

    private const BUDGET_ROLES = ['super_admin', 'admin', 'central_officer', 'research_officer', 'community_officer', 'technology_officer'];

    /** Everyday words mapped to the words the help articles use. */
    private const SYNONYMS = [
        'defense' => 'defence', 'panel' => 'defence', 'presentation' => 'defence',
        'money' => 'budget', 'funds' => 'budget', 'fund' => 'funding', 'grant' => 'funding', 'finance' => 'budget',
        'apply' => 'submit proposal', 'application' => 'proposal', 'project' => 'proposal',
        'marks' => 'score', 'grade' => 'score', 'evaluate' => 'review score', 'rate' => 'score',
        'coi' => 'conflict of interest', 'conflict' => 'conflict of interest',
        'teammate' => 'co-investigator', 'colleague' => 'co-investigator', 'member' => 'co-investigator',
        'cert' => 'certificate', 'certificates' => 'certificate',
        'phone' => 'mobile install', 'android' => 'install', 'iphone' => 'install',
        'amharic' => 'language amharic', 'translate' => 'language',
        'late' => 'deadline extension', 'extend' => 'extension', 'delay' => 'extension',
        'rejected' => 'not selected', 'appeal' => 'reconsideration complaint',
        'password' => 'profile sign in', 'privacy' => 'personal data',
    ];

    private const STOP_WORDS = ['how', 'what', 'where', 'when', 'why', 'who', 'can', 'the', 'and', 'for', 'with', 'does', 'did', 'is', 'are', 'my', 'do', 'to', 'a', 'an', 'of', 'in', 'on', 'it', 'me', 'please', 'help', 'want', 'need', 'about'];

    public function __construct(
        private ProgressReportService $access,
        private FundingBudgetService $budgets,
    ) {}

    /** @return array<string, mixed> */
    public function ask(User $user, string $question, ?string $page = null): array
    {
        $question = trim(mb_substr($question, 0, 500));
        $answer = $this->answerFromData($user, $question) ?? $this->answerFromArticles($user, $question);

        $log = AssistantQuery::create([
            'user_id' => $user->id,
            'query' => $question,
            'page' => $page ? mb_substr($page, 0, 200) : null,
            'answer_type' => $answer['type'],
            'intent' => $answer['intent'] ?? null,
            'help_article_id' => $answer['articles'][0]['id'] ?? null,
        ]);

        return ['query_id' => $log->id] + $answer + ['suggestions' => $this->suggestions($user, $page)];
    }

    /** One-tap questions suited to the page and the person. @return list<string> */
    public function suggestions(User $user, ?string $page): array
    {
        $suggestions = [];

        if (Proposal::where('pi_user_id', $user->id)->exists()) {
            $suggestions[] = 'Where is my proposal?';
        }
        if (ReviewAssignment::where('reviewer_id', $user->id)->whereIn('status', ['pending', 'accepted', 'in_progress'])->exists()) {
            $suggestions[] = 'Which reviews are due?';
        }
        $suggestions[] = 'What are my upcoming deadlines?';
        if ($user->hasAnyRole(self::BUDGET_ROLES)) {
            $suggestions[] = 'How much budget is left in each call?';
        }

        if ($page) {
            HelpArticle::visibleTo($user)->whereNotNull('page_paths')->orderBy('sort_order')->get(['title', 'page_paths'])
                ->filter(fn ($a) => collect($a->page_paths)->contains(fn ($p) => $page === $p || str_starts_with($page, rtrim($p, '/').'/')))
                ->take(3)
                ->each(function ($a) use (&$suggestions) {
                    $suggestions[] = $a->title;
                });
        }

        return array_values(array_unique(array_slice($suggestions, 0, 6)));
    }

    public function feedback(AssistantQuery $query, bool $helpful): void
    {
        $query->update(['helpful' => $helpful]);
        if ($query->help_article_id) {
            HelpArticle::whereKey($query->help_article_id)->increment($helpful ? 'helpful_yes' : 'helpful_no');
        }
    }

    // ── Questions about the person's own work ─────────────────────────────────

    /** @return array<string, mixed>|null */
    private function answerFromData(User $user, string $question): ?array
    {
        $q = Str::lower($question);

        // Tracker numbers look like RES-2026-2027-000123 (RES, COM, TECH, INN, OTH) or DRAFT-AB12CD34.
        if (preg_match('/\b((?:RES|COM|TECH|INN|OTH)-\d{4}(?:-\d{4})?-\d{3,6}|DRAFT-[A-Z0-9]{6,10})\b/i', $question, $m)) {
            return $this->proposalByTracker($user, strtoupper($m[1]));
        }
        // "How / why / can I…" questions want an explanation, not a list of the person's records.
        if (preg_match('/^(how|why|can|could|should|would|is it|is there|do i|does|did|what (if|happens|does|is|counts|should)|it says|i (forgot|missed|can))\b|\bmy (proposal|project) (was|got|has been)\b|\bwhat next\b/', $q)) {
            return null;
        }

        if (preg_match('/\b(budget|money|fund(s|ing)?)\b.*\b(left|remain(ing)?|available|call)/', $q) && $user->hasAnyRole(self::BUDGET_ROLES)) {
            return $this->callBudgets();
        }
        if (preg_match('/\b(review|reviews|score|scoring|assigned)\b.*\b(due|pending|assigned|have|to do|todo|waiting|left)\b|\bmy reviews?\b|\breviews? (due|pending)\b/', $q)) {
            return $this->myReviews($user);
        }
        if (preg_match('/\bprogress reports?\b/', $q) && preg_match('/\b(my|due|when|overdue|next)\b/', $q)) {
            return $this->myDeadlines($user, onlyReports: true);
        }
        if (preg_match('/\b(deadlines?|due dates?|overdue|upcoming)\b/', $q)
            && preg_match('/\b(my|upcoming|what are|what is due|when|next|overdue)\b/', $q)
            && ! preg_match('/\b(extend|extension|extensions|request|how)\b/', $q)) {
            return $this->myDeadlines($user);
        }
        if (preg_match('/\bwhere (is|are) my (proposals?|applications?|projects?)\b|\b(status|stage)\b.*\bmy (proposals?|applications?|projects?)\b|\bmy (proposals?|applications?)\b.*\b(status|stage)\b|\b(show|list|see) (me )?my (proposals|applications|projects)\b|^my (proposals|applications)\??$/', $q)) {
            return $this->myProposals($user);
        }

        return null;
    }

    private function proposalByTracker(User $user, string $tracker): array
    {
        $proposal = Proposal::where('tracker_number', $tracker)->first();
        $allowed = $proposal && ($user->hasAnyRole(self::SEE_ALL_ROLES)
            || $this->access->isTeamMember($proposal, $user)
            || $this->access->canReview($proposal, $user));

        if (! $allowed) {
            return $this->data('tracker', "I couldn't find a proposal {$tracker} that you have access to. Check the number, or use the public Track Proposal page.", []);
        }

        return $this->data('tracker', "Here's where {$tracker} is now.", [$this->proposalCard($proposal)]);
    }

    private function myProposals(User $user): array
    {
        $proposals = Proposal::where(fn ($q) => $q->where('pi_user_id', $user->id)
            ->orWhereIn('id', DB::table('proposal_members')->where('user_id', $user->id)->where('status', 'active')->select('proposal_id')))
            ->latest('updated_at')
            ->limit(6)
            ->get();

        return $proposals->isEmpty()
            ? $this->data('my_proposals', "You don't have any proposals yet. To start one, go to Proposals → New Proposal.", [], ['label' => 'Start a proposal', 'url' => '/proposals/create'])
            : $this->data('my_proposals', 'Your proposals and where each one is now:', $proposals->map(fn ($p) => $this->proposalCard($p))->all());
    }

    private function myReviews(User $user): array
    {
        $reviews = ReviewAssignment::with(['proposal:id,tracker_number,title', 'evaluationType:id,name'])
            ->where('reviewer_id', $user->id)
            ->whereIn('status', ['pending', 'accepted', 'in_progress'])
            ->orderBy('due_date')
            ->get();

        if ($reviews->isEmpty()) {
            return $this->data('my_reviews', 'You have no reviews waiting. Nice work!', []);
        }

        return $this->data('my_reviews', "You have {$reviews->count()} review".($reviews->count() === 1 ? '' : 's').' to finish:', $reviews->map(fn ($r) => [
            'title' => $r->proposal?->title ?? 'Proposal',
            'subtitle' => (Str::startsWith((string) $r->evaluationType?->name, 'open_defence') ? 'Open defence' : 'Blind review').' · '.$r->proposal?->tracker_number,
            'lines' => [$r->due_date ? $this->dueLine($r->due_date) : 'No due date set'],
            'tone' => $r->due_date && $r->due_date->isPast() && ! $r->due_date->isToday() ? 'danger' : 'default',
            'action' => ['label' => 'Open review', 'url' => "/reviews/{$r->id}/score"],
        ])->all());
    }

    private function myDeadlines(User $user, bool $onlyReports = false): array
    {
        $items = collect();

        if (! $onlyReports) {
            Proposal::with('proposalCall:id,end_date,title')->where('pi_user_id', $user->id)->where('status', 'draft')->get()
                ->each(function (Proposal $p) use ($items) {
                    $deadline = $p->extended_deadline ?? $p->proposalCall?->end_date;
                    if ($deadline && $deadline->isFuture()) {
                        $items->push(['date' => $deadline, 'title' => 'Submit '.($p->title ?: 'your draft proposal'), 'subtitle' => 'Proposal submission', 'url' => '/proposals/create']);
                    }
                });

            ReviewAssignment::with(['proposal:id,tracker_number,title', 'evaluationType:id,name'])
                ->where('reviewer_id', $user->id)->whereIn('status', ['pending', 'accepted', 'in_progress'])->get()
                ->each(function (ReviewAssignment $r) use ($items) {
                    $date = $r->due_date;
                    if (Str::startsWith((string) $r->evaluationType?->name, 'open_defence')) {
                        $session = DefenceSession::where('proposal_id', $r->proposal_id)->where('status', 'scheduled')->latest()->first();
                        $date = $session?->scoreDeadline() ?? $date;
                    }
                    if ($date) {
                        $items->push(['date' => $date, 'title' => 'Review: '.($r->proposal?->title ?? 'proposal'), 'subtitle' => $r->proposal?->tracker_number, 'url' => "/reviews/{$r->id}/score"]);
                    }
                });
        }

        ProgressReport::with('proposal:id,tracker_number,title,pi_user_id')
            ->whereHas('proposal', fn ($q) => $q->where('pi_user_id', $user->id)->whereIn('status', ProgressReportService::REPORTING_STATUSES))
            ->whereIn('status', [ProgressReport::STATUS_DUE, ProgressReport::STATUS_REVISION])
            ->where('period_start', '<=', now())
            ->get()
            ->each(function (ProgressReport $r) use ($items) {
                $items->push(['date' => $r->due_date, 'title' => ($r->is_final ? 'Final report' : "Progress report #{$r->period_number}").' — '.$r->proposal->title,
                    'subtitle' => $r->proposal->tracker_number, 'url' => "/proposals/{$r->proposal_id}?tab=Progress"]);
            });

        if ($items->isEmpty()) {
            return $this->data('deadlines', $onlyReports ? 'You have no progress reports due right now.' : 'You have no upcoming deadlines.', []);
        }

        return $this->data('deadlines', 'Your deadlines, soonest first:', $items->sortBy('date')->take(8)->map(fn ($i) => [
            'title' => $i['title'],
            'subtitle' => $i['subtitle'],
            'lines' => [$this->dueLine($i['date'])],
            'tone' => $i['date']->isPast() && ! $i['date']->isToday() ? 'danger' : 'default',
            'action' => ['label' => 'Open', 'url' => $i['url']],
        ])->values()->all());
    }

    private function callBudgets(): array
    {
        $calls = ProposalCall::whereNotNull('funding_budget')->orderByDesc('academic_year')->limit(6)->get();

        if ($calls->isEmpty()) {
            return $this->data('call_budget', 'No call has a funding budget set yet. Add one by editing the call in Proposal Calls.', [], ['label' => 'Open proposal calls', 'url' => '/proposal-calls']);
        }

        return $this->data('call_budget', 'Funding budget by call:', $calls->map(function (ProposalCall $call) {
            $b = $this->budgets->summary($call);

            return [
                'title' => $call->title,
                'subtitle' => $call->academic_year,
                'lines' => [
                    'Budget: ETB '.number_format($b['budget'], 2),
                    'Awarded: ETB '.number_format($b['committed'], 2)." ({$b['awards']} awards)",
                    'Left: ETB '.number_format($b['remaining'], 2),
                ],
                'tone' => $b['remaining'] < 0 ? 'danger' : 'default',
                'action' => ['label' => 'Open merit list', 'url' => '/admin/central-evaluation'],
            ];
        })->all());
    }

    private function proposalCard(Proposal $p): array
    {
        return [
            'title' => $p->title ?: 'Untitled proposal',
            'subtitle' => str_starts_with((string) $p->tracker_number, 'DRAFT-') ? 'Draft' : $p->tracker_number,
            'lines' => ['Stage: '.Proposal::statusLabel($p->status), 'Last updated '.$p->updated_at?->diffForHumans()],
            'tone' => $p->status === 'rejected' ? 'danger' : ($p->status === 'funded' ? 'success' : 'default'),
            'action' => ['label' => 'Open proposal', 'url' => "/proposals/{$p->id}"],
        ];
    }

    private function dueLine(\DateTimeInterface $date): string
    {
        $d = Carbon::instance($date);
        if ($d->isToday()) {
            return 'Due today ('.$d->format('M j').')';
        }

        return $d->isPast()
            ? 'Overdue since '.$d->format('M j, Y')
            : 'Due '.$d->format('D, M j, Y').' ('.$d->diffForHumans(['parts' => 1]).')';
    }

    private function data(string $intent, string $message, array $cards, ?array $action = null): array
    {
        return ['type' => 'intent', 'intent' => $intent, 'message' => $message, 'cards' => $cards, 'action' => $action, 'articles' => []];
    }

    // ── "How do I…" questions → help articles ──────────────────────────────────

    private function answerFromArticles(User $user, string $question): array
    {
        $articles = $this->search($user, $question);

        if ($articles->isEmpty()) {
            return [
                'type' => 'none',
                'message' => "I don't have an answer for that yet. Try different words, browse the Help Centre, or contact the Research & Technology Transfer office. I've noted your question so the office can add help for it.",
                'cards' => [],
                'action' => ['label' => 'Open Help Centre', 'url' => '/help'],
                'articles' => [],
            ];
        }

        return [
            'type' => 'article',
            'message' => $articles->count() === 1 ? 'This should help:' : 'This should help — and a couple of related topics:',
            'cards' => [],
            'action' => null,
            'articles' => $articles->map(fn (HelpArticle $a) => [
                'id' => $a->id, 'slug' => $a->slug, 'title' => $a->title, 'summary' => $a->summary, 'body' => $a->body, 'questions' => $a->questionList(),
                'action_label' => $a->action_label, 'action_url' => $a->action_url,
            ])->all(),
        ];
    }

    /** @return Collection<int, HelpArticle> best first, at most 3 */
    public function search(User $user, string $question): Collection
    {
        $groups = $this->wordGroups($question);
        if ($groups === []) {
            return collect();
        }

        $results = $this->match($user, $groups);

        // Nothing found: correct likely typos against the words the articles use, then retry.
        if ($results->isEmpty()) {
            $corrected = $this->correctTypos($user, $groups);
            if ($corrected !== $groups) {
                $results = $this->match($user, $corrected);
            }
        }

        return $results;
    }

    /**
     * Full-text first; a plain word match when it finds nothing (very short or very common words).
     *
     * @param  list<list<string>>  $groups  each question word with its synonyms and singular/plural forms
     */
    private function match(User $user, array $groups): Collection
    {
        $terms = collect($groups)->flatten()->unique()->implode(' ');
        $results = $this->fullText($user, $terms, $groups);

        return $results->isNotEmpty() ? $results : $this->likeSearch($user, $terms);
    }

    /** @param list<list<string>> $groups */
    private function fullText(User $user, string $terms, array $groups = []): Collection
    {
        if (DB::getDriverName() !== 'mysql') {
            return $this->likeSearch($user, $terms);
        }

        $rows = HelpArticle::visibleTo($user)
            ->selectRaw('help_articles.*, MATCH(title, summary, body, keywords, questions) AGAINST(? IN NATURAL LANGUAGE MODE) AS relevance', [$terms])
            ->whereRaw('MATCH(title, summary, body, keywords, questions) AGAINST(? IN NATURAL LANGUAGE MODE)', [$terms])
            ->orderByDesc('relevance')
            ->limit(8)
            ->get();

        if ($rows->isEmpty()) {
            return $rows;
        }

        // Rank by how much of the question the article's title and keywords cover, so an
        // exact topic beats an article that merely repeats a word; drop off-topic weak matches.
        $bestRelevance = max(0.01, (float) $rows->max('relevance'));
        $rows = $rows->map(function ($r) use ($groups, $bestRelevance) {
            $titleWords = array_filter(preg_split('/[^\pL\pN]+/u', Str::lower($r->title)));
            // The article's common questions count as topic words, like its keywords.
            $keywords = Str::lower($r->keywords.' '.$r->questions);
            $covered = collect($groups)->filter(fn ($forms) => collect($forms)->contains(
                fn ($f) => mb_strlen($f) >= 3 && (collect($titleWords)->contains(fn ($t) => str_starts_with($t, $f)) || str_contains($keywords, $f))
            ))->count();
            $r->coverage = $groups === [] ? 0 : $covered / count($groups);
            $r->score = (float) $r->relevance / $bestRelevance * 10 + 15 * $r->coverage;

            return $r;
        })->reject(fn ($r) => $r->coverage === 0.0 && (float) $r->relevance < 2)->sortByDesc('score')->values();

        if ($rows->isEmpty()) {
            return $rows;
        }

        // Keep only reasonably close matches to the best one, so tangents aren't shown.
        $best = (float) $rows->first()->score;

        return $rows->filter(fn ($r) => (float) $r->score >= $best * 0.35)->take(3)->values();
    }

    private function likeSearch(User $user, string $terms): Collection
    {
        $words = array_filter(explode(' ', $terms), fn ($w) => mb_strlen($w) >= 3);

        return HelpArticle::visibleTo($user)->get()
            ->map(function ($a) use ($words) {
                $hay = Str::lower($a->title.' '.$a->summary.' '.$a->keywords.' '.$a->questions.' '.$a->body);
                $topic = Str::lower($a->title.' '.$a->keywords.' '.$a->questions);
                // Only count an article whose title or keywords mention the question — a shared common word in the body isn't enough.
                $onTopic = collect($words)->contains(fn ($w) => str_contains($topic, $w));
                $a->relevance = $onTopic ? collect($words)->sum(fn ($w) => substr_count($hay, $w) + (str_contains($topic, $w) ? 3 : 0)) : 0;

                return $a;
            })
            ->filter(fn ($a) => $a->relevance > 0)
            ->sortByDesc('relevance')
            ->take(3)
            ->values();
    }

    /**
     * The question's meaningful words, each with its synonym, singular/plural form and
     * hyphen parts — full-text search doesn't stem, so these widen the match.
     *
     * @return list<list<string>>
     */
    private function wordGroups(string $question): array
    {
        return collect(preg_split('/[^\pL\pN\-]+/u', Str::lower($question)))
            ->filter(fn ($w) => $w !== '' && ! in_array($w, self::STOP_WORDS, true))
            ->unique()
            ->map(function ($w) {
                $forms = [$w];
                if (isset(self::SYNONYMS[$w])) {
                    $forms = [...$forms, ...explode(' ', self::SYNONYMS[$w])];
                }
                if (str_contains($w, '-')) {
                    $forms = [...$forms, str_replace('-', '', $w), ...array_filter(explode('-', $w), fn ($p) => mb_strlen($p) >= 3)];
                }
                if (mb_strlen($w) >= 4) {
                    $forms[] = str_ends_with($w, 's') ? mb_substr($w, 0, -1) : $w.'s';
                }

                return array_values(array_unique($forms));
            })
            ->values()
            ->all();
    }

    /**
     * @param  list<list<string>>  $groups
     * @return list<list<string>>
     */
    private function correctTypos(User $user, array $groups): array
    {
        $vocabulary = HelpArticle::visibleTo($user)->get(['title', 'keywords'])
            ->flatMap(fn ($a) => preg_split('/[^\pL\pN]+/u', Str::lower($a->title.' '.$a->keywords)))
            ->filter(fn ($w) => mb_strlen($w) >= 4)
            ->unique()
            ->values();

        return collect($groups)->map(function (array $forms) use ($vocabulary) {
            $word = $forms[0];
            if (mb_strlen($word) < 4 || $vocabulary->contains($word)) {
                return $forms;
            }
            $best = $vocabulary->sortBy(fn ($v) => levenshtein($word, $v))->first();

            return $best !== null && levenshtein($word, $best) <= (mb_strlen($word) >= 7 ? 2 : 1) ? [$best, ...$forms] : $forms;
        })->all();
    }
}
