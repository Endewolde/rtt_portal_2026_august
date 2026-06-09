<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Symfony\Component\HttpFoundation\Response;

class EnsureFeatureEnabled
{
    /**
     * @param  Closure(Request): Response  $next
     * @param  string  $feature  Feature enum value, e.g. 'finance'
     */
    public function handle(Request $request, Closure $next, string $feature): Response
    {
        $user = $request->user();

        $bypassRoles = config('features.bypass_roles', ['super_admin']);

        if ($user?->hasAnyRole($bypassRoles)) {
            return $next($request);
        }

        if (! $user || ! Gate::allows("feature:{$feature}")) {
            return response()->json([
                'data'    => null,
                'message' => 'This feature is not available on your current subscription plan.',
                'errors'  => ['feature' => $feature],
                'meta'    => [],
            ], 403);
        }

        return $next($request);
    }
}
