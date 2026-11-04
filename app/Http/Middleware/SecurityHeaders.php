<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class SecurityHeaders
{
    public function handle(Request $request, Closure $next): mixed
    {
        $response = $next($request);

        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-XSS-Protection', '1; mode=block');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
        // The conference check-in desk scans tickets with the camera; nothing else may use it.
        $camera = $request->is('admin/conferences/*/attendance') ? '(self)' : '()';
        $response->headers->set('Permissions-Policy', "camera={$camera}, microphone=(), geolocation=()");

        if ($request->isSecure()) {
            $response->headers->set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains'
            );
        }

        // The maintenance page is shown inside the public site for the admin who switched
        // maintenance on, so it alone may be framed — by this site only.
        $frameAncestors = $request->is('maintenance-preview') ? "'self'" : "'none'";

        $response->headers->set(
            'Content-Security-Policy',
            "default-src 'self'; ".
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; ".
            "style-src 'self' 'unsafe-inline'; ".
            "img-src 'self' data: blob:; ".
            "font-src 'self'; ".
            "connect-src 'self'; ".
            "frame-src 'self' blob:; ".
            "object-src 'self' blob:; ".
            "frame-ancestors {$frameAncestors};"
        );

        return $response;
    }
}
