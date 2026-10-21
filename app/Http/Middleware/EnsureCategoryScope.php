<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Users whose role works on one proposal category (data scope "One category") are
 * limited to it: controllers read _category_scope and filter by it.
 */
class EnsureCategoryScope
{
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();

        if ($user && $user->accessScope()->isCategory() && $user->accessScope()->category()) {
            $request->merge(['_category_scope' => $user->accessScope()->category()]);
        }

        return $next($request);
    }
}
