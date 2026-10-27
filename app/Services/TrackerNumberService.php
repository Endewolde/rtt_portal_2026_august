<?php

namespace App\Services;

use App\Support\Programmes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TrackerNumberService
{
    private array $prefixes = [
        'research' => 'RES',
        'community_engagement' => 'COM',
        'technology_transfer' => 'TECH',
        'innovation' => 'INN',
        'other' => 'OTH',
    ];

    /**
     * Generate a unique tracker number for a proposal.
     * Uses SELECT FOR UPDATE inside a transaction to prevent
     * duplicate numbers under concurrent submissions.
     *
     * @throws \InvalidArgumentException if category is not recognised
     */
    public function generate(string $category, string $year): string
    {
        // The programme's own prefix (Settings → Programmes); legacy codes keep theirs.
        $prefix = Programmes::prefix($category) ?? ($this->prefixes[$category] ?? null);
        if (! $prefix) {
            throw new \InvalidArgumentException("Unknown proposal category: {$category}");
        }

        $sequence = DB::transaction(function () use ($category, $year) {
            $row = DB::table('tracker_numbers')
                ->where('category', $category)
                ->where('academic_year', $year)
                ->lockForUpdate()
                ->first();

            if ($row) {
                $newSequence = $row->last_sequence + 1;
                DB::table('tracker_numbers')
                    ->where('category', $category)
                    ->where('academic_year', $year)
                    ->update([
                        'last_sequence' => $newSequence,
                        'updated_at' => now(),
                    ]);
            } else {
                $newSequence = 1;
                DB::table('tracker_numbers')->insert([
                    'id' => Str::uuid()->toString(),
                    'category' => $category,
                    'academic_year' => $year,
                    'last_sequence' => $newSequence,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            return $newSequence;
        });

        return $prefix.'-'.$year.'-'.str_pad($sequence, 6, '0', STR_PAD_LEFT);
    }
}
