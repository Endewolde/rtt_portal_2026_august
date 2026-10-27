<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Award register{{ $year ? ' — '.$year : '' }}</title>
<style>
@include('pdf.partials.fonts')
@page { margin: 0 0 34px 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DejaVu Sans', Arial, 'Noto Sans Ethiopic', sans-serif; font-size: 8pt; color: #1e293b; line-height: 1.45; }
.footer { position: fixed; bottom: 10px; left: 32px; right: 32px; font-size: 6.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
.footer .right { float: right; }
.cover { background: #78350f; padding: 20px 32px 16px; color: #fff; }
.tag { font-size: 6.5pt; font-weight: bold; color: #fcd34d; letter-spacing: 0.16em; text-transform: uppercase; }
.title { font-size: 17pt; font-weight: bold; line-height: 1.2; margin-top: 3px; }
.meta { margin-top: 8px; padding-top: 7px; border-top: 1px solid #92400e; font-size: 7pt; color: #fde68a; }
.meta span { padding-right: 20px; } .meta strong { color: #fffbeb; }
.content { padding: 14px 32px 0; }
.h { font-size: 9.5pt; font-weight: bold; color: #0f172a; border-left: 3px solid #d97706; padding-left: 8px; margin: 10px 0 8px; }
table.list { width: 100%; border-collapse: collapse; }
table.list th { background: #f1f5f9; color: #475569; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; padding: 5px 6px; border-bottom: 1px solid #cbd5e1; }
table.list td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
table.list tr { page-break-inside: avoid; }
.r { text-align: right; } .muted { color: #64748b; font-size: 7pt; } .ttl { font-weight: bold; color: #0f172a; } .ref { font-family: 'DejaVu Sans Mono', monospace; font-size: 7pt; color: #92400e; }
.total td { font-weight: bold; background: #f8fafc; }
.sign { margin-top: 26px; width: 100%; border-collapse: collapse; }
.sign td { width: 33%; padding: 28px 12px 0 0; vertical-align: bottom; }
.sign .line { border-top: 1px solid #334155; padding-top: 4px; font-size: 7pt; color: #475569; }
</style>
</head>
<body>
@php
    $money = fn ($v) => number_format((float) $v, 2);
    $grand = $proposals->sum(fn ($p) => (float) ($p->award?->awarded_amount ?? 0));
@endphp

<div class="footer">
    {{ $orgName }} — Award register{{ $year ? ', '.$year : '' }}
    <span class="right">Generated {{ now()->format('d M Y H:i') }} by {{ $generatedBy }}</span>
</div>

<div class="cover">
    <p class="tag">{{ $orgName }}</p>
    <p class="title">Award register{{ $year ? ' — '.$year : '' }}</p>
    <p class="meta">
        <span>Awards <strong>{{ $proposals->count() }}</strong></span>
        <span>Total awarded <strong>{{ $money($grand) }} {{ \App\Support\Terms::currency() }}</strong></span>
        <span>Colleges <strong>{{ $byCollege->count() }}</strong></span>
    </p>
</div>

<div class="content">
    <p class="h">Awards</p>
    <table class="list">
        <thead>
            <tr>
                <th style="width:3%">#</th>
                <th style="width:13%">Grant reference</th>
                <th>Proposal</th>
                <th style="width:15%">Principal investigator</th>
                <th style="width:16%">College</th>
                <th style="width:9%">Awarded on</th>
                <th style="width:11%" class="r">Amount</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($proposals as $i => $p)
                <tr>
                    <td class="muted">{{ $i + 1 }}</td>
                    <td class="ref">{{ $p->award?->grant_reference ?? '—' }}</td>
                    <td><span class="ttl">{{ $p->title }}</span><br><span class="muted">{{ $p->tracker_number }} · {{ \Illuminate\Support\Str::headline($p->category) }} · {{ $p->academic_year }}</span></td>
                    <td>{{ $p->pi?->name ?? '—' }}</td>
                    <td>{{ $p->college?->name ?? '—' }}</td>
                    <td>{{ $p->award?->approved_at?->format('d M Y') ?? '—' }}</td>
                    <td class="r">{{ $money($p->award?->awarded_amount ?? 0) }}</td>
                </tr>
            @endforeach
            <tr class="total"><td colspan="6">Total</td><td class="r">{{ $money($grand) }}</td></tr>
        </tbody>
    </table>

    <p class="h">By college</p>
    <table class="list" style="width:60%">
        <thead><tr><th>College</th><th class="r">Awards</th><th class="r">Amount</th></tr></thead>
        <tbody>
            @foreach ($byCollege as $college => $t)
                <tr><td>{{ $college }}</td><td class="r">{{ $t['count'] }}</td><td class="r">{{ $money($t['total']) }}</td></tr>
            @endforeach
        </tbody>
    </table>

    <table class="sign">
        <tr>
            <td><p class="line">Prepared by</p></td>
            <td><p class="line">Checked by</p></td>
            <td><p class="line">Approved by</p></td>
        </tr>
    </table>
</div>
</body>
</html>
