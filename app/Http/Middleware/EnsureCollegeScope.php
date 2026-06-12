<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureCollegeScope
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        if ($user && $user->hasAnyRole(['college_officer', 'finance_officer'])) {
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
