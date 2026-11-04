<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * A public menu item switched off on the Public Site page closes its page too, not just
 * the link: typing the address gives "not available", for every visitor. Pages under it
 * close with it (e.g. /conferences/{slug} when Conferences is off). Home never closes.
 */
class BlockSwitchedOffPublicPages
{
    /**
     * The public menu by position, as in resources/js/lib/publicSite.js (NAV_DEFAULTS):
     * settings refer to items as public_nav_item_{n}_*.
     */
    public const MENU = [
        1 => '/',
        2 => '/proposal-calls/public',
        3 => '/conferences',
        4 => '/explore',
        5 => '/funding-opportunities',
        6 => '/repository',
        7 => '/tracker',
        8 => '/researchers',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        if (! $request->isMethod('GET') || $request->is('api/*')) {
            return $next($request);
        }

        $path = '/'.ltrim($request->path(), '/');
        foreach (static::closedPaths() as $closed) {
            if ($path === $closed || str_starts_with($path, rtrim($closed, '/').'/')) {
                return Inertia::render('Public/PageUnavailable')->toResponse($request)->setStatusCode(404);
            }
        }

        return $next($request);
    }

    /** Paths of the menu items switched off; cached with the other site settings. @return list<string> */
    public static function closedPaths(): array
    {
        return Cache::remember('public_closed_pages', 300, function () {
            $settings = DB::table('app_settings')->where('key', 'like', 'public_nav_item_%')->pluck('value', 'key');

            return collect(static::MENU)
                ->filter(fn ($default, $n) => in_array(strtolower((string) $settings->get("public_nav_item_{$n}_show")), ['false', '0'], true))
                // An edited menu link closes the page it points to.
                ->map(fn ($default, $n) => '/'.ltrim(parse_url($settings->get("public_nav_item_{$n}_href") ?: $default, PHP_URL_PATH) ?: $default, '/'))
                ->reject(fn ($path) => $path === '/')
                ->values()->all();
        });
    }
}
