<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Annual RTT Report {{ $academic_year }}</title>
<style>
@include('pdf.partials.fonts')
* { margin:0; padding:0; box-sizing:border-box; }

body {
    font-family: 'DejaVu Sans', Arial, 'Noto Sans Ethiopic', sans-serif;
    font-size: 9.5pt;
    color: #1e293b;
    background: #fff;
    line-height: 1.5;
}

.page { padding: 0; }

/* ── Cover band ──────────────────────────────────────────── */
.cover {
    background: #1e3a8a;
    padding: 36px 48px 28px;
    position: relative;
    overflow: hidden;
}
.cover-accent {
    position: absolute;
    right: -40px; top: -40px;
    width: 180px; height: 180px;
    border-radius: 50%;
    background: rgba(255,255,255,0.06);
}
.cover-accent2 {
    position: absolute;
    left: -20px; bottom: -30px;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: rgba(255,255,255,0.04);
}
.cover-tag {
    font-size: 7.5pt;
    font-weight: bold;
    color: #93c5fd;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 6px;
}
.cover-title {
    font-size: 22pt;
    font-weight: bold;
    color: #ffffff;
    line-height: 1.2;
    margin-bottom: 4px;
}
.cover-sub {
    font-size: 10pt;
    color: #bfdbfe;
    margin-bottom: 16px;
}
.cover-meta {
    display: flex;
    gap: 24px;
    border-top: 1px solid rgba(255,255,255,0.15);
    padding-top: 14px;
    margin-top: 6px;
}
.cover-meta-item { }
.cover-meta-label { font-size: 7pt; color: #93c5fd; text-transform: uppercase; letter-spacing: 0.1em; }
.cover-meta-value { font-size: 9pt; color: #fff; font-weight: bold; margin-top: 1px; }

/* ── Body ────────────────────────────────────────────────── */
.body { padding: 32px 48px 40px; }

/* ── Section heading ─────────────────────────────────────── */
.section { margin-bottom: 28px; }
.section-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
}
.section-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px; height: 20px;
    border-radius: 50%;
    background: #1e3a8a;
    color: #fff;
    font-size: 7.5pt;
    font-weight: bold;
    flex-shrink: 0;
}
.section-title {
    font-size: 11pt;
    font-weight: bold;
    color: #1e3a8a;
    flex: 1;
    border-bottom: 2px solid #dbeafe;
    padding-bottom: 4px;
}

