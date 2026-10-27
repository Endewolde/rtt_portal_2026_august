<?php

namespace App\Listeners;

use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mime\Email;

/**
 * Gmail drops two things Outlook/Office 365 shows: images written into the HTML as
 * base64 (`data:` URIs — our logo) and inline `<svg>` icons. Just before any email
 * leaves, both become proper inline attachments (`cid:`), which every client shows.
 */
class MakeEmailImagesGmailSafe
{
    /** Render icons at three times their size so they stay sharp on high-density screens. */
    private const ICON_SCALE = 3;

    public function handle(MessageSending $event): void
    {
        $email = $event->message;
        if (! $email instanceof Email) {
            return;
        }
        $html = $email->getHtmlBody();
        if (! is_string($html) || $html === '' || (! str_contains($html, 'data:image') && ! str_contains($html, '<svg'))) {
            return;
        }

        $embedded = [];
        $embed = function (string $bytes, string $mime, string $ext) use ($email, &$embedded): string {
            $hash = md5($bytes);
            if (! isset($embedded[$hash])) {
                $embedded[$hash] = 'img-'.substr($hash, 0, 12).'.'.$ext;
                $email->embed($bytes, $embedded[$hash], $mime);
            }

            return 'cid:'.$embedded[$hash];
        };

        // 1. Base64 images (the logo) → inline attachments.
        $html = preg_replace_callback(
            '/src=(["\'])data:(image\/(png|jpe?g|gif|webp));base64,([^"\']+)\1/i',
            function (array $m) use ($embed) {
                $bytes = base64_decode(preg_replace('/\s+/', '', $m[4]), true);
                if ($bytes === false) {
                    return $m[0];
                }
                $ext = strtolower($m[3]) === 'jpeg' ? 'jpg' : strtolower($m[3]);

                return 'src='.$m[1].$embed($bytes, strtolower($m[2]), $ext).$m[1];
            },
            $html
        );

        // 2. Inline SVG icons → small PNGs (or, if the server cannot draw them, nothing).
        $canRender = $this->canRenderSvg();
        $html = preg_replace_callback('/<svg\b[^>]*>.*?<\/svg>/is', function (array $m) use ($embed, $canRender) {
            if (! $canRender) {
                return '';
            }
            [$width, $height] = $this->size($m[0]);
            $png = $this->rasterise($m[0], $width, $height);
            if ($png === null) {
                return '';
            }

            return '<img src="'.$embed($png, 'image/png', 'png').'" width="'.$width.'" height="'.$height.'" alt="" style="display:inline-block;border:0;outline:none;vertical-align:middle;">';
        }, $html);

        // Without icons, an icon's empty coloured box would be left behind — drop it too.
        if (! $canRender) {
            $html = preg_replace('/<div class="hero-icon"[^>]*>\s*<\/div>/i', '', $html);
        }

        $email->html($html);
    }

    private function canRenderSvg(): bool
    {
        return class_exists(\Imagick::class) && in_array('SVG', \Imagick::queryFormats('SVG'), true);
    }

    /** @return array{0: int, 1: int} */
    private function size(string $svg): array
    {
        preg_match('/\bwidth=["\']?(\d+)/i', $svg, $w);
        preg_match('/\bheight=["\']?(\d+)/i', $svg, $h);

        return [(int) ($w[1] ?? 24) ?: 24, (int) ($h[1] ?? $w[1] ?? 24) ?: 24];
    }

    private function rasterise(string $svg, int $width, int $height): ?string
    {
        if (! str_contains($svg, 'xmlns=')) {
            $svg = preg_replace('/<svg\b/i', '<svg xmlns="http://www.w3.org/2000/svg"', $svg, 1);
        }
        // currentColor has no meaning outside a page; white matches the icons on coloured headers.
        $svg = str_ireplace('currentColor', '#ffffff', $svg);

        // Cached as base64 text: the cache may be a database table, which does not take raw bytes.
        $encoded = Cache::remember('email-svg:'.md5($svg.$width.'x'.$height), now()->addDays(30), function () use ($svg, $width, $height) {
            try {
                $image = new \Imagick;
                $image->setBackgroundColor(new \ImagickPixel('transparent'));
                $image->setResolution(72 * self::ICON_SCALE, 72 * self::ICON_SCALE);
                $image->readImageBlob($svg);
                $image->setImageFormat('png32');
                $image->resizeImage($width * self::ICON_SCALE, $height * self::ICON_SCALE, \Imagick::FILTER_LANCZOS, 1);
                $png = $image->getImageBlob();
                $image->clear();

                return base64_encode($png);
            } catch (\Throwable $e) {
                Log::warning('Email icon could not be rendered: '.$e->getMessage());

                return '';
            }
        });

        return $encoded !== '' ? base64_decode($encoded) : null;
    }
}
