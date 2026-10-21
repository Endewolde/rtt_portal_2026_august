<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Users whose role works on one college (data scope "Own college") are limited to
 * it: controllers read _college_scope and filter by it.
 */
class EnsureCollegeScope
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        if ($user && $user->accessScope()->isCollege()) {
            if (! $user->college_id) {
                return response()->json([
                    'data' => null,
                    'message' => 'Your account has no college assigned.',
                    'errors' => [],
                ], 403);
            }

            $request->merge(['_college_scope' => $user->college_id]);
        }

        return $next($request);
    }
}
