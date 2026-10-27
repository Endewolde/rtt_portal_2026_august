<?php

namespace App\Http\Middleware;

use App\Services\IntegrationService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The integration API is called with an API key (Authorization: Bearer rtt_…),
 * never a user's session, and each route needs one of the key's scopes.
 */
class AuthenticateApiKey
{
    public function __construct(private IntegrationService $integrations) {}

    public function handle(Request $request, Closure $next, string $scope): Response
    {
        $key = $this->integrations->findKey($request->bearerToken() ?: $request->header('X-API-Key'));

        if (! $key) {
            return response()->json(['message' => 'A valid API key is required.'], 401);
        }
        if (! $key->allows($scope)) {
            return response()->json(['message' => "This API key may not read {$scope}."], 403);
        }

        if (! $key->last_used_at || $key->last_used_at->lt(now()->subMinute())) {
            $key->forceFill(['last_used_at' => now()])->saveQuietly();
        }
        $request->attributes->set('api_key', $key);

        return $next($request);
    }
}
