<?php

namespace Database\Seeders;

use App\Models\HelpArticle;
use Illuminate\Database\Seeder;

/**
 * The help centre's content, with the questions people ask about each feature.
 *
 * Re-running is safe: new articles are added, articles the office has never edited are
 * refreshed with the latest wording, and any article an admin has edited is left alone.
 */
class HelpArticleSeeder extends Seeder
{
    // Audiences, used by the content files in database/seeders/HelpContent.
    public const RESEARCHER = ['staff'];

    public const REVIEWER = ['staff', 'external_reviewer'];

    public const COLLEGE = ['college_officer', 'central_officer'];

    public const DIRECTORS = ['research_officer', 'community_officer', 'technology_officer', 'central_officer'];

    public const OFFICERS = ['college_officer', 'research_officer', 'community_officer', 'technology_officer', 'central_officer'];

    public const CENTRAL = ['central_officer'];

    public const FINANCE = ['finance_officer', 'central_officer'];

    public const ADMIN = ['super_admin', 'admin'];

    public const SUPER = ['super_admin'];

    /** One college, every category: central evaluation, funding, progress reports, reporting. */
    public const RTT_MANAGER = ['college_rtt_manager'];

    public function run(): void
    {
        foreach ($this->articles() as $i => $data) {
            $data['questions'] = implode("\n", $data['questions'] ?? []);
            $data += ['sort_order' => $i, 'is_published' => true, 'roles' => null, 'page_paths' => null, 'action_label' => null, 'action_url' => null, 'keywords' => null];

            $article = HelpArticle::where('slug', $data['slug'])->first();
            if (! $article) {
                HelpArticle::create($data);

                continue;
            }

            // Never overwrite an article someone has edited in the admin screen.
            if ($article->updated_at && $article->created_at && $article->updated_at->ne($article->created_at)) {
                continue;
            }

            $article->fill($data);
            if ($article->isDirty()) {
                $article->save();
                // Keep it marked as "not edited by a person" so future runs can still refresh it.
                HelpArticle::whereKey($article->id)->update(['updated_at' => $article->created_at]);
            }
        }
    }

    /**
     * Every article, from the section files in HelpContent (each returns a list).
     *
     * @return list<array<string, mixed>>
     */
    private function articles(): array
    {
        $files = glob(__DIR__.'/HelpContent/*.php') ?: [];
        sort($files);

        return array_merge(...array_map(fn ($file) => require $file, $files));
    }
}
