<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Funding decisions — {{ $round['call']['title'] }}</title>
<style>
@include('pdf.partials.fonts')
@page { margin: 0 0 34px 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DejaVu Sans', Arial, 'Noto Sans Ethiopic', sans-serif; font-size: 8pt; color: #1e293b; line-height: 1.45; }
.footer { position: fixed; bottom: 10px; left: 32px; right: 32px; font-size: 6.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
.footer .right { float: right; }
.cover { background: #064e3b; padding: 22px 32px 18px; color: #fff; }
.tag { font-size: 6.5pt; font-weight: bold; color: #6ee7b7; letter-spacing: 0.16em; text-transform: uppercase; }
.title { font-size: 17pt; font-weight: bold; line-height: 1.2; margin-top: 3px; }
.sub { font-size: 8pt; color: #a7f3d0; margin-top: 2px; }
.meta { margin-top: 10px; padding-top: 8px; border-top: 1px solid #065f46; font-size: 7pt; color: #a7f3d0; }
.meta span { padding-right: 20px; } .meta strong { color: #ecfdf5; }
.kpis { padding: 12px 32px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.kpis table { width: 100%; border-collapse: collapse; }
.kpi { width: 20%; padding: 3px 10px; border-right: 1px solid #e2e8f0; }
.kpi.last { border-right: none; }
.kpi .n { font-size: 13pt; font-weight: bold; line-height: 1.15; }
.kpi .l { font-size: 6.3pt; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.07em; }
.content { padding: 14px 32px 0; }
.h { font-size: 9.5pt; font-weight: bold; color: #0f172a; border-left: 3px solid #059669; padding-left: 8px; margin: 10px 0 8px; }
table.list { width: 100%; border-collapse: collapse; }
table.list th { background: #f1f5f9; color: #475569; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.05em; text-align: left; padding: 5px 6px; border-bottom: 1px solid #cbd5e1; }
table.list td { padding: 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
table.list tr { page-break-inside: avoid; }
.r { text-align: right; } .trk { font-size: 6.5pt; color: #64748b; } .ttl { font-weight: bold; color: #0f172a; } .muted { color: #64748b; font-size: 7pt; }
.d { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 6.5pt; font-weight: bold; }
.d-fund { background: #d1fae5; color: #047857; } .d-reserve { background: #fef3c7; color: #b45309; } .d-reject { background: #fee2e2; color: #b91c1c; } .d-pending { background: #e2e8f0; color: #475569; }
.total td { font-weight: bold; background: #f8fafc; }
.notes { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; white-space: pre-line; }
.sign { margin-top: 22px; width: 100%; border-collapse: collapse; }
.sign td { width: 33%; padding: 26px 10px 0 0; vertical-align: bottom; }
.sign .line { border-top: 1px solid #334155; padding-top: 4px; font-size: 7pt; color: #475569; }
</style>
</head>
<body>
@php
    $money = fn ($v) => $v === null ? '—' : number_format((float) $v, 2);
    $label = ['fund' => 'Funded', 'reserve' => 'Reserve list', 'reject' => 'Not funded', 'pending' => 'Undecided'];
    $items = collect($round['items']);
    $b = $round['budget'];
@endphp

<div class="footer">
    {{ $orgName }} — Funding decisions, {{ $round['call']['title'] }}
    <span class="right">Generated {{ now()->format('j M Y, H:i') }} by {{ $generatedBy }}</span>
</div>

<div class="cover">
    <p class="tag">Central evaluation · Decision minutes</p>
    <p class="title">{{ $round['call']['title'] }}@if ($round['college']) — {{ $round['college'] }}@endif</p>
    <p class="sub">{{ $orgName }} · {{ $round['call']['academic_year'] }}</p>
    <p class="meta">
        <span>Status: <strong>{{ $round['status'] === 'published' ? 'Published' : 'Draft (not yet published)' }}</strong></span>
        @if ($round['published_at'])<span>Published: <strong>{{ \Illuminate\Support\Carbon::parse($round['published_at'])->format('j M Y, H:i') }}</strong></span>@endif
        @if ($round['published_by'])<span>By: <strong>{{ $round['published_by'] }}</strong></span>@endif
    </p>
</div>

<div class="kpis">
    <table><tr>
        <td class="kpi"><p class="n">{{ $money($b['budget']) }}</p><p class="l">Call budget</p></td>
        <td class="kpi"><p class="n">{{ $money($b['committed']) }}</p><p class="l">Awarded before</p></td>
        <td class="kpi"><p class="n" style="color:#047857">{{ $money($b['funding']) }}</p><p class="l">Awarded in this round</p></td>
        <td class="kpi"><p class="n">{{ $money($b['after']) }}</p><p class="l">Left after</p></td>
        <td class="kpi last"><p class="n">{{ $round['counts']['fund'] }} / {{ $round['counts']['reserve'] }} / {{ $round['counts']['reject'] }}</p><p class="l">Funded / reserve / not funded</p></td>
    </tr></table>
</div>

<div class="content">
    <p class="h">Decisions, in rank order</p>
    <table class="list">
        <thead><tr>
            <th style="width:22px">#</th><th>Proposal</th><th class="r">Score</th><th class="r">Requested</th><th>Decision</th><th class="r">Awarded</th><th>Reason / remarks</th>
        </tr></thead>
        <tbody>
        @foreach ($items as $i)
            <tr>
                <td>{{ $i['rank'] }}</td>
                <td><p class="trk">{{ $i['tracker_number'] }}</p><p class="ttl">{{ $i['title'] }}</p><p class="muted">{{ collect([$i['pi'], $i['college']])->filter()->implode(' · ') }}</p></td>
                <td class="r">{{ $i['score'] !== null ? rtrim(rtrim(number_format($i['score'], 2), '0'), '.') : '—' }}@if($i['score_max'])<span class="muted"> / {{ rtrim(rtrim(number_format($i['score_max'], 2), '0'), '.') }}</span>@endif</td>
                <td class="r">{{ $money($i['requested']) }}</td>
                <td><span class="d d-{{ $i['decision'] }}">{{ $label[$i['decision']] ?? $i['decision'] }}</span>@if($i['promoted_at'])<p class="muted">Funded later from the reserve list</p>@endif</td>
                <td class="r">{{ in_array($i['decision'], ['fund']) || $i['promoted_at'] ? $money($i['amount']) : '—' }}</td>
                <td class="muted">
                    @if ($i['decision'] === 'reject')
                        {{ $i['reason_code'] && $i['reason_code'] !== 'other' ? ($reasons[$i['reason_code']] ?? '') : '' }}{{ $i['reason_code'] && $i['reason_code'] !== 'other' && $i['reason'] ? ' — ' : '' }}{{ $i['reason'] }}
                    @else
                        {{ $i['remarks'] }}
                    @endif
                </td>
            </tr>
        @endforeach
            <tr class="total">
                <td></td><td>Total ({{ $items->count() }} proposals)</td><td></td>
                <td class="r">{{ $money($items->sum('requested')) }}</td><td></td>
                <td class="r">{{ $money($b['funding']) }}</td><td></td>
            </tr>
        </tbody>
    </table>

    @if ($round['notes'])
        <p class="h">Notes of the meeting</p>
        <p class="notes">{{ $round['notes'] }}</p>
    @endif

    <table class="sign"><tr>
        <td><p class="line">Prepared by</p></td>
        <td><p class="line">Approved by</p></td>
        <td><p class="line">Date</p></td>
    </tr></table>
</div>
</body>
</html>
