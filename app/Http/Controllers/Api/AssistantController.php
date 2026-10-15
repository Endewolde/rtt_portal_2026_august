<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AssistantQuery;
use App\Models\HelpArticle;
use App\Services\AssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/** The "Ask" assistant and the help centre, for everyone signed in; article editing for admins. */
class AssistantController extends Controller
{
    private const ADMIN_ROLES = ['super_admin', 'admin'];

    public function __construct(private AssistantService $assistant) {}

    public function ask(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => 'required|string|min:2|max:500', 'page' => 'nullable|string|max:200']);

        return $this->ok($this->assistant->ask($request->user(), $data['q'], $data['page'] ?? null));
    }

    public function suggestions(Request $request): JsonResponse
    {
        return $this->ok($this->assistant->suggestions($request->user(), $request->query('page')));
    }

    public function feedback(Request $request, string $id): JsonResponse
    {
        $helpful = (bool) $request->validate(['helpful' => 'required|boolean'])['helpful'];
        $query = AssistantQuery::where('user_id', $request->user()->id)->findOrFail($id);
        $this->assistant->feedback($query, $helpful);

        return $this->ok(null, 'Thanks for the feedback.');
    }

    /** Help centre: the articles this person can see, optionally searched. */
    public function articles(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $articles = $search !== ''
            ? $this->assistant->search($request->user(), $search)
            : HelpArticle::visibleTo($request->user())->orderBy('category')->orderBy('sort_order')->get();

        return $this->ok($articles->map(fn (HelpArticle $a) => $a->only(['id', 'slug', 'title', 'summary', 'category', 'action_label', 'action_url']))->values());
    }

    public function article(Request $request, string $slug): JsonResponse
    {
        $article = HelpArticle::visibleTo($request->user())->where('slug', $slug)->firstOrFail();
        $article->increment('views');

        $related = HelpArticle::visibleTo($request->user())->where('category', $article->category)->where('id', '!=', $article->id)
            ->orderBy('sort_order')->limit(5)->get(['slug', 'title']);

        return $this->ok($article->only(['id', 'slug', 'title', 'summary', 'body', 'category', 'action_label', 'action_url', 'updated_at'])
            + ['questions' => $article->questionList(), 'related' => $related]);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    public function adminIndex(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasAnyRole(self::ADMIN_ROLES), 403);

        return $this->ok(HelpArticle::orderBy('category')->orderBy('sort_order')->get());
    }

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasAnyRole(self::ADMIN_ROLES), 403);

        return $this->ok(HelpArticle::create($this->validated($request)), 'Article created.');
    }

    public function update(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->hasAnyRole(self::ADMIN_ROLES), 403);
        $article = HelpArticle::findOrFail($id);
        $article->update($this->validated($request, $article));

        return $this->ok($article->fresh(), 'Article saved.');
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        abort_unless($request->user()->hasAnyRole(self::ADMIN_ROLES), 403);
        HelpArticle::findOrFail($id)->delete();

        return $this->ok(null, 'Article deleted.');
    }

    /** What people ask: most common questions, ones with no answer, and article usefulness. */
    public function insights(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasAnyRole(self::ADMIN_ROLES), 403);
        $since = now()->subDays(90);

        $base = AssistantQuery::where('created_at', '>=', $since);

        return $this->ok([
            'total' => (clone $base)->count(),
            'answered_rate' => ($total = (clone $base)->count()) > 0
                ? round((clone $base)->where('answer_type', '!=', 'none')->count() / $total * 100, 1) : null,
            'helpful' => (clone $base)->whereNotNull('helpful')->selectRaw('SUM(helpful = 1) as yes, SUM(helpful = 0) as no')->first(),
            'top' => (clone $base)->selectRaw('LOWER(query) as q, COUNT(*) as times, MAX(answer_type) as answer_type')
                ->groupBy(DB::raw('LOWER(query)'))->orderByDesc('times')->limit(15)->get(),
            'unanswered' => (clone $base)->where('answer_type', 'none')->latest('created_at')->limit(30)->get(['query', 'page', 'created_at']),
            'articles' => HelpArticle::orderByDesc('views')->limit(15)->get(['id', 'title', 'views', 'helpful_yes', 'helpful_no']),
        ]);
    }

    /** @return array<string, mixed> */
    private function validated(Request $request, ?HelpArticle $article = null): array
    {
        $data = $request->validate([
            'title' => 'required|string|max:200',
            'slug' => 'nullable|string|max:120|alpha_dash|unique:help_articles,slug'.($article ? ','.$article->id : ''),
            'summary' => 'required|string|max:500',
            'body' => 'required|string|max:20000',
            'category' => 'required|string|max:60',
            'roles' => 'nullable|array',
            'roles.*' => 'string|max:60',
            'keywords' => 'nullable|string|max:2000',
            'questions' => 'nullable|string|max:5000',
            'page_paths' => 'nullable|array',
            'page_paths.*' => 'string|max:200',
            'action_label' => 'nullable|string|max:80',
            'action_url' => ['nullable', 'string', 'max:200', 'regex:/^\/[^\s]*$/'],
            'is_published' => 'boolean',
            'sort_order' => 'nullable|integer|min:0|max:9999',
        ]);
        $data['slug'] = $data['slug'] ?? ($article?->slug ?? Str::slug($data['title']));
        $data['roles'] = empty($data['roles']) ? null : array_values($data['roles']);
        $data['page_paths'] = empty($data['page_paths']) ? null : array_values($data['page_paths']);

        return $data;
    }

    private function ok(mixed $data, string $message = ''): JsonResponse
    {
        return response()->json(['data' => $data, 'message' => $message, 'errors' => [], 'meta' => []]);
    }
}
