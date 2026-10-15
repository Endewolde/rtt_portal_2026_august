<?php

use App\Exceptions\ComplaintAlreadyFiledException;
use App\Exceptions\ConflictingReviewerException;
use App\Exceptions\InvalidScoreException;
use App\Exceptions\UnauthorizedResolutionException;
use App\Exceptions\UnauthorizedReviewException;
use App\Http\Middleware\EnsureCategoryScope;
use App\Http\Middleware\EnsureCollegeScope;
use App\Http\Middleware\EnsureFeatureEnabled;
use App\Http\Middleware\EnsureUserIsActive;
use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SetLocaleFromHeader;
use App\Http\Middleware\TrackRequestMetrics;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(append: [
            HandleInertiaRequests::class,
        ]);
        $middleware->append(SecurityHeaders::class);
        $middleware->append(TrackRequestMetrics::class);
        $middleware->append(SetLocaleFromHeader::class);
        $middleware->alias([
            'college.scope' => EnsureCollegeScope::class,
            'category.scope' => EnsureCategoryScope::class,
            'user.active' => EnsureUserIsActive::class,
            'feature' => EnsureFeatureEnabled::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        // Return JSON 401 for unauthenticated API requests; redirect web requests
        // to /login instead of route('login') (named route doesn't exist in this SPA).
        $exceptions->render(function (
            AuthenticationException $_e,
            Request $request
        ) {
            if ($request->is('api/*')) {
                return response()->json([
                    'data' => null,
                    'message' => 'Unauthenticated. Please log in.',
                    'errors' => [],
                    'meta' => [],
                ], 401);
            }

            return redirect('/login');
        });

        // Custom 429 JSON response for API rate limit hits
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'data' => null,
                    'message' => 'Too many requests. Please try again later.',
                    'errors' => ['retry_after' => (int) $e->getHeaders()['Retry-After'] ?? 60],
                    'meta' => [],
                ], 429, $e->getHeaders());
            }
        });

        // Duplicate complaint → 409 Conflict
        $exceptions->render(function (ComplaintAlreadyFiledException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 409);
            }
        });

        // Business-rule violations in complaint/resolution flows → 422 Unprocessable
        $exceptions->render(function (UnauthorizedResolutionException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
            }
        });

        // Service-layer argument violations (wrong stage, non-funded proposal, etc.) → 422
        $exceptions->render(function (InvalidArgumentException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
            }
        });

        // A selected reviewer is a PI/team member on the proposal → 422. Was previously
        // unmapped (extends RuntimeException, not InvalidArgumentException like its sibling
        // ReviewerOverloadedException above), so it fell through to a raw 500 in production.
        $exceptions->render(function (ConflictingReviewerException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
            }
        });

        // Score submission rejected (out-of-range score, missing required question,
        // declared conflict of interest, etc.) → 422. Also unmapped until now — every
        // one of these has been a raw 500 in production, not just the new COI case.
        $exceptions->render(function (InvalidScoreException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 422);
            }
        });

        // Someone other than the assigned reviewer tried to submit a score → 403.
        $exceptions->render(function (UnauthorizedReviewException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['data' => null, 'message' => $e->getMessage(), 'errors' => [], 'meta' => []], 403);
            }
        });
    })
    ->withSchedule(function (Schedule $schedule): void {
        // rtt:open-for-validation deliberately NOT scheduled: its actual purpose
        // (surfacing proposals into the validation queue via a 'pending_validation'
        // status + 'open_for_validation' workflow action) is unreachable dead code —
        // neither exists anywhere else in the app; the real validation queue runs off
        // status = 'submitted' directly, no separate "opening" step needed. The only
        // thing this command actually did was close expired calls, which duplicated
        // and raced against rtt:expire-calls below on the same rows. See the command
        // file for the full explanation if this ever needs to be revived properly.
        $schedule->command('rtt:deadline-reminders')->dailyAt('08:00');
        $schedule->command('rtt:expire-calls')->everyMinute();
        $schedule->command('rtt:cleanup-telegram-tokens')->weekly();
        $schedule->command('cache:warm-dashboard')->dailyAt('06:00');
        $schedule->command('metrics:collect')->everyMinute();
        $schedule->call(function () {
            DB::table('system_metrics')->where('recorded_at', '<', now()->subDays(7))->delete();
            DB::table('request_logs')->where('requested_at', '<', now()->subDays(3))->delete();
            DB::table('system_alerts')->where('resolved', true)->where('resolved_at', '<', now()->subDays(7))->delete();
            DB::table('email_logs')->where('created_at', '<', now()->subDays(90))->delete();
        })->dailyAt('02:00')->name('metrics:housekeeping');
    })
    ->create();
