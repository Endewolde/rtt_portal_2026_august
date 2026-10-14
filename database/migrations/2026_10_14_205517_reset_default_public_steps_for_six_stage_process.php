<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * "How It Works" grew from 4 steps to the real 6-stage process. Saved step text that is
 * still one of the old built-in defaults is cleared so the new defaults show; steps an
 * admin wrote themselves are kept.
 */
return new class extends Migration
{
    private const OLD_DEFAULTS = [
        'Submit Proposal',
        'Complete the 7-step wizard with research details, team, and budget.',
        'Complete the 7-step wizard with your research details, team, and budget.',
        'Validation',
        'Central Office reviews and routes to the review pipeline.',
        'Central Office reviews completeness and assigns it to the review pipeline.',
        'Peer Review & Defence',
        'Expert reviewers score proposals. Top ones advance to defence.',
        'Expert reviewers score your proposal. Top proposals advance to open defence.',
        'Funding & Support',
        'Accepted proposals receive funding and M&E support.',
        'Accepted proposals receive funding and ongoing M&E support.',
    ];

    public function up(): void
    {
        $keys = collect(range(1, 4))->flatMap(fn ($i) => ["public_step_{$i}_title", "public_step_{$i}_desc"])->all();

        DB::table('app_settings')->whereIn('key', $keys)->whereIn('value', self::OLD_DEFAULTS)->update(['value' => '', 'updated_at' => now()]);

        Cache::forget('inertia_app_settings');
    }

    public function down(): void
    {
        // Cleared values were defaults; the page falls back to its built-in text.
    }
};
