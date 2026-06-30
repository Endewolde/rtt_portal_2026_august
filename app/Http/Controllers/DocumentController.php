<?php

namespace App\Http\Controllers;

use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\DB;

class DocumentController extends Controller
{
    private function settings(): array
    {
        $raw = DB::table('app_settings')->pluck('value', 'key');

        return [
            'orgName' => $raw['organization_name'] ?? 'Wolaita Sodo University',
            'tagline' => $raw['tagline'] ?? 'Research & Technology Transfer Management System',
            'email' => $raw['contact_email'] ?? '',
            'phone' => $raw['phone'] ?? '',
            'address' => $raw['address'] ?? 'Wolaita Sodo, Ethiopia',
            'website' => $raw['website'] ?? '',
            'fax' => $raw['fax'] ?? '',
            'year' => date('Y'),
        ];
    }

    public function userManual()
    {
        $s = $this->settings();

        $pdf = Pdf::loadView('pdf.user_manual_v2', $s)
            ->setPaper('a4', 'portrait')
            ->setOption('isRemoteEnabled', false)
            ->setOption('isHtml5ParserEnabled', true)
            ->setOption('defaultFont', 'helvetica');

        return $pdf->download('RTT-User-Manual-'.$s['year'].'.pdf');
    }

    public function productShowcase()
    {
        $stats = [
            'proposals' => DB::table('proposals')->count(),
            'funded' => DB::table('proposals')->whereIn('status', ['funded', 'completed'])->count(),
            'users' => DB::table('users')->count(),
            'colleges' => DB::table('colleges')->count(),
        ];

        $pdf = Pdf::loadView('pdf.product_showcase', array_merge($this->settings(), ['stats' => $stats]))
            ->setPaper('a4', 'portrait')
            ->setOption('isRemoteEnabled', false)
            ->setOption('isHtml5ParserEnabled', true)
            ->setOption('defaultFont', 'helvetica');

        return $pdf->download('RTT-Platform-Product-Showcase.pdf');
    }
}
