<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileUploadService
{
    private array $allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/jpeg',
        'image/png',
        'image/gif',
        'text/plain',
    ];

    private int $maxFileSizeBytes = 20 * 1024 * 1024; // 20 MB

    /**
     * Validate and store a file securely.
     * Validates MIME type via finfo — not extension — to prevent spoofing.
     *
     * @throws \InvalidArgumentException
     */
    public function store(
        UploadedFile $file,
        string $directory,
        array $allowedMimes = [],
        int $maxBytes = 0
    ): string {
        $allowedMimes = $allowedMimes ?: $this->allowedMimeTypes;
        $maxBytes     = $maxBytes ?: $this->maxFileSizeBytes;

        if ($file->getSize() > $maxBytes) {
            throw new \InvalidArgumentException(
                'File size exceeds maximum allowed size of '.($maxBytes / 1024 / 1024).'MB.'
            );
        }

        // Validate actual MIME type using finfo — never trust the extension alone
        $finfo    = new \finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file->getRealPath());

        if (! in_array($mimeType, $allowedMimes, true)) {
            throw new \InvalidArgumentException(
                "File type '{$mimeType}' is not allowed."
            );
        }

        // Store under a UUID filename — never use the original filename
        $extension = strtolower($file->getClientOriginalExtension());
        $safeName  = Str::uuid().'.'.$extension;
        $path      = $directory.'/'.$safeName;

        Storage::disk('private')->put($path, file_get_contents($file->getRealPath()));

        return $path;
    }

    /**
     * Generate a time-limited signed download URL for a private file.
     * Files are never directly publicly accessible.
     */
    public function temporaryUrl(string $path, int $expiryMinutes = 60): string
    {
        $expires   = now()->addMinutes($expiryMinutes)->timestamp;
        $signature = hash_hmac('sha256', $path.'|'.$expires, config('app.key'));

        return route('files.download', [
            'path'      => base64_encode($path),
            'signature' => $signature,
            'expires'   => $expires,
        ]);
    }
}
