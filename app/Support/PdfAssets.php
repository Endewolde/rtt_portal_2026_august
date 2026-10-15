<?php

namespace App\Support;

/** Helpers for dompdf, which can't fetch images over HTTP. */
class PdfAssets
{
    /** The uploaded logo (a public URL or path) as a data URI, or null if it isn't on disk. */
    public static function embeddedImage(?string $url): ?string
    {
        if (! $url) {
            return null;
        }

        $path = public_path(ltrim(parse_url($url, PHP_URL_PATH) ?? '', '/'));
        if (! is_file($path)) {
            return null;
        }

        $mime = mime_content_type($path) ?: 'image/png';

        return "data:{$mime};base64,".base64_encode(file_get_contents($path));
    }
}
