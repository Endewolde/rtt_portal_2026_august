<?php

namespace App\Console\Commands;

use App\Models\Proposal;
use App\Models\RepositoryRecord;
use App\Support\TitleCase;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StandardizeTitles extends Command
{
    protected $signature = 'proposals:standardize-titles {--force : Actually rewrite the titles. Without this flag, only a dry-run report is printed — nothing is changed.}';

    protected $description = 'Rewrite stored proposal and repository titles into the standard Title Case form. '
        .'Dry run by default; every original title is kept in the audit log so the change can be reversed.';

    public function handle(): int
    {
        $force = (bool) $this->option('force');
        $changes = [];

        foreach ([[Proposal::class, 'proposals'], [RepositoryRecord::class, 'repository_records']] as [$model, $table]) {
            DB::table($table)->select('id', 'title')->orderBy('id')->chunk(500, function ($rows) use ($model, $table, $force, &$changes) {
                foreach ($rows as $row) {
                    $standard = TitleCase::format($row->title);
                    if ($standard === null || $standard === $row->title) {
                        continue;
                    }

                    $changes[] = [$table, Str::limit($row->title, 60), Str::limit($standard, 60)];

                    if ($force) {
                        DB::transaction(function () use ($model, $table, $row, $standard) {
                            // Title only — not touching updated_at, so lists sorted by
                            // "last updated" don't all jump to the top.
                            DB::table($table)->where('id', $row->id)->update(['title' => $standard]);
                            DB::table('audit_logs')->insert([
                                'id' => Str::uuid()->toString(),
                                'auditable_type' => $model,
                                'auditable_id' => $row->id,
                                'event' => 'title.standardized',
                                'actor_id' => null,
                                'old_values' => json_encode(['title' => $row->title]),
                                'new_values' => json_encode(['title' => $standard]),
                                'ip_address' => '127.0.0.1',
                                'user_agent' => 'artisan proposals:standardize-titles',
                                'created_at' => now(),
                            ]);
                        });
                    }
                }
            });
        }

        if ($changes === []) {
            $this->info('Every title is already in the standard form — nothing to do.');

            return self::SUCCESS;
        }

        $this->table(['Table', 'Current title', 'Standard title'], array_slice($changes, 0, 50));
        if (count($changes) > 50) {
            $this->line('… and '.(count($changes) - 50).' more.');
        }

        $force
            ? $this->info(count($changes).' title(s) standardized. Originals are in the audit log (event "title.standardized").')
            : $this->comment('This was a DRY RUN — '.count($changes).' title(s) would change. Re-run with --force to apply.');

        return self::SUCCESS;
    }
}
