<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Answer in the language the reader picked in the interface (sent as X-Locale), where
 * translations exist, and remember it on their account so emails and documents sent
 * to them later use it too.
 */
class SetLocaleFromHeader
{
    private const SUPPORTED = ['en', 'am'];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = $request->header('X-Locale');
        if (in_array($locale, self::SUPPORTED, true)) {
            app()->setLocale($locale);

            $user = $request->user('sanctum');
            if ($user && $user->locale !== $locale) {
                $user->forceFill(['locale' => $locale])->saveQuietly();
            }
        }

        return $next($request);
    }
}
