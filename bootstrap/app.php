<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            \App\Http\Middleware\HandleInertiaRequests::class,
        ]);
        $middleware->append(\App\Http\Middleware\SecurityHeaders::class);
        $middleware->alias([
            'college.scope'  => \App\Http\Middleware\EnsureCollegeScope::class,
            'category.scope' => \App\Http\Middleware\EnsureCategoryScope::class,
            'user.active'    => \App\Http\Middleware\EnsureUserIsActive::class,
            'feature'        => \App\Http\Middleware\EnsureFeatureEnabled::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        // Return JSON 401 for unauthenticated API requests instead of
        // redirecting to route('login') (which doesn't exist in this SPA).
        $exceptions->render(function (
            \Illuminate\Auth\AuthenticationException $_e,
            Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'data'    => null,
                    'message' => 'Unauthenticated. Please log in.',
                    'errors'  => [],
                    'meta'    => [],
                ], 401);
            }
        });

        // Custom 429 JSON response for API rate limit hits
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'data'    => null,
                    'message' => 'Too many requests. Please try again later.',
                    'errors'  => ['retry_after' => (int) $e->getHeaders()['Retry-After'] ?? 60],
                    'meta'    => [],
                ], 429, $e->getHeaders());
            }
        });

        // Duplicate complaint → 409 Conflict
        $exceptions->render(function (\App\Exceptions\ComplaintAlreadyFiledException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 409);
            }
        });

        // Business-rule violations in complaint/resolution flows → 422 Unprocessable
        $exceptions->render(function (\App\Exceptions\UnauthorizedResolutionException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
            }
        });

        // Service-layer argument violations (wrong stage, non-funded proposal, etc.) → 422
        $exceptions->render(function (\InvalidArgumentException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
            }
        });
    })
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('rtt:open-for-validation')->hourly();
        $schedule->command('rtt:deadline-reminders')->dailyAt('08:00');
        $schedule->command('rtt:expire-calls')->everyMinute();
        $schedule->command('rtt:cleanup-telegram-tokens')->weekly();
        $schedule->command('cache:warm-dashboard')->dailyAt('06:00');
    })
    ->create();
