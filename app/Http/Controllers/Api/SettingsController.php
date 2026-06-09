<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendBroadcastEmailJob;
use App\Models\AppSetting;
use App\Models\ThresholdSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SettingsController extends Controller
{
    // ── Threshold settings (legacy endpoint used by reviews) ─────────────────

    public function index(): JsonResponse
    {
        $settings = ThresholdSetting::orderBy('key')->get();

        return response()->json([
            'data' => $settings,
            'message' => 'Settings retrieved.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        if (! $request->user()?->can('settings.manage')) {
            return response()->json(['data' => null, 'message' => 'Forbidden.', 'errors' => []], 403);
        }

        $validated = $request->validate([
            'blind_threshold' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'defence_threshold' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'combined_threshold' => ['sometimes', 'numeric', 'min:0', 'max:200'],
            'similarity_threshold' => ['sometimes', 'numeric', 'min:0', 'max:1'],
        ]);

        $user = $request->user();
        $updated = [];

        DB::transaction(function () use ($validated, $user, $request, &$updated) {
            foreach ($validated as $key => $value) {
                $setting = ThresholdSetting::where('key', $key)->first();
                if (! $setting) {
                    continue;
                }
                $oldValue = $setting->value;
                $setting->update(['value' => $value, 'updated_by' => $user->id]);
                $updated[] = $setting->fresh();

                DB::table('audit_logs')->insert([
                    'id' => Str::uuid()->toString(),
                    'auditable_type' => ThresholdSetting::class,
                    'auditable_id' => $setting->id,
                    'event' => 'setting.updated',
                    'actor_id' => $user->id,
                    'old_values' => json_encode([$key => $oldValue]),
                    'new_values' => json_encode([$key => $value]),
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent() ?? '',
                    'created_at' => now(),
                ]);
            }
        });

        return response()->json(['data' => $updated, 'message' => 'Settings updated.', 'errors' => []]);
    }

    // ── App settings ──────────────────────────────────────────────────────────

    public function appSettings(): JsonResponse
    {
        $settings = AppSetting::orderBy('key')->get()
            ->groupBy(fn ($s) => $s->group ?? $s->description ?? 'general')
            ->map(fn ($group) => $group->keyBy('key'));

        return response()->json(['data' => $settings, 'message' => '', 'errors' => [], 'meta' => []]);
    }

    public function updateAppSetting(Request $request, string $key): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $value = $request->value;
        $userId = $request->user()->id;

        $appearanceKeys = ['primary_color', 'secondary_color', 'sidebar_color', 'footer_text', 'custom_css', 'homepage_banner', 'theme', 'system_logo', 'favicon'];
        $defaultGroup = in_array($key, $appearanceKeys) ? 'appearance' : 'general';
        $defaultType = in_array($key, ['primary_color', 'secondary_color', 'sidebar_color']) ? 'color' : 'string';

        $setting = AppSetting::firstOrCreate(
            ['key' => $key],
            ['value' => '', 'type' => $defaultType, 'group' => $defaultGroup, 'description' => $key]
        );
        $setting->update(['value' => $value, 'updated_by' => $userId]);

        // Bust all caches so the new value is served on the next request
        Cache::forget('inertia_app_settings');
        Cache::forget('blade_app_meta');

        // Keep legacy site_name in sync with system_name (used by AwardController)
        if ($key === 'system_name') {
            AppSetting::where('key', 'site_name')
                ->update(['value' => $value, 'updated_by' => $userId, 'updated_at' => now()]);
        }

        // Threshold keys must also be written to threshold_settings (used by the review pipeline)
        $thresholdKeys = ['blind_threshold', 'defence_threshold', 'combined_threshold', 'similarity_threshold'];
        if (in_array($key, $thresholdKeys)) {
            ThresholdSetting::where('key', $key)
                ->update(['value' => $value, 'updated_by' => $userId]);
        }

        return response()->json(['data' => $setting, 'message' => 'Setting updated.', 'errors' => [], 'meta' => []]);
    }

    public function updateBulk(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $settings = $request->input('settings', []);
        $userId = $request->user()->id;

        foreach ($settings as $key => $value) {
            AppSetting::where('key', $key)
                ->update(['value' => $value, 'updated_by' => $userId, 'updated_at' => now()]);
        }

        Cache::forget('inertia_app_settings');
        Cache::forget('blade_app_meta');
        Artisan::call('config:clear');
        Artisan::call('cache:clear');

        return response()->json(['data' => null, 'message' => 'Settings saved successfully.', 'errors' => [], 'meta' => []]);
    }

    // ── System actions ────────────────────────────────────────────────────────

    public function systemInfo(): JsonResponse
    {
        $freeBytes = @disk_free_space(storage_path());

        return response()->json([
            'data' => [
                'php_version' => PHP_VERSION,
                'laravel_version' => app()->version(),
                'database' => config('database.default'),
                'cache_driver' => config('cache.default'),
                'queue_driver' => config('queue.default'),
                'storage_gb' => $freeBytes !== false ? round($freeBytes / (1024 ** 3), 2) : null,
                'maintenance' => app()->isDownForMaintenance(),
                'debug_mode' => config('app.debug'),
                'timezone' => config('app.timezone'),
                'environment' => config('app.env'),
            ],
            'message' => '',
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function clearCache(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        Artisan::call('optimize:clear');

        return response()->json(['data' => null, 'message' => 'Cache cleared successfully.', 'errors' => [], 'meta' => []]);
    }

    public function toggleMaintenance(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $isDown = app()->isDownForMaintenance();

        if ($isDown) {
            Artisan::call('up');
            $message = 'Maintenance mode disabled.';
        } else {
            $secret = 'rtt-bypass-'.rand(1000, 9999);
            Artisan::call('down', ['--secret' => $secret]);
            $message = 'Maintenance mode enabled. Bypass secret: '.$secret;
        }

        return response()->json([
            'data' => ['maintenance' => ! $isDown],
            'message' => $message,
            'errors' => [],
            'meta' => [],
        ]);
    }

    public function testEmail(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        try {
            Mail::raw('This is a test email from RTT Platform. If you received this, your mail configuration is working correctly.', function ($msg) use ($request) {
                $msg->to($request->user()->email)
                    ->subject('RTT Platform — Test Email');
            });

            return response()->json([
                'data' => null,
                'message' => 'Test email sent to '.$request->user()->email,
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Failed: '.$e->getMessage()], 422);
        }
    }

    public function uploadAsset(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'file' => 'required|image|max:2048',
            'key' => 'required|string|in:system_logo,favicon',
        ]);

        $path = $request->file('file')->store('assets/branding', 'public');
        $url = Storage::url($path);

        AppSetting::where('key', $request->key)->update(['value' => $url, 'updated_by' => $request->user()->id]);

        Cache::forget('inertia_app_settings');
        Cache::forget('blade_app_meta');

        return response()->json([
            'data' => ['url' => $url, 'path' => $path],
            'message' => 'Asset uploaded.',
            'errors' => [],
            'meta' => [],
        ]);
    }

    // ── Broadcast email ───────────────────────────────────────────────────────

    public function sendBroadcastEmail(Request $request): JsonResponse
    {
        if (! $request->user()?->hasRole('super_admin')) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $request->validate([
            'to' => 'required|in:all,by_role,specific',
            'role' => 'required_if:to,by_role|string',
            'email' => 'required_if:to,specific|email',
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
        ]);

        SendBroadcastEmailJob::dispatch($request->all(), $request->user()->id);

        return response()->json(['data' => null, 'message' => 'Emails queued for sending.', 'errors' => [], 'meta' => []]);
    }
}
