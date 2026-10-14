<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Certificate of Review Service</title>
<style>
    @page { margin: 0; }
    body { margin: 0; font-family: 'DejaVu Serif', Georgia, serif; color: #1f2937; }
    /* A4 landscape is 842 x 595pt and dompdf needs explicit heights (no % / box-sizing):
       18 + 3 + 4 + [1 + 22 + 500 + 1] + 4 + 3 + 18 = 574pt, safely under one page. */
    .page { padding: 18pt; }
    .frame { height: 524pt; border: 3pt solid #1e3a8a; padding: 4pt; }
    .inner { height: 500pt; border: 1pt solid #c7a14a; padding: 22pt 46pt 0; text-align: center; position: relative; }
    .logo { height: 54pt; margin-bottom: 4pt; }
    .logo-fallback { margin: 0 auto 4pt; border-collapse: collapse; }
    .logo-fallback td { width: 48pt; height: 48pt; border-radius: 24pt; background: #1e3a8a; color: #fff; font-weight: bold; font-size: 17pt; text-align: center; vertical-align: middle; }
    .org { font-size: 15px; letter-spacing: 2px; text-transform: uppercase; color: #1e3a8a; font-weight: bold; }
    .office { font-size: 11px; color: #6b7280; letter-spacing: 1px; margin-top: 2px; }
    .title { font-size: 30pt; color: #1e3a8a; margin: 16pt 0 2pt; letter-spacing: 1px; }
    .subtitle { font-size: 12px; color: #c7a14a; letter-spacing: 4px; text-transform: uppercase; }
    .lead { font-size: 11pt; color: #4b5563; margin-top: 16pt; }
    .name { font-size: 24pt; font-style: italic; color: #111827; margin: 6pt auto 2pt; padding: 0 30pt 4pt; border-bottom: 1pt solid #c7a14a; display: inline-block; }
    .body { font-size: 10.5pt; line-height: 1.6; color: #374151; margin: 10pt auto 0; width: 86%; }
    .counts { margin: 12pt auto 0; border-collapse: separate; border-spacing: 10pt 0; }
    .counts td { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 22px; text-align: center; }
    .counts .num { font-size: 22px; font-weight: bold; color: #1e3a8a; }
    .counts .lbl { font-size: 9.5px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
    .footer { position: absolute; left: 46pt; right: 46pt; bottom: 18pt; }
    .footer table { width: 100%; }
    .sig { text-align: center; width: 40%; }
    .sig-line { border-top: 1px solid #374151; margin: 0 auto 4px; width: 80%; padding-top: 4px; font-size: 12px; font-weight: bold; }
    .sig-title { font-size: 10.5px; color: #6b7280; }
    .verify { text-align: right; font-size: 9px; color: #6b7280; vertical-align: bottom; }
    .code { font-family: 'DejaVu Sans Mono', monospace; font-size: 11px; color: #111827; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="page"><div class="frame"><div class="inner">
    @if($logo)
        <img src="{{ $logo }}" class="logo" alt="">
    @else
        <table class="logo-fallback"><tr><td>{{ strtoupper(mb_substr($orgName, 0, 2)) }}</td></tr></table>
    @endif
    <div class="org">{{ $orgName }}</div>
    <div class="office">Research &amp; Technology Transfer</div>

    <div class="title">Certificate of Appreciation</div>
    <div class="subtitle">for Proposal Review Service</div>

    <div class="lead">This certificate is proudly presented to</div>
    <div class="name">{{ $reviewerTitle ? $reviewerTitle.' ' : '' }}{{ $reviewerName }}</div>

    <div class="body">
        in recognition of valuable service as a reviewer of research, community engagement and
        technology transfer proposals during the <strong>{{ $certificate->academic_year }}</strong> academic year,
        contributing expert, independent and confidential evaluation to the university's research funding process.
    </div>

    <table class="counts"><tr>
        <td><div class="num">{{ $certificate->total() }}</div><div class="lbl">Reviews completed</div></td>
        @if($certificate->blind_reviews)
            <td><div class="num">{{ $certificate->blind_reviews }}</div><div class="lbl">Blind reviews</div></td>
        @endif
        @if($certificate->defence_reviews)
            <td><div class="num">{{ $certificate->defence_reviews }}</div><div class="lbl">Open defence evaluations</div></td>
        @endif
    </tr></table>

    <div class="footer"><table><tr>
        <td class="sig">
            <div class="sig-line">{{ $signatoryName ?: ' ' }}</div>
            <div class="sig-title">{{ $signatoryTitle }}</div>
        </td>
        <td class="verify">
            Issued {{ $certificate->issued_at->format('F j, Y') }} · Certificate no. <span class="code">{{ $certificate->code }}</span><br>
            Verify at {{ $verifyUrl }}
        </td>
    </tr></table></div>
</div></div></div>
</body>
</html>
