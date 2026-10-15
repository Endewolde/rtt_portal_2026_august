<?php

namespace App\Console\Commands;

use App\Models\HelpArticle;
use App\Models\User;
use App\Services\AssistantService;
use Illuminate\Console\Command;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Asks the assistant every "common question" stored on the help articles, as the
 * article's own audience, and reports how often the right article comes back. Run it
 * after editing articles to catch questions that no longer find their answer.
 */
class EvaluateHelpArticles extends Command
{
    protected $signature = 'help:evaluate {--all : List every question that isn\'t the top result}';

    protected $description = 'Check that each help article is found by its own common questions';

    public function handle(AssistantService $assistant): int
    {
        $total = 0;
        $first = 0;
        $topThree = 0;
        $problems = [];

        foreach (HelpArticle::where('is_published', true)->get() as $article) {
            $reader = $this->readerWithRole($article->roles[0] ?? 'staff');

            foreach ($article->questionList() as $question) {
                $total++;
                $found = $assistant->search($reader, $question)->pluck('slug');

                if ($found->first() === $article->slug) {
                    $first++;
                } elseif ($this->option('all') || ! $found->contains($article->slug)) {
                    $problems[] = [$question, $article->slug, $found->first() ?? '—'];
                }
                $topThree += $found->contains($article->slug) ? 1 : 0;
            }
        }

        if ($total === 0) {
            $this->warn('No published articles have common questions yet.');

            return self::SUCCESS;
        }

        $this->info(sprintf('%d questions · first result %d%% · in top three %d%%', $total, round($first / $total * 100), round($topThree / $total * 100)));

        if ($problems !== []) {
            $this->table(['Question', 'Should find', 'Found first'], $problems);
        }

        return self::SUCCESS;
    }

    /** A stand-in reader with just one role, so each article is checked as its audience sees it. */
    private function readerWithRole(string $role): User
    {
        $reader = new class(['id' => (string) Str::uuid(), 'name' => 'Help check']) extends User
        {
            public string $checkRole = 'staff';

            public function getRoleNames(): Collection
            {
                return collect([$this->checkRole]);
            }

            public function hasAnyRole(...$roles): bool
            {
                return in_array($this->checkRole, Arr::flatten($roles), true);
            }

            public function hasRole($roles, ?string $guard = null): bool
            {
                return in_array($this->checkRole, (array) $roles, true);
            }
        };
        $reader->checkRole = $role;

        return $reader;
    }
}
