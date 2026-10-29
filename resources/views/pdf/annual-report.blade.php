@php
    use App\Support\Programmes;

    /*
     * Laid out with tables only: dompdf does not support flexbox or grid, so every
     * row of cards, bar and two-column block here is a table.
     */
    $fmt = fn ($n) => number_format((float) $n);
    $money = fn ($n) => number_format((float) $n, 0);
    $pct = fn ($part, $whole) => $whole > 0 ? round(($part / $whole) * 100) : 0;
    $nice = fn ($key) => ucwords(str_replace('_', ' ', (string) $key));
    $statusLabel = fn ($s) => [
        'submitted' => 'Submitted', 'validated' => 'Validated', 'under_blind_review' => 'Under blind review',
        'blind_review_passed' => 'Passed blind review', 'under_open_defence' => 'Under open defence',
        'accepted' => 'Accepted', 'funded' => 'Funded', 'midterm_evaluation' => 'Mid-term evaluation',
        'completed' => 'Completed', 'archived' => 'Archived', 'rejected' => 'Rejected',
    ][$s] ?? $nice($s);
    $palette = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0891b2'];
    $fundedRate = $pct($proposals['funded'], $proposals['total']);
    arsort($proposals['by_status']);
    arsort($proposals['by_category']);
    arsort($outputs['by_type']);
    arsort($impacts['by_type']);
    $unavailable = $unavailable ?? [];
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Annual RTT Report {{ $academic_year }}</title>
<style>
@unless($standardFontsOnly ?? false)
@include('pdf.partials.fonts')
@endunless
@page { margin: 34px 0 48px; }
/* Not "*": in dompdf that also matches the page and wipes the @page margins. */
body, div, h1, p, table, td, th, img { margin: 0; padding: 0; }
body { font-family: 'DejaVu Sans', 'Noto Sans Ethiopic', sans-serif; font-size: 9pt; color: #1e293b; line-height: 1.45; }
table { border-collapse: collapse; width: 100%; }
td, th { vertical-align: top; }

.wrap { padding: 0 40px; }

/* Letterhead band */
.band { background: #1e3a8a; color: #fff; padding: 30px 40px 26px; margin-top: -34px; }
.band .org { font-size: 8pt; letter-spacing: 1.5px; text-transform: uppercase; color: #bfdbfe; font-weight: bold; }
.band h1 { font-size: 22pt; font-weight: bold; margin-top: 6px; }
.band .sub { font-size: 10pt; color: #dbeafe; margin-top: 2px; }
.band .logo { width: 58px; height: 58px; }
.meta { margin-top: 18px; border-top: 1px solid #3b5bb5; }
.meta td { padding-top: 10px; width: 25%; }
.meta .k { font-size: 6.5pt; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd; }
.meta .v { font-size: 9.5pt; font-weight: bold; color: #fff; margin-top: 1px; }

/* Section headings */
.section { margin-top: 22px; }
.section-title { font-size: 12pt; font-weight: bold; color: #1e3a8a; padding-bottom: 5px; border-bottom: 2px solid #dbeafe; margin-bottom: 10px; }
.section-title .n { color: #93c5fd; font-size: 10pt; padding-right: 6px; }
.lead { font-size: 8.5pt; color: #64748b; margin: -4px 0 10px; }

/* Stat cards: one table row, four cells */
.cards { border-collapse: separate; border-spacing: 8px 0; margin: 0 -8px; }
.card { background: #f8fafc; border: 1px solid #e2e8f0; border-top: 3px solid #2563eb; padding: 9px 11px; width: 25%; }
.card .v { font-size: 16pt; font-weight: bold; color: #0f172a; line-height: 1.1; }
.card .k { font-size: 7.5pt; color: #64748b; margin-top: 3px; }
.card .h { font-size: 7pt; color: #94a3b8; margin-top: 1px; }
.card .v.money { font-size: 12.5pt; white-space: nowrap; }
.card .v.money small { font-size: 8pt; color: #64748b; font-weight: normal; }

/* Bar rows */
.bars td { padding: 3px 0; font-size: 8.5pt; }
.bars .label { width: 36%; padding-right: 8px; color: #334155; }
.bars .track { background: #eef2f7; height: 9px; }
.bars .fill { height: 9px; }
.bars .num { width: 16%; text-align: right; font-weight: bold; color: #0f172a; padding-left: 8px; white-space: nowrap; }
.bars .num span { font-weight: normal; color: #94a3b8; }

/* Data tables */
.data th { background: #f1f5f9; color: #475569; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .5px; text-align: left; padding: 6px 8px; border-bottom: 1px solid #e2e8f0; }
.data td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; font-size: 8.5pt; }
.data .r { text-align: right; }
.data tr.total td { font-weight: bold; background: #f8fafc; border-top: 1px solid #e2e8f0; }

.two td.col { width: 50%; }
.two td.col + td.col { padding-left: 18px; }
.sub-title { font-size: 9pt; font-weight: bold; color: #334155; margin-bottom: 6px; }
.empty { color: #94a3b8; font-style: italic; font-size: 8.5pt; padding: 6px 0; }
.note { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 8px 10px; font-size: 8.5pt; margin-top: 16px; }
.pill { font-size: 7pt; padding: 1px 6px; background: #e2e8f0; color: #334155; }

.footer { position: fixed; bottom: -30px; left: 0; right: 0; height: 18px; padding: 6px 40px 0; border-top: 1px solid #e2e8f0; font-size: 7pt; color: #94a3b8; }
.footer .pg:after { content: counter(page); }
.page-body { padding-bottom: 6px; }
.keep { page-break-inside: avoid; }
</style>
</head>
<body>

<div class="footer">
    <table><tr>
        <td>{{ $org_name }} · Annual RTT Report {{ $academic_year }}</td>
        <td style="text-align:right">Generated {{ $generated_at }} · Page <span class="pg"></span></td>
    </tr></table>
</div>

{{-- ── Letterhead ─────────────────────────────────────────────── --}}
<div class="band">
    <table><tr>
        <td>
            <div class="org">{{ $org_name }}</div>
            <h1>Annual RTT Report</h1>
            <div class="sub">Academic year {{ $academic_year }} · Research, Community Engagement &amp; Technology Transfer</div>
        </td>
        @if(!empty($logo))
            <td style="width:64px; text-align:right"><img class="logo" src="{{ $logo }}" alt=""></td>
        @endif
    </tr></table>
    <table class="meta"><tr>
        <td><div class="k">Period</div><div class="v">Jul {{ $start_year }} – Jun {{ $end_year }}</div></td>
        <td><div class="k">Proposals submitted</div><div class="v">{{ $fmt($proposals['total']) }}</div></td>
        <td><div class="k">Projects funded</div><div class="v">{{ $fmt($proposals['funded']) }}@if($proposals['total']) ({{ $fundedRate }}%)@endif</div></td>
        <td><div class="k">Research outputs</div><div class="v">{{ $fmt($outputs['total']) }}</div></td>
    </tr></table>
</div>

<div class="wrap page-body">

@if(!empty($unavailable))
    <div class="note"><b>Part of this report could not be compiled</b> ({{ implode(', ', array_map($nice, $unavailable)) }}) and is shown as empty. The error has been logged for the administrator.</div>
@endif

{{-- ── 1. Proposals ───────────────────────────────────────────── --}}
<div class="section">
    <div class="section-title"><span class="n">01</span> Proposals</div>
    <table class="cards"><tr>
        <td class="card" style="border-top-color:#2563eb"><div class="v">{{ $fmt($proposals['total']) }}</div><div class="k">Submitted</div><div class="h">Excluding drafts</div></td>
        <td class="card" style="border-top-color:#059669"><div class="v">{{ $fmt($proposals['funded']) }}</div><div class="k">Funded</div><div class="h">{{ $proposals['total'] ? $fundedRate.'% of submitted' : '—' }}</div></td>
        <td class="card" style="border-top-color:#7c3aed"><div class="v">{{ $fmt($proposals['completed']) }}</div><div class="k">Completed</div><div class="h">Projects closed this year</div></td>
        <td class="card" style="border-top-color:#dc2626"><div class="v">{{ $fmt($proposals['rejected']) }}</div><div class="k">Rejected</div><div class="h">{{ $proposals['total'] ? $pct($proposals['rejected'], $proposals['total']).'% of submitted' : '—' }}</div></td>
    </tr></table>

    <table class="two" style="margin-top:14px"><tr>
        <td class="col keep">
            <div class="sub-title">By programme</div>
            @if(empty($proposals['by_category']))
                <div class="empty">No proposals this year.</div>
            @else
                <table class="bars">
                    @foreach($proposals['by_category'] as $category => $count)
                        @php $share = $pct($count, $proposals['total']); @endphp
                        <tr>
                            <td class="label">{{ Programmes::label($category) }}</td>
                            <td><div class="track"><div class="fill" style="width:{{ max($share, 1) }}%; background:{{ $palette[$loop->index % count($palette)] }}"></div></div></td>
                            <td class="num">{{ $fmt($count) }} <span>{{ $share }}%</span></td>
                        </tr>
                    @endforeach
                </table>
            @endif
        </td>
        <td class="col keep">
            <div class="sub-title">Where they are now</div>
            @if(empty($proposals['by_status']))
                <div class="empty">No proposals this year.</div>
            @else
                <table class="bars">
                    @foreach($proposals['by_status'] as $status => $count)
                        @php $share = $pct($count, $proposals['total']); @endphp
                        <tr>
                            <td class="label">{{ $statusLabel($status) }}</td>
                            <td><div class="track"><div class="fill" style="width:{{ max($share, 1) }}%; background:#64748b"></div></div></td>
                            <td class="num">{{ $fmt($count) }} <span>{{ $share }}%</span></td>
                        </tr>
                    @endforeach
                </table>
            @endif
        </td>
    </tr></table>
</div>

{{-- ── 2. Colleges ────────────────────────────────────────────── --}}
<div class="section">
    <div class="section-title"><span class="n">02</span> Colleges</div>
    @if(empty($colleges))
        <div class="empty">No proposals from any college this year.</div>
    @else
        <table class="data">
            <thead><tr><th style="width:38%">College</th><th class="r" style="width:12%">Submitted</th><th class="r" style="width:10%">Funded</th><th class="r" style="width:12%">Success</th><th>Share of submissions</th></tr></thead>
            <tbody>
                @foreach($colleges as $c)
                    @php $share = $pct($c['submitted'], $proposals['total']); @endphp
                    <tr class="keep">
                        <td>{{ $c['name'] }}</td>
                        <td class="r">{{ $fmt($c['submitted']) }}</td>
                        <td class="r">{{ $fmt($c['funded']) }}</td>
                        <td class="r">{{ $pct($c['funded'], $c['submitted']) }}%</td>
                        <td><table><tr><td style="padding:0"><div class="track" style="background:#eef2f7;height:7px;margin-top:4px"><div style="height:7px;width:{{ max($share, 1) }}%;background:#2563eb"></div></div></td><td style="padding:0 0 0 6px;width:30px;text-align:right;color:#64748b">{{ $share }}%</td></tr></table></td>
                    </tr>
                @endforeach
                <tr class="total">
                    <td>All colleges</td>
                    <td class="r">{{ $fmt(array_sum(array_column($colleges, 'submitted'))) }}</td>
                    <td class="r">{{ $fmt(array_sum(array_column($colleges, 'funded'))) }}</td>
                    <td class="r">{{ $pct(array_sum(array_column($colleges, 'funded')), array_sum(array_column($colleges, 'submitted'))) }}%</td>
                    <td></td>
                </tr>
            </tbody>
        </table>
    @endif
</div>

{{-- ── 3. Finance ─────────────────────────────────────────────── --}}
<div class="section keep">
    <div class="section-title"><span class="n">03</span> Finance</div>
    <table class="cards"><tr>
        <td class="card" style="border-top-color:#d97706"><div class="v money"><small>ETB</small> {{ $money($finance['allocated']) }}</div><div class="k">Budget allocated</div></td>
        <td class="card" style="border-top-color:#2563eb"><div class="v money"><small>ETB</small> {{ $money($finance['awarded']) }}</div><div class="k">Awarded to projects</div></td>
        <td class="card" style="border-top-color:#059669"><div class="v money"><small>ETB</small> {{ $money($finance['disbursed']) }}</div><div class="k">Disbursed</div><div class="h">{{ $finance['paid_of_awarded'] }}% of awarded</div></td>
        <td class="card" style="border-top-color:#7c3aed"><div class="v money"><small>ETB</small> {{ $money($finance['settled']) }}</div><div class="k">Spent &amp; verified</div></td>
    </tr></table>
    <table class="bars" style="margin-top:12px">
        <tr>
            <td class="label" style="width:40%">Budget utilisation <span style="color:#94a3b8">· disbursed of allocated</span></td>
            <td><div class="track"><div class="fill" style="width:{{ min(100, max($finance['utilization'], 1)) }}%; background:#d97706"></div></div></td>
            <td class="num">{{ $finance['utilization'] }}%</td>
        </tr>
        <tr>
            <td class="label" style="width:40%">Paid of awarded <span style="color:#94a3b8">· disbursed of awarded</span></td>
            <td><div class="track"><div class="fill" style="width:{{ min(100, max($finance['paid_of_awarded'], 1)) }}%; background:#059669"></div></div></td>
            <td class="num">{{ $finance['paid_of_awarded'] }}%</td>
        </tr>
    </table>
</div>

{{-- ── 4. Reviews ─────────────────────────────────────────────── --}}
<div class="section keep">
    <div class="section-title"><span class="n">04</span> Peer review</div>
    <table class="cards"><tr>
        <td class="card" style="border-top-color:#2563eb"><div class="v">{{ $fmt($reviews['total']) }}</div><div class="k">Reviews assigned</div><div class="h">Excluding declined &amp; cancelled</div></td>
        <td class="card" style="border-top-color:#059669"><div class="v">{{ $fmt($reviews['completed']) }}</div><div class="k">Completed</div></td>
        <td class="card" style="border-top-color:#d97706"><div class="v">{{ $reviews['rate'] }}%</div><div class="k">Completion rate</div></td>
        <td class="card" style="border-top-color:#7c3aed"><div class="v">{{ $fmt($reviews['reviewers']) }}</div><div class="k">Reviewers involved</div></td>
    </tr></table>
</div>

{{-- ── 5. Outputs and impacts ─────────────────────────────────── --}}
<div class="section keep">
    <div class="section-title"><span class="n">05</span> Research outputs &amp; impact</div>
    <table class="two"><tr>
        <td class="col">
            <div class="sub-title">Outputs · {{ $fmt($outputs['total']) }}</div>
            @if(empty($outputs['by_type']))
                <div class="empty">No outputs recorded.</div>
            @else
                <table class="bars">
                    @foreach($outputs['by_type'] as $type => $count)
                        @php $share = $pct($count, $outputs['total']); @endphp
                        <tr>
                            <td class="label">{{ $nice($type) }}</td>
                            <td><div class="track"><div class="fill" style="width:{{ max($share, 1) }}%; background:{{ $palette[$loop->index % count($palette)] }}"></div></div></td>
                            <td class="num">{{ $fmt($count) }}</td>
                        </tr>
                    @endforeach
                </table>
            @endif
        </td>
        <td class="col">
            <div class="sub-title">Impacts · {{ $fmt($impacts['total']) }}</div>
            @if(empty($impacts['by_type']))
                <div class="empty">No impacts recorded.</div>
            @else
                <table class="bars">
                    @foreach($impacts['by_type'] as $type => $count)
                        @php $share = $pct($count, $impacts['total']); @endphp
                        <tr>
                            <td class="label">{{ $nice($type) }}</td>
                            <td><div class="track"><div class="fill" style="width:{{ max($share, 1) }}%; background:{{ $palette[($loop->index + 2) % count($palette)] }}"></div></div></td>
                            <td class="num">{{ $fmt($count) }}</td>
                        </tr>
                    @endforeach
                </table>
            @endif
        </td>
    </tr></table>
</div>

{{-- ── 6. Calls ───────────────────────────────────────────────── --}}
<div class="section">
    <div class="section-title"><span class="n">06</span> Calls for proposals</div>
    @if(empty($calls))
        <div class="empty">No calls were opened for this academic year.</div>
    @else
        <table class="data">
            <thead><tr><th>Call</th><th>Programme</th><th>Open</th><th>Close</th><th>Status</th></tr></thead>
            <tbody>
                @foreach($calls as $call)
                    <tr class="keep">
                        <td>{{ $call['title'] }}</td>
                        <td>{{ Programmes::label($call['category']) }}</td>
                        <td style="white-space:nowrap">{{ $call['start_date'] ? \Illuminate\Support\Carbon::parse($call['start_date'])->format('d M Y') : '—' }}</td>
                        <td style="white-space:nowrap">{{ $call['end_date'] ? \Illuminate\Support\Carbon::parse($call['end_date'])->format('d M Y') : '—' }}</td>
                        <td><span class="pill">{{ $nice($call['status']) }}</span></td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif
</div>

</div>
</body>
</html>
