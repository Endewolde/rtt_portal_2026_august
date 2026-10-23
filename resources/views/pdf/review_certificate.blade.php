<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="utf-8">
<title>{{ __('Certificate of Appreciation') }}</title>
@php
    use App\Support\CertificateArt as Art;
    // A4 landscape is 842 × 595pt; dompdf needs absolute positions and explicit sizes.
    $navy = '#0b3a66';
    $ink = '#0f2942';
    $gold = '#b8923a';
    $engraving = Art::engraving(783, 536, '#0b3a66');
    $corners = collect(['tl', 'tr', 'bl', 'br'])->mapWithKeys(fn ($c) => [$c => Art::corner($gold, $c)]);
    $flourish = Art::flourish(300, $gold);
    $seal = Art::seal($gold, $navy, $gold);
    $ribbons = Art::ribbons($navy, $gold);
    $laurel = Art::laurel($gold);
    $fullName = trim(($reviewerTitle ? $reviewerTitle.' ' : '').$reviewerName);
    $ethiopic = app()->getLocale() === 'am';
    $nameSize = Art::fitSize($fullName, 600, 0.56, 32, 18);
    $issued = $certificate->issued_at?->translatedFormat('j F Y');
    $verifyAt = preg_replace('#^https?://#', '', rtrim(config('app.url'), '/')).'/certificates/verify';
@endphp
<style>
@include('pdf.partials.fonts')
@font-face { font-family: 'Lato'; font-weight: normal; font-style: normal; src: url('{{ resource_path('fonts/Lato-Regular.ttf') }}') format('truetype'); }
@font-face { font-family: 'Lato'; font-weight: bold; font-style: normal; src: url('{{ resource_path('fonts/Lato-Bold.ttf') }}') format('truetype'); }

