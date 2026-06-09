<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureCategoryScope
{
    private array $roleCategories = [
        'research_officer'   => 'research',
        'community_officer'  => 'community_engagement',
        'technology_officer' => 'technology_transfer',
    ];

    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();
        if (! $user) {
            return $next($request);
        }

        foreach ($this->roleCategories as $role => $category) {
            if ($user->hasRole($role)) {
                $request->merge(['_category_scope' => $category]);
                break;
            }
        }

        return $next($request);
    }
}
