<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The maintenance access link lets any browser past the maintenance page — Laravel's
 * bypass cookie is set before anyone signs in. This keeps the system itself for
 * administrators (settings.manage) while it is down: everyone else who signs in gets
 * the maintenance reply, link or not. Signing in stays open so admins can log in.
 */
class AdminsOnlyDuringMaintenance
{
    /** Endpoints anyone may reach during maintenance, so an admin can sign in. */
    private const OPEN_PATHS = ['api/v1/auth/login', 'api/v1/auth/logout', 'api/v1/auth/2fa/verify', 'api/v1/auth/2fa/resend'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! app()->isDownForMaintenance() || $request->is(...self::OPEN_PATHS)) {
            return $next($request);
        }

        $user = $request->user('sanctum');

        if ($user && ! $user->can('settings.manage')) {
            return response()->json([
                'data' => null,
                'message' => 'The system is under maintenance. Only administrators can use it until it is back.',
                'errors' => [],
                'meta' => ['maintenance' => true],
            ], 503);
        }

        return $next($request);
    }
}
