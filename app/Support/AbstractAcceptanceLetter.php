<?php

namespace App\Support;

use App\Models\ConferenceAbstract;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * The PDF letter an accepted author shows for travel, leave or funding. It is built from
 * the decision as it stands, so a later session placement appears on the next download.
 */
class AbstractAcceptanceLetter
{
    public static function download(ConferenceAbstract $abstract): Response
    {
        $abstract->loadMissing(['conference', 'track', 'session']);

        return Pdf::loadView('pdf.abstract_acceptance_letter', [
            'abstract' => $abstract,
            'conference' => $abstract->conference,
            'authors' => $abstract->authors(),
            'presenter' => $abstract->presenterName(),
            'type' => $abstract->finalType(),
            'reference' => static::reference($abstract),
            'issuedAt' => $abstract->decided_at ?? $abstract->updated_at ?? now(),
            'orgName' => DB::table('app_settings')->where('key', 'organization_name')->value('value') ?? config('app.name'),
        ])->setPaper('a4', 'portrait')->download('acceptance-letter-'.str($abstract->title)->slug()->limit(60, '').'.pdf');
    }

    /** A short, stable reference, e.g. "ABS-2026-3F9A2C". */
    public static function reference(ConferenceAbstract $abstract): string
    {
        return 'ABS-'.($abstract->conference?->start_date?->format('Y') ?? now()->format('Y')).'-'.strtoupper(substr(str_replace('-', '', $abstract->id), 0, 6));
    }
}
