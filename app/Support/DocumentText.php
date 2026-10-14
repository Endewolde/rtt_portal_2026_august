<?php

namespace App\Support;

use App\Models\ProposalDocument;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Smalot\PdfParser\Parser as PdfParser;

/**
 * Plain, lower-cased text of an uploaded proposal document (PDF or Word), cached on
 * the document row so the similarity and anonymity checks don't re-parse files.
 */
class DocumentText
{
    private const MAX_CHARACTERS = 20000;

    private const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    public static function for(ProposalDocument $document): string
    {
        if ($document->extracted_text !== null) {
            return $document->extracted_text;
        }

        $text = self::extract($document);
        $document->forceFill(['extracted_text' => $text])->save();

        return $text;
    }

    /** Whether text can be read from this kind of file at all. */
    public static function supports(ProposalDocument $document): bool
    {
        return $document->mime_type === 'application/pdf' || self::isDocx($document);
    }

    private static function extract(ProposalDocument $document): string
    {
        if (! self::supports($document) || ! Storage::disk('private')->exists($document->stored_path)) {
            return '';
        }

        $path = Storage::disk('private')->path($document->stored_path);

        try {
            $raw = self::isDocx($document) ? self::docxText($path) : (new PdfParser)->parseFile($path)->getText();
        } catch (\Throwable $e) {
            Log::warning("DocumentText: could not extract text from document {$document->id}: {$e->getMessage()}");

            return '';
        }

        return Str::limit(trim(mb_strtolower(preg_replace('/\s+/u', ' ', $raw) ?? '')), self::MAX_CHARACTERS, '');
    }

    private static function isDocx(ProposalDocument $document): bool
    {
        return $document->mime_type === self::DOCX_MIME
            || str_ends_with(mb_strtolower((string) $document->original_filename), '.docx');
    }

    private static function docxText(string $path): string
    {
        $zip = new \ZipArchive;
        if ($zip->open($path) !== true) {
            return '';
        }

        // Body plus headers/footers — author names often sit in a header.
        $xml = '';
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (preg_match('#^word/(document|header\d*|footer\d*)\.xml$#', $name)) {
                $xml .= ' '.$zip->getFromIndex($i);
            }
        }
        $zip->close();

        $xml = preg_replace('#</w:p>|<w:tab/>|<w:br/>#', ' ', $xml);

        return html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
    }
}
