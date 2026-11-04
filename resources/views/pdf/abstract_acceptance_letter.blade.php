<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Letter of acceptance – {{ $abstract->title }}</title>
<style>
@include('pdf.partials.fonts')
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { margin: 0; }
    body { font-family: 'DejaVu Serif', Georgia, 'Noto Sans Ethiopic', serif; font-size: 11pt; color: #1f2937; line-height: 1.6; }
    .page { padding: 52px 64px 48px; }
    .head { border-bottom: 2px solid #0b3a66; padding-bottom: 14px; margin-bottom: 30px; }
    .org { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; letter-spacing: 1.5px; text-transform: uppercase; color: #0b3a66; font-weight: bold; }
    .conf { font-size: 17pt; font-weight: bold; color: #111827; margin-top: 4px; line-height: 1.25; }
    .meta { font-family: 'DejaVu Sans', sans-serif; font-size: 8.5pt; color: #6b7280; margin-top: 4px; }
    .ref { font-family: 'DejaVu Sans', sans-serif; font-size: 8.5pt; color: #6b7280; margin-bottom: 22px; }
    .ref td { padding: 1px 16px 1px 0; }
    h1 { font-size: 13pt; letter-spacing: .5px; text-transform: uppercase; color: #0b3a66; margin-bottom: 16px; }
    p { margin-bottom: 11px; text-align: justify; }
    .box { border-left: 3px solid #0b3a66; background: #f3f6fa; padding: 12px 16px; margin: 16px 0 18px; }
    .box .t { font-weight: bold; font-size: 11.5pt; color: #111827; line-height: 1.4; }
    .box table { margin-top: 8px; font-family: 'DejaVu Sans', sans-serif; font-size: 8.5pt; color: #374151; }
    .box td { padding: 1.5px 14px 1.5px 0; vertical-align: top; }
    .box td.k { color: #6b7280; white-space: nowrap; }
    .notes { white-space: pre-line; }
    .sign { margin-top: 34px; }
    .sign .line { width: 200px; border-top: 1px solid #9ca3af; margin: 38px 0 4px; }
    .foot { position: fixed; bottom: 26px; left: 64px; right: 64px; border-top: 1px solid #e5e7eb; padding-top: 6px; font-family: 'DejaVu Sans', sans-serif; font-size: 7.5pt; color: #9ca3af; }
</style>
</head>
<body>
<div class="foot">Reference {{ $reference }} · Issued {{ $issuedAt->format('j F Y') }} · {{ $orgName }}</div>
<div class="page">
    <div class="head">
        <div class="org">{{ $orgName }}</div>
        <div class="conf">{{ $conference->title }}</div>
        <div class="meta">
            {{ $conference->start_date?->format('j F Y') }}@if ($conference->end_date && ! $conference->end_date->isSameDay($conference->start_date)) – {{ $conference->end_date->format('j F Y') }}@endif
            @if ($conference->location_address) · {{ $conference->location_address }}@endif
        </div>
    </div>

    <table class="ref">
        <tr><td>Date</td><td>{{ $issuedAt->format('j F Y') }}</td></tr>
        <tr><td>Reference</td><td>{{ $reference }}</td></tr>
    </table>

    <h1>Letter of acceptance</h1>

    <p>Dear {{ $abstract->submitter_name }},</p>

    <p>On behalf of the organising committee, we are pleased to inform you that, following peer review, the abstract below has been accepted for {{ $type === 'poster' ? 'poster' : ($type === 'oral' ? 'oral' : $type) }} presentation at {{ $conference->title }}.</p>

    <div class="box">
        <div class="t">{{ $abstract->title }}</div>
        <table>
            <tr><td class="k">Authors</td><td>{{ collect($authors)->pluck('name')->join(', ') }}</td></tr>
            <tr><td class="k">Presenting author</td><td>{{ $presenter }}</td></tr>
            <tr><td class="k">Format</td><td>{{ ucfirst($type) }}</td></tr>
            @if ($abstract->track)<tr><td class="k">Track</td><td>{{ $abstract->track->name }}</td></tr>@endif
            @if ($abstract->session)
                <tr><td class="k">Session</td><td>{{ $abstract->session->title }}</td></tr>
                @if ($abstract->session->starts_at)<tr><td class="k">Time</td><td>{{ $abstract->session->starts_at->format('l j F Y, H:i') }}@if ($abstract->session->ends_at)–{{ $abstract->session->ends_at->format('H:i') }}@endif</td></tr>@endif
                @if ($abstract->session->room)<tr><td class="k">Room</td><td>{{ $abstract->session->room }}</td></tr>@endif
            @endif
        </table>
    </div>

    @if ($abstract->admin_notes)
        <p class="notes">{{ $abstract->admin_notes }}</p>
    @endif

    <p>This letter may be presented in support of travel, leave or funding requests. We look forward to welcoming you to the conference.</p>

    <div class="sign">
        <p style="margin-bottom:0">Yours sincerely,</p>
        <div class="line"></div>
        <p style="margin-bottom:0"><strong>Organising Committee</strong><br>{{ $conference->title }}</p>
    </div>
</div>
</body>
</html>
