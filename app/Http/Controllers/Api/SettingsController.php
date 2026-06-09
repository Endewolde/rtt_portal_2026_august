<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\ThresholdSetting;
use App\Models\User;
use App\Services\MailConfigService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
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
        $publicSiteTypes = [
            'public_hero_bg' => 'color',
            'public_cards_bg' => 'color',
            'public_features_bg' => 'color',
            'public_footer_bg' => 'color',
            'public_nav_item_1_show' => 'boolean',
            'public_nav_item_2_show' => 'boolean',
            'public_nav_item_3_show' => 'boolean',
            'public_nav_item_4_show' => 'boolean',
            'public_nav_item_5_show' => 'boolean',
            'public_hero_subtitle' => 'textarea',
            'public_step_1_desc' => 'textarea',
            'public_step_2_desc' => 'textarea',
            'public_step_3_desc' => 'textarea',
            'public_step_4_desc' => 'textarea',
            'public_features_subtitle' => 'textarea',
            'public_cta_subtitle' => 'textarea',
            'public_show_stats' => 'boolean',
            'public_show_open_calls' => 'boolean',
            'public_show_how_it_works' => 'boolean',
            'public_show_features' => 'boolean',
            'public_show_cta' => 'boolean',
        ];
        $isPublicSiteKey = str_starts_with($key, 'public_');
        $defaultGroup = $isPublicSiteKey ? 'public_site' : (in_array($key, $appearanceKeys) ? 'appearance' : 'general');
        $defaultType = $publicSiteTypes[$key]
            ?? (in_array($key, ['primary_color', 'secondary_color', 'sidebar_color']) ? 'color' : 'string');

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

        // Apply DB mail settings so the test uses admin-configured SMTP, not .env
        app(MailConfigService::class)->applyFromDatabase();

        $recipient = $request->input('to') ?? $request->user()->email;

        try {
            Mail::html(
                view('emails.test')->with([
                    'senderName' => config('mail.from.name'),
                    'senderEmail' => config('mail.from.address'),
                    'smtpHost' => config('mail.mailers.smtp.host'),
                ])->render(),
                function ($msg) use ($recipient) {
                    $msg->to($recipient)
                        ->subject('RTT Platform — SMTP Connection Test');
                }
            );

            return response()->json([
                'data' => [
                    'recipient' => $recipient,
                    'host' => config('mail.mailers.smtp.host'),
                    'driver' => config('mail.default'),
                ],
                'message' => 'Test email sent to '.$recipient,
                'errors' => [],
                'meta' => [],
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'SMTP Error: '.$e->getMessage()], 422);
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
            'to' => 'required|in:all,by_role,by_college,specific',
            'role' => 'required_if:to,by_role|string|nullable',
            'college_id' => 'required_if:to,by_college|uuid|nullable',
            'email' => 'required_if:to,specific|email|nullable',
            'subject' => 'required|string|max:255',
            'message' => 'required|string',
        ]);

        // Validate the specific recipient exists in the database
        if ($request->to === 'specific') {
            $exists = User::where('email', $request->email)->exists();
            if (! $exists) {
                return response()->json([
                    'message' => "No user found with email \"{$request->email}\". Check the address and try again.",
                    'errors' => ['email' => ['No user found with this email address.']],
                ], 422);
            }
        }

        app(MailConfigService::class)->applyFromDatabase();

        $recipients = $this->resolveBroadcastRecipients($request->all());

        if ($recipients->isEmpty()) {
            return response()->json([
                'message' => 'No active recipients found for the selected target.',
                'errors' => [],
            ], 422);
        }

        $sent = 0;
        $failed = 0;
        $errors = [];

        foreach ($recipients as $user) {
            try {
                Mail::html(
                    view('emails.broadcast', [
                        'recipientName' => $user->name,
                        'subject' => $request->subject,
                        'body' => $request->message,
                        'senderName' => config('mail.from.name'),
                    ])->render(),
                    function ($msg) use ($user, $request) {
                        $msg->to($user->email, $user->name)
                            ->subject($request->subject);
                    }
                );
                $sent++;
            } catch (\Exception $e) {
                Log::error("Broadcast email failed for {$user->email}: ".$e->getMessage());
                $errors[] = $user->email;
                $failed++;
            }
        }

        $summary = "Delivered to {$sent} recipient".($sent !== 1 ? 's' : '').'.';
        if ($failed > 0) {
            $summary .= " {$failed} failed — check mail logs.";
        }

        return response()->json([
            'data' => ['sent' => $sent, 'failed' => $failed, 'total' => $recipients->count()],
            'message' => $summary,
            'errors' => [],
            'meta' => [],
        ]);
    }

    private function resolveBroadcastRecipients(array $payload): Collection
    {
        return match ($payload['to']) {
            'all' => User::whereNotNull('email')->where('status', 'active')->get(['id', 'name', 'email']),
            'by_role' => User::role($payload['role'] ?? '')->where('status', 'active')->get(['id', 'name', 'email']),
            'by_college' => User::where('college_id', $payload['college_id'])->where('status', 'active')->get(['id', 'name', 'email']),
            'specific' => User::where('email', $payload['email'])->get(['id', 'name', 'email']),
            default => collect(),
        };
    }
}
