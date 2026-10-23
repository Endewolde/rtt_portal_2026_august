<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Open Defence Record — {{ $proposal->tracker_number }}</title>
<style>
@include('pdf.partials.fonts')
    @page { margin: 36pt 40pt 48pt; }
    body { font-family: 'DejaVu Sans', 'Noto Sans Ethiopic', sans-serif; font-size: 9.5pt; color: #1f2937; }
    .head { border-bottom: 2pt solid #1e3a8a; padding-bottom: 10pt; margin-bottom: 14pt; }
    .head td { vertical-align: middle; }
    .logo { height: 46pt; }
    .org { font-size: 12pt; font-weight: bold; color: #1e3a8a; letter-spacing: 0.5pt; }
    .office { font-size: 8.5pt; color: #6b7280; }
    .doc-title { font-size: 15pt; font-weight: bold; color: #111827; text-align: right; }
    .doc-sub { font-size: 8.5pt; color: #6b7280; text-align: right; }
    h2 { font-size: 10.5pt; color: #1e3a8a; margin: 16pt 0 6pt; padding-bottom: 3pt; border-bottom: 0.75pt solid #e5e7eb; text-transform: uppercase; letter-spacing: 0.5pt; }
    table.kv { width: 100%; border-collapse: collapse; }
    table.kv td { padding: 3pt 0; vertical-align: top; }
    table.kv td.k { width: 30%; color: #6b7280; }
    table.grid { width: 100%; border-collapse: collapse; }
    table.grid th { background: #f3f4f6; color: #374151; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.3pt; text-align: left; padding: 5pt 6pt; border-bottom: 0.75pt solid #d1d5db; }
    table.grid td { padding: 6pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .muted { color: #9ca3af; }
    .comment { color: #4b5563; font-size: 8.5pt; margin-top: 3pt; }
    .result td { padding: 5pt 6pt; }
    .result .total td { font-weight: bold; border-top: 0.75pt solid #9ca3af; }
    .outcome { margin-top: 10pt; padding: 8pt 10pt; background: #eef2ff; border-left: 3pt solid #1e3a8a; font-size: 10pt; }
    .sigs { width: 100%; margin-top: 34pt; }
    .sigs td { width: 33%; padding: 0 10pt; text-align: center; vertical-align: top; }
    .sig-line { border-top: 0.75pt solid #374151; padding-top: 4pt; font-size: 8.5pt; font-weight: bold; }
    .sig-role { font-size: 8pt; color: #6b7280; }
    .footer { position: fixed; bottom: -30pt; left: 0; right: 0; font-size: 7.5pt; color: #9ca3af; text-align: center; }
</style>
</head>
<body>
<div class="footer">Generated {{ $generatedAt->format('M j, Y g:i A') }}{{ $generatedBy ? ' by '.$generatedBy : '' }} · {{ $proposal->tracker_number }} · Research &amp; Technology Transfer</div>

<table class="head" width="100%"><tr>
    <td width="60%">
        <table><tr>
            @if($logo)<td style="padding-right:8pt"><img src="{{ $logo }}" class="logo" alt=""></td>@endif
            <td><div class="org">{{ $orgName }}</div><div class="office">Research &amp; Technology Transfer</div></td>
        </tr></table>
    </td>
    <td><div class="doc-title">Open Defence Record</div><div class="doc-sub">{{ $proposal->tracker_number }}</div></td>
</tr></table>

<h2>Session</h2>
<table class="kv">
    <tr><td class="k">Date</td><td>{{ $session->scheduled_date?->format('l, F j, Y') ?? '—' }}{{ $session->scheduled_time ? ' at '.substr((string) $session->scheduled_time, 0, 5) : '' }}</td></tr>
    <tr><td class="k">Venue</td><td>{{ $session->venue ?: '—' }}{{ $session->online_link ? ' · online: '.$session->online_link : '' }}</td></tr>
    <tr><td class="k">Session status</td><td>{{ ucfirst(str_replace('_', ' ', (string) $session->status)) }}</td></tr>
</table>

<h2>Proposal</h2>
<table class="kv">
    <tr><td class="k">Title</td><td><strong>{{ $proposal->title }}</strong></td></tr>
    <tr><td class="k">Category</td><td>{{ ucwords(str_replace('_', ' ', (string) $proposal->category)) }}</td></tr>
    <tr><td class="k">College / Department</td><td>{{ $proposal->college?->name ?? '—' }}{{ $proposal->department?->name ? ' / '.$proposal->department->name : '' }}</td></tr>
    <tr><td class="k">Principal investigator</td><td>{{ $pi ?? '—' }}</td></tr>
    @if(count($team))<tr><td class="k">Team</td><td>{{ implode(', ', $team) }}</td></tr>@endif
</table>

<h2>Panel and Scores</h2>
<table class="grid">
    <thead><tr><th style="width:4%">#</th><th>Panel member</th><th class="num" style="width:16%">Score</th><th style="width:20%">Submitted</th></tr></thead>
    <tbody>
    @forelse($panel as $i => $m)
        <tr>
            <td class="muted">{{ $i + 1 }}</td>
            <td>
                <strong>{{ $m['name'] ?? 'Unknown' }}</strong>
                @if($m['recommendation'])<div class="comment">Recommendation: {{ ucfirst(str_replace('_', ' ', $m['recommendation'])) }}</div>@endif
                @foreach($m['comments'] as $c)<div class="comment">“{{ $c }}”</div>@endforeach
            </td>
            <td class="num">@if($m['submitted']){{ rtrim(rtrim(number_format($m['score'], 2), '0'), '.') }} / {{ rtrim(rtrim(number_format($m['max'], 2), '0'), '.') }}@else<span class="muted">Not submitted</span>@endif</td>
            <td>{{ $m['submitted_at']?->format('M j, Y g:i A') ?? '—' }}</td>
        </tr>
    @empty
        <tr><td colspan="4" class="muted">No panel members were assigned.</td></tr>
    @endforelse
    </tbody>
</table>

<h2>Result</h2>
@php($fmt = fn ($v) => $v === null ? '—' : rtrim(rtrim(number_format((float) $v, 2), '0'), '.'))
<table class="grid result">
    <tr><td>Blind review (average)</td><td class="num">{{ $fmt($snapshot['blind']['score'] ?? null) }} / {{ $fmt($snapshot['blind']['max'] ?? null) }}</td></tr>
    <tr><td>Open defence (average)</td><td class="num">{{ $fmt($snapshot['defence']['score'] ?? null) }} / {{ $fmt($snapshot['defence']['max'] ?? null) }}</td></tr>
    <tr class="total"><td>Combined score (pass mark {{ $fmt($snapshot['combined_threshold']) }})</td><td class="num">{{ $fmt($snapshot['combined']) }} / {{ $fmt($snapshot['combined_max']) }}</td></tr>
</table>
<div class="outcome">Outcome: <strong>{{ $outcome }}</strong></div>
@if($session->notes)<p class="comment" style="margin-top:8pt">Notes: {{ $session->notes }}</p>@endif

<table class="sigs"><tr>
    <td><div class="sig-line">&nbsp;</div><div class="sig-role">Panel Chair</div></td>
    <td><div class="sig-line">&nbsp;</div><div class="sig-role">College Research Officer</div></td>
    <td><div class="sig-line">&nbsp;</div><div class="sig-role">Director, Research &amp; Technology Transfer</div></td>
</tr></table>
</body>
</html>
