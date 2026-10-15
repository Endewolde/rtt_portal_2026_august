<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Makes the platform installable on phones (Add to Home Screen): the web app manifest,
 * built from the branding settings, and square home-screen icons made from the logo.
 */
class PwaController extends Controller
{
    private const ICON_SIZES = [192, 512];

    public function manifest(): JsonResponse
    {
        $s = $this->settings();
        $name = $s['system_name'] ?: 'RTT Platform';
        $org = $s['organization_name'];

        return response()->json([
            'name' => $org ? "{$name} — {$org}" : $name,
            'short_name' => mb_substr($name, 0, 12),
            'description' => 'Research proposals, reviews and open defence scoring.',
            'start_url' => '/dashboard',
            'scope' => '/',
            'display' => 'standalone',
            'orientation' => 'portrait',
            'background_color' => '#ffffff',
            'theme_color' => $s['primary_color'] ?: '#1e3a8a',
            'icons' => collect(self::ICON_SIZES)->flatMap(fn ($size) => [
                ['src' => "/pwa-icon/{$size}.png", 'sizes' => "{$size}x{$size}", 'type' => 'image/png', 'purpose' => 'any'],
                ['src' => "/pwa-icon/{$size}.png", 'sizes' => "{$size}x{$size}", 'type' => 'image/png', 'purpose' => 'maskable'],
            ])->values(),
            'shortcuts' => [
                ['name' => 'My Reviews', 'url' => '/reviews', 'icons' => [['src' => '/pwa-icon/192.png', 'sizes' => '192x192']]],
                ['name' => 'Notifications', 'url' => '/notifications', 'icons' => [['src' => '/pwa-icon/192.png', 'sizes' => '192x192']]],
            ],
        ], 200, ['Content-Type' => 'application/manifest+json', 'Cache-Control' => 'public, max-age=3600']);
    }

    /** A square icon with the logo centred inside the maskable safe zone, or initials if there's no logo. */
    public function icon(int $size): Response
    {
        abort_unless(in_array($size, self::ICON_SIZES, true), 404);

        $s = $this->settings();
        $logo = $s['system_logo'] ?: $s['favicon'];
        $key = 'pwa/icon-'.$size.'-'.md5($logo.'|'.$s['primary_color'].'|'.$s['system_name']).'.png';
        $disk = Storage::disk('local');

        if (! $disk->exists($key)) {
            $disk->put($key, $this->render($size, $logo, $s['primary_color'] ?: '#1e3a8a', $s['system_name'] ?: 'RTT'));
        }

        return response($disk->get($key), 200, ['Content-Type' => 'image/png', 'Cache-Control' => 'public, max-age=86400']);
    }

    private function render(int $size, ?string $logo, string $color, string $name): string
    {
        $canvas = imagecreatetruecolor($size, $size);
        imagealphablending($canvas, true);
        $logoPath = $logo ? public_path(ltrim(parse_url($logo, PHP_URL_PATH) ?? '', '/')) : null;
        $image = $logoPath && is_file($logoPath) ? @imagecreatefromstring((string) file_get_contents($logoPath)) : false;

        if ($image) {
            imagefill($canvas, 0, 0, imagecolorallocate($canvas, 255, 255, 255));
            // Maskable icons may be cropped to a circle: keep the logo within the central 72%.
            $box = (int) round($size * 0.72);
            $ratio = min($box / imagesx($image), $box / imagesy($image));
            $w = (int) round(imagesx($image) * $ratio);
            $h = (int) round(imagesy($image) * $ratio);
            imagecopyresampled($canvas, $image, (int) (($size - $w) / 2), (int) (($size - $h) / 2), 0, 0, $w, $h, imagesx($image), imagesy($image));
            imagedestroy($image);
        } else {
            [$r, $g, $b] = sscanf(ltrim($color, '#'), '%02x%02x%02x') ?: [30, 58, 138];
            imagefill($canvas, 0, 0, imagecolorallocate($canvas, $r ?? 30, $g ?? 58, $b ?? 138));
            $font = base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Bold.ttf');
            $text = mb_strtoupper(mb_substr(preg_replace('/[^\pL\pN]/u', '', $name) ?: 'R', 0, 3));
            $fontSize = $size * 0.22;
            $bbox = imagettfbbox($fontSize, 0, $font, $text);
            imagettftext($canvas, $fontSize, 0, (int) (($size - ($bbox[2] - $bbox[0])) / 2), (int) (($size + ($bbox[1] - $bbox[7])) / 2), imagecolorallocate($canvas, 255, 255, 255), $font, $text);
        }

        ob_start();
        imagepng($canvas);
        imagedestroy($canvas);

        return (string) ob_get_clean();
    }

    /** @return array<string, string|null> */
    private function settings(): array
    {
        $keys = ['system_name', 'organization_name', 'system_logo', 'favicon', 'primary_color'];
        $values = DB::table('app_settings')->whereIn('key', $keys)->pluck('value', 'key');

        return collect($keys)->mapWithKeys(fn ($k) => [$k => $values[$k] ?? null])->all();
    }
}
