<?php

namespace App\Services;

use App\Jobs\SendEmailNotificationJob;
use App\Jobs\SendSmsJob;
use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Text messages through Africa's Talking, for the events that matter most (an
 * award, a decision, a review assignment…). Off until switched on in Settings;
 * each person can turn SMS off for themselves. Uses the plain HTTP API, so no
 * extra package is needed.
 */
class SmsService
{
    private const KEYS = ['sms_enabled', 'africastalking_username', 'africastalking_api_key', 'africastalking_sender_id', 'sms_events', 'system_name'];

    public const CACHE_KEY = 'sms_settings';

    /** @return array<string, string> */
    private function settings(): array
    {
        return Cache::remember(self::CACHE_KEY, 300, fn () => AppSetting::whereIn('key', self::KEYS)->pluck('value', 'key')->all());
    }

    public function isEnabled(): bool
    {
        $s = $this->settings();

        return filter_var($s['sms_enabled'] ?? false, FILTER_VALIDATE_BOOLEAN)
            && ! empty($s['africastalking_username']) && ! empty($s['africastalking_api_key']);
    }

    /** @return list<string> */
    public function events(): array
    {
        return array_values(array_filter(array_map('trim', explode(',', (string) ($this->settings()['sms_events'] ?? '')))));
    }

    /**
     * Called for every in-app notification: queue a text too when SMS is on, the
     * event is one that warrants it, and the person has a phone and has not
     * switched SMS off.
     *
     * @param  array<string, mixed>  $data
     */
    public function notifyIfWanted(string $userId, string $event, array $data): void
    {
        if (! $this->isEnabled() || ! in_array($event, $this->events(), true)) {
            return;
        }

        $user = User::find($userId);
        $phone = $user ? self::normalize($user->phone) : null;
        if (! $user || ! $phone || $user->status !== 'active') {
            return;
        }

        $optedIn = DB::table('notification_preferences')->where('user_id', $userId)->value('sms_enabled');
        if ($optedIn !== null && ! $optedIn) {
            return;
        }

        SendSmsJob::deliver($phone, $this->text($user, $event, $data));
    }

    /**
     * Send one message now. Returns whether the gateway accepted it.
     */
    public function send(string $phone, string $message): bool
    {
        $s = $this->settings();
        $to = self::normalize($phone);
        if (! $to || empty($s['africastalking_username']) || empty($s['africastalking_api_key'])) {
            return false;
        }

        $sandbox = strtolower($s['africastalking_username']) === 'sandbox';
        $url = $sandbox
            ? 'https://api.sandbox.africastalking.com/version1/messaging'
            : 'https://api.africastalking.com/version1/messaging';

        $response = Http::asForm()
            ->withHeaders(['apiKey' => $s['africastalking_api_key'], 'Accept' => 'application/json'])
            ->timeout(15)
            ->post($url, array_filter([
                'username' => $s['africastalking_username'],
                'to' => $to,
                'message' => $message,
                'from' => $s['africastalking_sender_id'] ?? null,
            ]));

        $recipient = $response->json('SMSMessageData.Recipients.0');
        $ok = $response->successful() && in_array($recipient['statusCode'] ?? null, [100, 101, 102], true);

        if (! $ok) {
            Log::warning('SMS not accepted', ['to' => $to, 'status' => $response->status(), 'gateway' => $recipient['status'] ?? $response->body()]);
        }

        return $ok;
    }

    /**
     * Ethiopian numbers in international form: 0911…, 911…, 251911… and +251911…
     * all become +251911…; other numbers starting with + are kept as they are.
     */
    public static function normalize(?string $phone): ?string
    {
        $digits = preg_replace('/[^\d+]/', '', (string) $phone);
        if ($digits === '') {
            return null;
        }
        if (str_starts_with($digits, '+')) {
            return strlen($digits) >= 10 ? $digits : null;
        }
        if (str_starts_with($digits, '251') && strlen($digits) === 12) {
            return '+'.$digits;
        }
        if (str_starts_with($digits, '0') && strlen($digits) === 10) {
            return '+251'.substr($digits, 1);
        }
        if (strlen($digits) === 9 && in_array($digits[0], ['7', '9'], true)) {
            return '+251'.$digits;
        }

        return null;
    }

    /**
     * A short text: the system name, then the notification's own message or its
     * email subject, cut to fit two SMS segments.
     *
     * @param  array<string, mixed>  $data
     */
    private function text(User $user, string $event, array $data): string
    {
        $body = trim((string) ($data['message'] ?? ''));
        if ($body === '') {
            $body = (new SendEmailNotificationJob($user, $event, $data))->subjectLine();
        }
        $body = preg_replace('/\s+/', ' ', $body);
        $prefix = ($this->settings()['system_name'] ?? 'RTT').': ';

        return mb_strimwidth($prefix.$body, 0, 300, '…');
    }
}