/* ── KPI cards ───────────────────────────────────────────── */
.kpi-row { display: flex; gap: 10px; margin-bottom: 14px; }
.kpi {
    flex: 1;
    border-radius: 8px;
    padding: 12px 14px;
    border-left: 4px solid transparent;
}
.kpi-blue   { background: #eff6ff; border-color: #3b82f6; }
.kpi-green  { background: #f0fdf4; border-color: #22c55e; }
.kpi-violet { background: #f5f3ff; border-color: #8b5cf6; }
.kpi-amber  { background: #fffbeb; border-color: #f59e0b; }
.kpi-red    { background: #fef2f2; border-color: #ef4444; }
.kpi-cyan   { background: #ecfeff; border-color: #06b6d4; }
.kpi-purple { background: #faf5ff; border-color: #a855f7; }

.kpi-value {
    font-size: 18pt;
    font-weight: bold;
    line-height: 1;
    margin-bottom: 3px;
}
.kpi-blue   .kpi-value { color: #1d4ed8; }
.kpi-green  .kpi-value { color: #15803d; }
.kpi-violet .kpi-value { color: #6d28d9; }
.kpi-amber  .kpi-value { color: #b45309; }
.kpi-red    .kpi-value { color: #b91c1c; }
.kpi-cyan   .kpi-value { color: #0e7490; }
.kpi-purple .kpi-value { color: #7e22ce; }

.kpi-label { font-size: 7.5pt; color: #64748b; }
.kpi-badge {
    display: inline-block;
    font-size: 6.5pt;
    font-weight: bold;
    padding: 1px 6px;
    border-radius: 10px;
    background: rgba(0,0,0,0.07);
    color: #475569;
    margin-top: 3px;
}

/* ── Category bars ───────────────────────────────────────── */
.cat-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: #f8fafc;
    border-radius: 6px;
    margin-bottom: 6px;
    border-left: 3px solid #3b82f6;
}
.cat-label { font-size: 9pt; color: #334155; flex: 1; }
.cat-bar-wrap { width: 100px; background: #e2e8f0; border-radius: 3px; height: 6px; }
.cat-bar { height: 6px; border-radius: 3px; background: #3b82f6; }
.cat-val { font-size: 9pt; font-weight: bold; color: #1e293b; width: 24px; text-align: right; }
.cat-pct { font-size: 7.5pt; color: #94a3b8; width: 30px; text-align: right; }

@php
$catColors = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#06b6d4'];
@endphp

/* ── Finance blocks ──────────────────────────────────────── */
.finance-row { display: flex; gap: 10px; margin-bottom: 14px; }
.finance-block {
    flex: 1;
    padding: 12px 14px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
}
.finance-block-label { font-size: 7.5pt; color: #64748b; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.05em; }
.finance-block-value { font-size: 12pt; font-weight: bold; }
.fb-amber { background: #fffbeb; border-color: #fde68a; }
.fb-amber .finance-block-value { color: #b45309; }
.fb-green { background: #f0fdf4; border-color: #bbf7d0; }
.fb-green .finance-block-value { color: #15803d; }
.fb-blue { background: #eff6ff; border-color: #bfdbfe; }
.fb-blue .finance-block-value { color: #1d4ed8; }

.util-label { display: flex; justify-content: space-between; font-size: 8.5pt; color: #475569; margin-bottom: 5px; }
.util-pct { font-weight: bold; color: #b45309; }
.util-track { background: #e2e8f0; border-radius: 4px; height: 10px; overflow: hidden; }
.util-fill { height: 10px; border-radius: 4px; background: linear-gradient(90deg, #f59e0b, #fbbf24); }
.util-ticks { display: flex; justify-content: space-between; font-size: 6.5pt; color: #cbd5e1; margin-top: 3px; }

/* ── Table ───────────────────────────────────────────────── */
table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
thead tr { background: #1e3a8a; }
th { color: #fff; padding: 7px 10px; text-align: left; font-size: 8pt; font-weight: bold; }
tbody tr:nth-child(odd)  td { background: #f8fafc; }
tbody tr:nth-child(even) td { background: #fff; }
td { padding: 7px 10px; border-bottom: 1px solid #f1f5f9; color: #334155; }
.tr { text-align: right; }
.tc { text-align: center; }

/* ── Output/impact rows ──────────────────────────────────── */
.output-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    border-radius: 6px;
    background: #f8fafc;
    margin-bottom: 5px;
    border-left: 3px solid #8b5cf6;
}
.output-label { flex: 1; font-size: 9pt; color: #334155; }
.output-bar-wrap { width: 80px; background: #e2e8f0; border-radius: 3px; height: 5px; }
.output-bar { height: 5px; border-radius: 3px; background: #8b5cf6; }
.output-val { font-size: 9pt; font-weight: bold; color: #1e293b; width: 20px; text-align: right; }

/* ── College row ─────────────────────────────────────────── */
.college-row {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px;
    border-radius: 6px;
    background: #f8fafc;
    margin-bottom: 6px;
    border-left: 3px solid #10b981;
}
.college-name { flex: 1; font-size: 9pt; font-weight: bold; color: #1e293b; }
.college-stat { text-align: right; min-width: 44px; }
.college-stat-val { font-size: 10pt; font-weight: bold; color: #1e3a8a; }
.college-stat-sub { font-size: 7pt; color: #94a3b8; }
.college-rate-wrap { width: 60px; background: #e2e8f0; border-radius: 3px; height: 6px; }
.college-rate-fill { height: 6px; border-radius: 3px; background: #10b981; }

/* ── Badge ───────────────────────────────────────────────── */
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 7.5pt; font-weight: bold; }
.badge-green { background: #dcfce7; color: #15803d; }
.badge-slate { background: #f1f5f9; color: #475569; }

/* ── Two-col ─────────────────────────────────────────────── */
.two-col { display: flex; gap: 14px; }
.col { flex: 1; }
.col-title { font-size: 9pt; font-weight: bold; color: #475569; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid #e2e8f0; }

/* ── Empty state ─────────────────────────────────────────── */
.empty { font-size: 8.5pt; color: #94a3b8; font-style: italic; padding: 8px 0; }

/* ── Divider ─────────────────────────────────────────────── */
.divider { border:none; border-top: 1px solid #f1f5f9; margin: 20px 0; }

/* ── Page break & margins ────────────────────────────────── */
@page { margin: 20px 48px 24px; }

.section        { page-break-inside: avoid; }
.kpi-row        { page-break-inside: avoid; }
.finance-row    { page-break-inside: avoid; }
.two-col        { page-break-inside: avoid; }
.college-row    { page-break-inside: avoid; }
.section-head   { page-break-after: avoid; }

/* Fixed page header — DomPDF repeats position:fixed on every page */
#running-header {
    position: fixed;
    top: -20px;
    left: 0; right: 0;
    height: 36px;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    border-bottom: 1.5px solid #1e3a8a;
    padding-bottom: 5px;
    font-size: 7.5pt;
    color: #64748b;
}
#running-header .rh-left { font-weight: bold; color: #1e3a8a; }
#running-header .rh-right { color: #94a3b8; }

/* ── Footer ──────────────────────────────────────────────── */
.footer {
    margin-top: 32px;
    padding: 12px 48px;
    background: #f8fafc;
    border-top: 2px solid #1e3a8a;
    display: flex;
    justify-content: space-between;
    font-size: 7.5pt;
    color: #64748b;
}
</style>
</head>
<body>
<div class="page">

{{-- ── Cover ─────────────────────────────────────────────── --}}
<div class="cover">
    <div class="cover-accent"></div>
    <div class="cover-accent2"></div>
    <div class="cover-tag">{{ $org_name }}</div>
    <div class="cover-title">Annual RTT Report</div>
    <div class="cover-sub">{{ $academic_year }} &nbsp;·&nbsp; Research, Technology Transfer &amp; Innovation</div>
    <div class="cover-meta">
        <div class="cover-meta-item">
            <div class="cover-meta-label">Period</div>
            <div class="cover-meta-value">Jul {{ $start_year }} – Jun {{ $end_year }}</div>
        </div>
        <div class="cover-meta-item">
            <div class="cover-meta-label">Proposals</div>
            <div class="cover-meta-value">{{ $proposals['total'] }} Submitted</div>
        </div>
        <div class="cover-meta-item">
            <div class="cover-meta-label">Funded</div>
            <div class="cover-meta-value">{{ $proposals['funded'] }} Projects</div>
        </div>
        <div class="cover-meta-item">
            <div class="cover-meta-label">Generated</div>
            <div class="cover-meta-value">{{ $generated_at }}</div>
        </div>
    </div>
</div>

{{-- Fixed running header — appears on every page via DomPDF position:fixed --}}
<div id="running-header">
    <span class="rh-left">{{ $org_name }} &nbsp;·&nbsp; Annual RTT Report {{ $academic_year }}</span>
    <span class="rh-right">{{ $generated_at }}</span>
</div>

<div class="body" style="padding-top: 24px;">

{{-- ── 1. Proposal Summary ──────────────────────────────── --}}
<div class="section">
    <div class="section-head">
        <div class="section-num">1</div>
        <div class="section-title">Proposal Summary</div>
    </div>

    {{-- KPI row --}}
    <div class="kpi-row">
        <div class="kpi kpi-blue">
            <div class="kpi-value">{{ $proposals['total'] }}</div>
            <div class="kpi-label">Total Submitted</div>
        </div>
        <div class="kpi kpi-green">
            <div class="kpi-value">{{ $proposals['funded'] }}</div>
            <div class="kpi-label">Funded</div>
            @if($proposals['total'] > 0)
            <div class="kpi-badge">{{ round(($proposals['funded'] / $proposals['total']) * 100) }}% rate</div>
            @endif
        </div>
        <div class="kpi kpi-violet">
            <div class="kpi-value">{{ $proposals['completed'] }}</div>
            <div class="kpi-label">Completed</div>
        </div>
        <div class="kpi kpi-red">
            <div class="kpi-value">{{ $proposals['rejected'] }}</div>
            <div class="kpi-label">Rejected</div>
        </div>
    </div>

    {{-- By category --}}
    @if(!empty($proposals['by_category']))
    @php $catIdx = 0; $catColors = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#06b6d4']; @endphp
    @foreach($proposals['by_category'] as $category => $count)
    @php
        $pct = $proposals['total'] > 0 ? round(($count / $proposals['total']) * 100) : 0;
        $col = $catColors[$catIdx % count($catColors)];
        $catIdx++;
    @endphp
    <div class="cat-row" style="border-left-color: {{ $col }};">
        <div class="cat-label">{{ ucwords(str_replace('_', ' ', $category)) }}</div>
        <div class="cat-bar-wrap"><div class="cat-bar" style="width:{{ $pct }}%; background:{{ $col }};"></div></div>
        <div class="cat-val">{{ $count }}</div>
        <div class="cat-pct">{{ $pct }}%</div>
    </div>
    @endforeach
    @endif
</div>

<hr class="divider">

{{-- ── 2. Finance & Budget ──────────────────────────────── --}}
<div class="section">
    <div class="section-head">
        <div class="section-num">2</div>
        <div class="section-title">Finance &amp; Budget</div>
    </div>

    <div class="finance-row">
        <div class="finance-block fb-amber">
            <div class="finance-block-label">Total Allocated (ETB)</div>
            <div class="finance-block-value">{{ number_format($finance['allocated'], 0) }}</div>
        </div>
        <div class="finance-block fb-green">
            <div class="finance-block-label">Total Disbursed (ETB)</div>
            <div class="finance-block-value">{{ number_format($finance['disbursed'], 0) }}</div>
        </div>
        <div class="finance-block fb-blue">
            <div class="finance-block-label">Remaining Balance (ETB)</div>
            <div class="finance-block-value">{{ number_format($finance['allocated'] - $finance['disbursed'], 0) }}</div>
        </div>
    </div>

    <div class="util-label">
        <span>Budget Utilization Rate</span>
        <span class="util-pct">{{ $finance['utilization'] }}%</span>
    </div>
    <div class="util-track">
        <div class="util-fill" style="width: {{ min($finance['utilization'], 100) }}%;"></div>
    </div>
    <div class="util-ticks">
        <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
    </div>
</div>

<hr class="divider">

{{-- ── 3. Review Activity ───────────────────────────────── --}}
<div class="section">
    <div class="section-head">
        <div class="section-num">3</div>
        <div class="section-title">Review Activity</div>
    </div>

    <div class="kpi-row">
        <div class="kpi kpi-blue">
            <div class="kpi-value">{{ $reviews['total'] }}</div>
            <div class="kpi-label">Assignments</div>
        </div>
        <div class="kpi kpi-green">
            <div class="kpi-value">{{ $reviews['completed'] }}</div>
            <div class="kpi-label">Completed</div>
        </div>
        <div class="kpi kpi-amber">
            <div class="kpi-value">{{ $reviews['rate'] }}%</div>
            <div class="kpi-label">Completion Rate</div>
        </div>
        <div class="kpi kpi-violet">
            <div class="kpi-value">{{ $reviews['total'] - $reviews['completed'] }}</div>
            <div class="kpi-label">Pending</div>
        </div>
    </div>
</div>

<hr class="divider">

{{-- ── 4. Research Outputs & Impacts ───────────────────── --}}
<div class="section">
    <div class="section-head">
        <div class="section-num">4</div>
        <div class="section-title">Research Outputs &amp; Impacts</div>
    </div>

    <div class="two-col">
        <div class="col">
            <div class="col-title">Outputs &nbsp;({{ $outputs['total'] }} total)</div>
            @if(!empty($outputs['by_type']))
                @php $oIdx = 0; $oColors = ['#8b5cf6','#3b82f6','#10b981','#f59e0b']; @endphp
                @foreach($outputs['by_type'] as $type => $count)
                @php $oPct = $outputs['total'] > 0 ? round(($count/$outputs['total'])*100) : 0; $oCol = $oColors[$oIdx % count($oColors)]; $oIdx++; @endphp
                <div class="output-row" style="border-left-color:{{ $oCol }};">
                    <div class="output-label">{{ ucwords(str_replace('_',' ',$type)) }}</div>
                    <div class="output-bar-wrap"><div class="output-bar" style="width:{{ $oPct }}%; background:{{ $oCol }};"></div></div>
                    <div class="output-val">{{ $count }}</div>
                </div>
                @endforeach
            @else
                <div class="empty">No outputs recorded.</div>
            @endif
        </div>
        <div class="col">
            <div class="col-title">Impacts &nbsp;({{ $impacts['total'] }} total)</div>
            @if(!empty($impacts['by_type']))
                @php $iIdx = 0; $iColors = ['#10b981','#8b5cf6','#3b82f6','#f59e0b']; @endphp
                @foreach($impacts['by_type'] as $type => $count)
                @php $iPct = $impacts['total'] > 0 ? round(($count/$impacts['total'])*100) : 0; $iCol = $iColors[$iIdx % count($iColors)]; $iIdx++; @endphp
                <div class="output-row" style="border-left-color:{{ $iCol }};">
                    <div class="output-label">{{ ucwords(str_replace('_',' ',$type)) }}</div>
                    <div class="output-bar-wrap"><div class="output-bar" style="width:{{ $iPct }}%; background:{{ $iCol }};"></div></div>
                    <div class="output-val">{{ $count }}</div>
                </div>
                @endforeach
            @else
                <div class="empty">No impacts recorded.</div>
            @endif
        </div>
    </div>
</div>

{{-- ── 5. College Performance ───────────────────────────── --}}
@if(!empty($colleges))
<hr class="divider">
<div class="section">
    <div class="section-head">
        <div class="section-num">5</div>
        <div class="section-title">College Performance</div>
    </div>

    @php $cColors = ['#3b82f6','#8b5cf6','#f59e0b','#10b981','#ef4444','#06b6d4']; $cIdx = 0; @endphp
    @foreach($colleges as $college)
    @php $rate = $college['submitted'] > 0 ? round(($college['funded']/$college['submitted'])*100) : 0; $cCol = $cColors[$cIdx % count($cColors)]; $cIdx++; @endphp
    <div class="college-row" style="border-left-color: {{ $cCol }};">
        <div class="college-name">{{ $college['name'] }}</div>
        <div style="width:70px;">
            <div class="college-rate-wrap"><div class="college-rate-fill" style="width:{{ $rate }}%; background:{{ $cCol }};"></div></div>
            <div style="font-size:7pt; color:#64748b; margin-top:2px;">{{ $rate }}% funded</div>
        </div>
        <div class="college-stat">
            <div class="college-stat-val" style="color:{{ $cCol }};">{{ $college['submitted'] }}</div>
            <div class="college-stat-sub">submitted</div>
        </div>
        <div class="college-stat">
            <div class="college-stat-val" style="color:#15803d;">{{ $college['funded'] }}</div>
            <div class="college-stat-sub">funded</div>
        </div>
    </div>
    @endforeach
</div>
@endif

{{-- ── 6. Proposal Calls ────────────────────────────────── --}}
@if(!empty($calls))
<hr class="divider">
<div class="section">
    <div class="section-head">
        <div class="section-num">6</div>
        <div class="section-title">Proposal Calls Issued</div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Title</th>
                <th>Category</th>
                <th class="tc">Status</th>
                <th class="tr">Deadline</th>
            </tr>
        </thead>
        <tbody>
        @foreach($calls as $call)
        <tr>
            <td>{{ $call['title'] }}</td>
            <td>{{ ucwords(str_replace('_', ' ', $call['category'] ?? '')) }}</td>
            <td class="tc">
                <span class="badge {{ $call['status'] === 'active' ? 'badge-green' : 'badge-slate' }}">
                    {{ ucfirst($call['status'] ?? '') }}
                </span>
            </td>
            <td class="tr">{{ $call['end_date'] ? \Carbon\Carbon::parse($call['end_date'])->format('d M Y') : '—' }}</td>
        </tr>
        @endforeach
        </tbody>
    </table>
</div>
@endif

</div>{{-- /body --}}

{{-- ── Footer ───────────────────────────────────────────── --}}
<div class="footer">
    <span>{{ $org_name }} &nbsp;·&nbsp; Annual RTT Report {{ $academic_year }}</span>
    <span>Confidential &nbsp;·&nbsp; Generated {{ $generated_at }}</span>
</div>

</div>
</body>
</html>