@page { margin: 0; }
body { margin: 0; background: #ffffff; font-family: 'Lato', 'Noto Sans Ethiopic', sans-serif; color: #374151; }

/* Frame: heavy navy border, then a gold line, then a fine navy one. In dompdf a border
   adds to the width and height, so each box is the page minus its inset and borders. */
.frame-outer { position: absolute; left: 14pt; top: 14pt; width: 800pt; height: 553pt; border: 7pt solid {{ $navy }}; }
.frame-gold { position: absolute; left: 25pt; top: 25pt; width: 788pt; height: 541pt; border: 1.5pt solid {{ $gold }}; }
.frame-inner { position: absolute; left: 30pt; top: 30pt; width: 781pt; height: 534pt; border: 0.5pt solid {{ $navy }}; }
.engraving { position: absolute; left: 30pt; top: 30pt; width: 782pt; height: 535pt; opacity: 0.05; }
.corner { position: absolute; width: 58pt; height: 58pt; }

/* The university crest, large and faint, in the middle of the page. */
.watermark { position: absolute; left: 291pt; top: 150pt; width: 260pt; height: 260pt; opacity: 0.06; }

/* Header corners: academic-year emblem (left), seal with ribbons (right). */
.emblem { position: absolute; left: 70pt; top: 58pt; width: 80pt; height: 80pt; }
.emblem img { position: absolute; left: 0; top: 0; width: 80pt; height: 80pt; }
.emblem-text { position: absolute; left: 0; top: 27pt; width: 80pt; text-align: center; }
.emblem-text .k { color: #6b7280; font-size: 4.6pt; letter-spacing: 0.4pt; text-transform: uppercase; }
.emblem-text .v { color: {{ $navy }}; font-size: 11.5pt; font-weight: bold; margin-top: 1pt; }
.seal-wrap { position: absolute; right: 66pt; top: 54pt; width: 78pt; height: 96pt; }
.seal-wrap .ribbons { position: absolute; left: 15pt; top: 50pt; width: 48pt; height: 38pt; }
.seal-wrap .seal { position: absolute; left: 0; top: 0; width: 78pt; height: 78pt; }
.seal-text { position: absolute; left: 0; top: 25pt; width: 78pt; text-align: center; color: #ffffff; }
.seal-text .t { font-size: 4.6pt; letter-spacing: 0.7pt; color: #e3c27a; text-transform: uppercase; }
.seal-text .y { font-size: 10.5pt; font-weight: bold; margin-top: 2pt; }

.content { position: absolute; left: 60pt; top: 46pt; width: 722pt; text-align: center; }
.crest { width: 66pt; height: 66pt; }
.org { margin-top: 6pt; color: {{ $ink }}; font-weight: bold; font-size: 10pt; letter-spacing: 2pt; text-transform: uppercase; }
.office { margin-top: 2pt; color: {{ $gold }}; font-size: 8pt; font-weight: bold; letter-spacing: 1.2pt; text-transform: uppercase; }
.title { margin-top: 14pt; color: {{ $navy }}; font-weight: bold; font-size: 38pt; letter-spacing: 6pt; text-transform: uppercase; line-height: 1; }
.subtitle { margin: 7pt auto 0; border-collapse: collapse; }
.subtitle td { vertical-align: middle; }
.subtitle .rule { width: 70pt; border-top: 1pt solid {{ $gold }}; }
.subtitle .text { padding: 0 12pt; color: {{ $gold }}; font-weight: bold; font-size: 11pt; letter-spacing: 4pt; text-transform: uppercase; white-space: nowrap; }
.lead { margin-top: 14pt; color: #4b5563; font-size: 11.5pt; }
.name { margin-top: 6pt; color: {{ $navy }}; font-weight: bold; line-height: 1.1; }
.flourish { margin-top: 4pt; width: 300pt; height: 16pt; }
.body { margin: 8pt auto 0; width: 640pt; color: #374151; font-size: 10pt; line-height: 1.5; }
.body strong { color: {{ $ink }}; }
.date { margin-top: 8pt; color: #374151; font-size: 10pt; }
.date strong { color: {{ $ink }}; }

/* Footer: QR and number · signature · review record. */
.footer { position: absolute; left: 84pt; top: 436pt; width: 674pt; }
.footer table.cols { width: 100%; border-collapse: collapse; }
.footer td.col { vertical-align: bottom; }
.qr-col { width: 236pt; }
.qr-col table { border-collapse: collapse; }
.qr-col td { vertical-align: middle; }
.qr { width: 70pt; height: 70pt; padding: 3pt; background: #ffffff; border: 0.75pt solid {{ $gold }}; }
.verify { padding-left: 11pt; }
.verify .label { color: {{ $gold }}; font-size: 6.5pt; font-weight: bold; letter-spacing: 1.4pt; text-transform: uppercase; }
.verify .link { margin-top: 3pt; color: {{ $navy }}; font-size: 8pt; font-weight: bold; line-height: 1.3; }
.verify .no-label { margin-top: 9pt; color: #6b7280; font-size: 6.5pt; letter-spacing: 1.2pt; text-transform: uppercase; }
.verify .no { margin-top: 2pt; color: {{ $ink }}; font-size: 10pt; font-weight: bold; letter-spacing: 0.5pt; font-family: 'DejaVu Sans Mono', monospace; }
.sig-col { text-align: center; }
.sig-space { height: 30pt; }
.sig-line { margin: 0 auto; width: 180pt; border-top: 0.75pt solid {{ $ink }}; padding-top: 5pt; color: {{ $ink }}; font-size: 10.5pt; font-weight: bold; }
.sig-title { margin: 2pt auto 0; width: 232pt; color: #6b7280; font-size: 8pt; line-height: 1.3; }

/* Review record card: navy header strip, then the figures side by side. */
.record-col { width: 206pt; }
.record-card { border: 0.75pt solid #d9c48f; background: #ffffff; }
.record-head { background: {{ $navy }}; padding: 5pt 9pt; }
.record-head table { width: 100%; border-collapse: collapse; }
.record-head .k { color: #ffffff; font-size: 7pt; font-weight: bold; letter-spacing: 1.2pt; text-transform: uppercase; }
.record-head .y { color: #e3c27a; font-size: 8pt; font-weight: bold; text-align: right; }
.record-gold { height: 2pt; background: {{ $gold }}; }
.figures { width: 100%; border-collapse: collapse; }
.figures td { width: 33.3%; padding: 8pt 4pt 7pt; text-align: center; vertical-align: top; }
.figures td + td { border-left: 0.75pt solid #eee3c7; }
.figures .n { color: {{ $navy }}; font-size: 20pt; font-weight: bold; line-height: 1; }
.figures .l { margin-top: 4pt; color: #6b7280; font-size: 6.3pt; letter-spacing: 0.5pt; text-transform: uppercase; line-height: 1.3; }


.am .org, .am .office, .am .title, .am .subtitle .text, .am .emblem-text .k, .am .seal-text .t,
.am .verify .label, .am .verify .no-label, .am .record-head .k, .am .figures .l { letter-spacing: 0; }
.am .title { font-size: 30pt; }
</style>
</head>
<body class="{{ $ethiopic ? 'am' : '' }}">
<img src="{{ $engraving }}" class="engraving" alt="">
<div class="frame-outer"></div>
<div class="frame-gold"></div>
<div class="frame-inner"></div>
<img src="{{ $corners['tl'] }}" class="corner" style="left: 36pt; top: 36pt;" alt="">
<img src="{{ $corners['tr'] }}" class="corner" style="left: 748pt; top: 36pt;" alt="">
<img src="{{ $corners['bl'] }}" class="corner" style="left: 36pt; top: 501pt;" alt="">
<img src="{{ $corners['br'] }}" class="corner" style="left: 748pt; top: 501pt;" alt="">
@if($logo)<img src="{{ $logo }}" class="watermark" alt="">@endif

<div class="emblem">
    <img src="{{ $laurel }}" alt="">
    <div class="emblem-text">
        <div class="k">{{ __('Academic year') }}</div>
        <div class="v">{{ $certificate->academic_year }}</div>
    </div>
</div>

<div class="seal-wrap">
    <img src="{{ $ribbons }}" class="ribbons" alt="">
    <img src="{{ $seal }}" class="seal" alt="">
    <div class="seal-text">
        <div class="t">{{ __('Review service') }}</div>
        <div class="y">{{ __('Certified') }}</div>
    </div>
</div>

<div class="content">
    @if($logo)<img src="{{ $logo }}" class="crest" alt="">@endif
    <div class="org">{{ $orgName }}</div>
    <div class="office">{{ __('Research & Technology Transfer') }}</div>

    <div class="title">{{ __('Certificate') }}</div>
    <table class="subtitle"><tr>
        <td class="rule"></td>
        <td class="text">{{ __('of Appreciation') }}</td>
        <td class="rule"></td>
    </tr></table>

    <div class="lead">{{ __('This certificate is proudly awarded to') }}</div>
    <div class="name" style="font-size: {{ $nameSize }}pt;">{{ $fullName }}</div>
    <img src="{{ $flourish }}" class="flourish" alt="">

    <div class="body">
        {!! __('For valuable service as a reviewer of <strong>research, community engagement and technology transfer proposals</strong> during the <strong>:year</strong> academic year, contributing expert, independent and confidential evaluation to the university\'s research funding process.', ['year' => e($certificate->academic_year)]) !!}
    </div>
    <div class="date">{{ __('Date of issue:') }} <strong>{{ $issued }}</strong></div>
</div>

<div class="footer">
    <table class="cols"><tr>
        <td class="col qr-col">
            <table><tr>
                @if($qrCode)<td><img src="{{ $qrCode }}" class="qr" alt="{{ __('Verification QR code') }}"></td>@endif
                <td class="verify">
                    <div class="label">{{ __('Scan to verify') }}</div>
                    <div class="link">{{ $verifyAt }}</div>
                    <div class="no-label">{{ __('Certificate No.') }}</div>
                    <div class="no">{{ $certificate->code }}</div>
                </td>
            </tr></table>
        </td>
        <td class="col sig-col">
            <div class="sig-space"></div>
            <div class="sig-line">{{ $signatoryName ?: ' ' }}</div>
            <div class="sig-title">{{ $signatoryTitle }}</div>
        </td>
        <td class="col record-col">
            <div class="record-card">
                <div class="record-head">
                    <table><tr>
                        <td class="k">{{ __('Review service record') }}</td>
                        <td class="y">{{ $certificate->academic_year }}</td>
                    </tr></table>
                </div>
                <div class="record-gold"></div>
                <table class="figures"><tr>
                    <td><div class="n">{{ $certificate->total() }}</div><div class="l">{{ __('Reviews completed') }}</div></td>
                    <td><div class="n">{{ $certificate->blind_reviews }}</div><div class="l">{{ __('Blind reviews') }}</div></td>
                    <td><div class="n">{{ $certificate->defence_reviews }}</div><div class="l">{{ __('Open defence evaluations') }}</div></td>
                </tr></table>
            </div>
        </td>
    </tr></table>
</div>

</body>
</html>
