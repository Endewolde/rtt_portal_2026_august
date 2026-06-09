<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureUserIsActive
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        if ($user && ! in_array($user->status, ['active', null])) {
            // Revoke the current token so this request won't succeed again
            $request->user()->currentAccessToken()?->delete();

            return response()->json([
                'data' => null,
                'message' => 'Your account has been deactivated. Please contact an administrator.',
                'errors' => [],
            ], 401);
        }

        return $next($request);
    }
}
