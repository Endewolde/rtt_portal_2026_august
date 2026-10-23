<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Proposal Statistics Report</title>
<style>
@include('pdf.partials.fonts')
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
    font-family: 'DejaVu Sans', Arial, 'Noto Sans Ethiopic', sans-serif;
    font-size: 8.5pt;
    color: #1e293b;
    background: #fff;
    line-height: 1.5;
}

/* ── Cover header ─────────────────────────────────────────── */
.cover {
    background: #0f172a;
    padding: 32px 40px 26px;
    position: relative;
    overflow: hidden;
}
.cover-circle-1 {
    position: absolute; right: -50px; top: -50px;
    width: 200px; height: 200px; border-radius: 50%;
    background: rgba(99,102,241,0.12);
}
.cover-circle-2 {
    position: absolute; right: 60px; bottom: -30px;
    width: 120px; height: 120px; border-radius: 50%;
    background: rgba(99,102,241,0.07);
}
.cover-tag {
    font-size: 6.5pt; font-weight: bold; color: #818cf8;
    letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 8px;
}
.cover-title {
    font-size: 20pt; font-weight: bold; color: #fff; line-height: 1.2; margin-bottom: 4px;
}
.cover-sub { font-size: 9pt; color: #94a3b8; margin-bottom: 18px; }
.cover-meta-row {
    border-top: 1px solid rgba(255,255,255,0.08);
    padding-top: 14px;
    margin-top: 4px;
}
.cover-meta-item {
    display: inline-block; margin-right: 28px;
    font-size: 7.5pt; color: #94a3b8;
}
.cover-meta-item strong { color: #e2e8f0; font-size: 8pt; }

/* ── KPI band ─────────────────────────────────────────────── */
.kpi-band { padding: 16px 40px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.kpi-row { width: 100%; border-collapse: collapse; }
.kpi-cell {
    padding: 10px 14px; text-align: center;
    border-right: 1px solid #e2e8f0;
}
.kpi-cell:last-child { border-right: none; }
.kpi-num { font-size: 18pt; font-weight: bold; line-height: 1; }
.kpi-label { font-size: 6.5pt; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px; }
.kpi-blue   { color: #2563eb; }
.kpi-purple { color: #7c3aed; }
.kpi-green  { color: #059669; }
.kpi-red    { color: #dc2626; }
.kpi-gray   { color: #64748b; }

/* ── Content area ─────────────────────────────────────────── */
.content { padding: 20px 40px; }

/* ── Section header ───────────────────────────────────────── */
.section-header {
    margin-bottom: 10px; margin-top: 20px;
    border-left: 3px solid #4f46e5;
    padding-left: 10px;
}
.section-header:first-child { margin-top: 0; }
.section-title { font-size: 9.5pt; font-weight: bold; color: #0f172a; }
.section-sub   { font-size: 7pt; color: #94a3b8; margin-top: 1px; }

/* ── Data tables ──────────────────────────────────────────── */
.data-table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
.data-table thead tr {
    background: #f1f5f9;
}
.data-table thead th {
    padding: 6px 10px; text-align: left;
    font-size: 6.5pt; font-weight: bold; color: #64748b;
    text-transform: uppercase; letter-spacing: 0.1em;
    border-bottom: 1px solid #e2e8f0;
}
.data-table thead th.right { text-align: right; }
.data-table tbody tr:nth-child(even) { background: #f8fafc; }
.data-table tbody tr:nth-child(odd)  { background: #fff; }
.data-table tbody td {
    padding: 7px 10px; border-bottom: 1px solid #f1f5f9;
    font-size: 8pt; color: #1e293b; vertical-align: middle;
}
.data-table tbody td.right { text-align: right; }
.data-table tbody td.center { text-align: center; }
.data-table tbody td.muted  { color: #94a3b8; }

/* ── College badge ────────────────────────────────────────── */
.code-badge {
    display: inline-block;
    background: #ede9fe; color: #4f46e5;
    font-size: 6.5pt; font-weight: bold;
    padding: 2px 6px; border-radius: 4px;
}

/* ── Progress bar ─────────────────────────────────────────── */
.bar-wrap { width: 80px; display: inline-block; vertical-align: middle; }
.bar-bg   { background: #e0e7ff; border-radius: 3px; height: 6px; width: 100%; }
.bar-fill { background: #4f46e5; border-radius: 3px; height: 6px; }
.bar-fill-green  { background: #059669; }
.bar-fill-amber  { background: #d97706; }
.bar-fill-red    { background: #dc2626; }

/* ── Status dot ───────────────────────────────────────────── */
.dot {
    display: inline-block; width: 7px; height: 7px;
    border-radius: 50%; margin-right: 5px; vertical-align: middle;
}
.dot-green  { background: #059669; }
.dot-blue   { background: #2563eb; }
.dot-purple { background: #7c3aed; }
.dot-amber  { background: #d97706; }
.dot-red    { background: #dc2626; }
.dot-gray   { background: #94a3b8; }

/* ── Gender pill ──────────────────────────────────────────── */
.gender-pill {
    display: inline-block; padding: 2px 8px; border-radius: 12px;
    font-size: 7pt; font-weight: bold; text-transform: capitalize;
}
.gender-male          { background: #dbeafe; color: #1d4ed8; }
.gender-female        { background: #fce7f3; color: #9d174d; }
.gender-not_specified { background: #f1f5f9; color: #64748b; }
.gender-other         { background: #f3e8ff; color: #6d28d9; }

/* ── Category chip ────────────────────────────────────────── */
.cat-chip {
    display: inline-block; padding: 2px 8px; border-radius: 12px;
    font-size: 7pt; font-weight: bold;
}
.cat-research   { background: #ede9fe; color: #5b21b6; }
.cat-community  { background: #dcfce7; color: #15803d; }
.cat-technology { background: #fff7ed; color: #c2410c; }
.cat-other      { background: #f1f5f9; color: #475569; }

/* ── Two-column grid ──────────────────────────────────────── */
.two-col { width: 100%; border-collapse: collapse; }
.two-col td { padding: 0; vertical-align: top; }
.two-col td:first-child { padding-right: 12px; }

/* ── Footer ───────────────────────────────────────────────── */
.footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: #f8fafc; border-top: 1px solid #e2e8f0;
    padding: 6px 40px; text-align: right;
}
.footer-text { font-size: 6.5pt; color: #94a3b8; }

.page-break { page-break-before: always; }
</style>
</head>
<body>

{{-- ── FOOTER (fixed) ──────────────────────────────────── --}}
<div class="footer">
    <span class="footer-text">
        {{ $orgName }} · Proposal Statistics · Generated {{ now()->format('d M Y, H:i') }}
        &nbsp;·&nbsp; <span class="pagenum"></span>
    </span>
</div>

{{-- ── COVER HEADER ─────────────────────────────────────── --}}
<div class="cover">
    <div class="cover-circle-1"></div>
    <div class="cover-circle-2"></div>
    <div class="cover-tag">Research &amp; Technology Transfer Office</div>
    <div class="cover-title">Proposal Statistics Report</div>
    <div class="cover-sub">Comprehensive breakdown by college, department, gender, status, and category</div>
    <div class="cover-meta-row">
        <span class="cover-meta-item"><strong>Academic Year</strong><br>{{ $academicYear }}</span>
        <span class="cover-meta-item"><strong>Institution</strong><br>{{ $orgName }}</span>
        <span class="cover-meta-item"><strong>Total Submitted</strong><br>{{ number_format($totals['submitted']) }}</span>
        <span class="cover-meta-item"><strong>Report Date</strong><br>{{ now()->format('d F Y') }}</span>
    </div>
</div>

{{-- ── KPI BAND ─────────────────────────────────────────── --}}
<div class="kpi-band">
    <table class="kpi-row">
        <tr>
            <td class="kpi-cell">
                <div class="kpi-num kpi-blue">{{ number_format($totals['submitted']) }}</div>
                <div class="kpi-label">Submitted</div>
            </td>
            <td class="kpi-cell">
                <div class="kpi-num kpi-purple">{{ number_format($totals['under_review']) }}</div>
                <div class="kpi-label">Under Review</div>
            </td>
            <td class="kpi-cell">
                <div class="kpi-num kpi-green">{{ number_format($totals['funded']) }}</div>
                <div class="kpi-label">Funded</div>
            </td>
            <td class="kpi-cell">
                <div class="kpi-num kpi-red">{{ number_format($totals['rejected']) }}</div>
                <div class="kpi-label">Rejected</div>
            </td>
        </tr>
    </table>
</div>

{{-- ── CONTENT ──────────────────────────────────────────── --}}
<div class="content">

    {{-- ── BY COLLEGE ─────────────────────────────────── --}}
    <div class="section-header">
        <div class="section-title">By College</div>
        <div class="section-sub">Submission breakdown across all colleges (excludes drafts)</div>
    </div>

    @php $maxCollege = max(1, $byCollege->max('total')); @endphp
    <table class="data-table">
        <thead>
            <tr>
                <th style="width:8%">Code</th>
                <th style="width:36%">College Name</th>
                <th class="right" style="width:8%">Total</th>
                <th class="right" style="width:8%">Funded</th>
                <th class="right" style="width:8%">Rejected</th>
                <th class="right" style="width:8%">Active</th>
                <th class="right" style="width:10%">Fund %</th>
                <th style="width:14%">Volume</th>
            </tr>
        </thead>
        <tbody>
            @forelse($byCollege as $row)
            @php
                $fundedPct = $row->total > 0 ? round(($row->funded / $row->total) * 100) : 0;
                $volumePct = round(($row->total / $maxCollege) * 100);
            @endphp
            <tr>
                <td><span class="code-badge">{{ $row->code }}</span></td>
                <td>{{ $row->college_name }}</td>
                <td class="right"><strong>{{ $row->total }}</strong></td>
                <td class="right" style="color:#059669">{{ $row->funded }}</td>
                <td class="right" style="color:#dc2626">{{ $row->rejected }}</td>
                <td class="right" style="color:#2563eb">{{ $row->active }}</td>
                <td class="right">{{ $fundedPct }}%</td>
                <td>
                    <div class="bar-bg">
                        <div class="bar-fill" style="width:{{ $volumePct }}%;"></div>
                    </div>
                </td>
            </tr>
            @empty
            <tr><td colspan="8" class="center muted">No data available.</td></tr>
            @endforelse
        </tbody>
    </table>

    {{-- ── BY DEPARTMENT ───────────────────────────────── --}}
    <div class="section-header">
        <div class="section-title">By Department (Top 15)</div>
        <div class="section-sub">Highest-submitting departments across all colleges</div>
    </div>

    @php $maxDept = max(1, $byDepartment->max('total')); @endphp
    <table class="data-table">
        <thead>
            <tr>
                <th style="width:38%">Department</th>
                <th style="width:30%">College</th>
                <th class="right" style="width:8%">Total</th>
                <th class="right" style="width:8%">Funded</th>
                <th class="right" style="width:8%">Fund %</th>
                <th style="width:8%">Volume</th>
            </tr>
        </thead>
        <tbody>
            @forelse($byDepartment as $row)
            @php
                $fundedPct = $row->total > 0 ? round(($row->funded / $row->total) * 100) : 0;
                $volumePct = round(($row->total / $maxDept) * 100);
            @endphp
            <tr>
                <td>{{ $row->department_name }}</td>
                <td class="muted">{{ $row->college_name }}</td>
                <td class="right"><strong>{{ $row->total }}</strong></td>
                <td class="right" style="color:#059669">{{ $row->funded }}</td>
                <td class="right">{{ $fundedPct }}%</td>
                <td>
                    <div class="bar-bg">
                        <div class="bar-fill" style="width:{{ $volumePct }}%;"></div>
                    </div>
                </td>
            </tr>
            @empty
            <tr><td colspan="6" class="center muted">No data available.</td></tr>
            @endforelse
        </tbody>
    </table>

    {{-- ── BY GENDER + BY CATEGORY (side by side) ─────── --}}
    <table class="two-col">
        <tr>
            {{-- Gender --}}
            <td style="width:48%">
                <div class="section-header">
                    <div class="section-title">By PI Gender</div>
                    <div class="section-sub">Principal investigator gender distribution</div>
                </div>
                @php $totalGender = max(1, $byGender->sum('total')); @endphp
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Gender</th>
                            <th class="right">Total</th>
                            <th class="right">Funded</th>
                            <th class="right">Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($byGender as $row)
                        @php
                            $pct = round(($row->total / $totalGender) * 100);
                            $pillClass = 'gender-' . ($row->gender === 'not_specified' ? 'not_specified' : $row->gender);
                        @endphp
                        <tr>
                            <td>
                                <span class="gender-pill {{ $pillClass }}">
                                    {{ ucfirst(str_replace('_', ' ', $row->gender)) }}
                                </span>
                            </td>
                            <td class="right"><strong>{{ $row->total }}</strong></td>
                            <td class="right" style="color:#059669">{{ $row->funded }}</td>
                            <td class="right">{{ $pct }}%</td>
                        </tr>
                        @empty
                        <tr><td colspan="4" class="center muted">No data.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </td>

            {{-- Category --}}
            <td style="width:52%; padding-left:12px;">
                <div class="section-header">
                    <div class="section-title">By Category</div>
                    <div class="section-sub">Breakdown by research category type</div>
                </div>
                @php $totalCat = max(1, $byCategory->sum('total')); @endphp
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th class="right">Total</th>
                            <th class="right">Share</th>
                            <th>Volume</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($byCategory as $row)
                        @php
                            $pct = round(($row->total / $totalCat) * 100);
                            $catClass = match($row->category) {
                                'research'           => 'cat-research',
                                'community_engagement' => 'cat-community',
                                'technology_transfer'  => 'cat-technology',
                                default                => 'cat-other',
                            };
                        @endphp
                        <tr>
                            <td>
                                <span class="cat-chip {{ $catClass }}">
                                    {{ ucwords(str_replace('_', ' ', $row->category)) }}
                                </span>
                            </td>
                            <td class="right"><strong>{{ $row->total }}</strong></td>
                            <td class="right">{{ $pct }}%</td>
                            <td>
                                <div class="bar-bg">
                                    <div class="bar-fill" style="width:{{ $pct }}%;"></div>
                                </div>
                            </td>
                        </tr>
                        @empty
                        <tr><td colspan="4" class="center muted">No data.</td></tr>
                        @endforelse
                    </tbody>
                </table>
            </td>
        </tr>
    </table>

    {{-- ── BY STATUS ───────────────────────────────────── --}}
    <div class="section-header">
        <div class="section-title">By Status</div>
        <div class="section-sub">Full pipeline status distribution (excluding drafts)</div>
    </div>

    @php
    $totalStatus = max(1, $byStatus->sum('count'));
    $statusConfig = [
        'submitted'           => ['label' => 'Submitted',           'dot' => 'dot-blue'  ],
        'validated'           => ['label' => 'Validated',           'dot' => 'dot-blue'  ],
        'under_blind_review'  => ['label' => 'Under Blind Review',  'dot' => 'dot-purple'],
        'blind_review_passed' => ['label' => 'Blind Review Passed', 'dot' => 'dot-purple'],
        'under_open_defence'  => ['label' => 'Under Open Defence',  'dot' => 'dot-purple'],
        'accepted'            => ['label' => 'Central Evaluation',  'dot' => 'dot-purple'],
        'funded'              => ['label' => 'Funded',              'dot' => 'dot-green' ],
        'midterm_evaluation'  => ['label' => 'Midterm Evaluation',  'dot' => 'dot-amber' ],
        'completed'           => ['label' => 'Completed',           'dot' => 'dot-green' ],
        'rejected'            => ['label' => 'Rejected',            'dot' => 'dot-red'   ],
        'archived'            => ['label' => 'Archived',            'dot' => 'dot-gray'  ],
    ];
    @endphp

    <table class="data-table">
        <thead>
            <tr>
                <th style="width:40%">Status</th>
                <th class="right" style="width:15%">Count</th>
                <th class="right" style="width:15%">Share</th>
                <th style="width:30%">Distribution</th>
            </tr>
        </thead>
        <tbody>
            @forelse($byStatus as $row)
            @php
                $pct = round(($row->count / $totalStatus) * 100);
                $cfg = $statusConfig[$row->status] ?? ['label' => ucwords(str_replace('_', ' ', $row->status)), 'dot' => 'dot-gray'];
            @endphp
            <tr>
                <td>
                    <span class="dot {{ $cfg['dot'] }}"></span>
                    {{ $cfg['label'] }}
                </td>
                <td class="right"><strong>{{ $row->count }}</strong></td>
                <td class="right">{{ $pct }}%</td>
                <td>
                    <div class="bar-bg">
                        <div class="{{ str_contains($cfg['dot'], 'green') ? 'bar-fill bar-fill-green' : (str_contains($cfg['dot'], 'red') ? 'bar-fill bar-fill-red' : (str_contains($cfg['dot'], 'amber') ? 'bar-fill bar-fill-amber' : 'bar-fill')) }}" style="width:{{ $pct }}%;"></div>
                    </div>
                </td>
            </tr>
            @empty
            <tr><td colspan="4" class="center muted">No data available.</td></tr>
            @endforelse
        </tbody>
    </table>

</div>{{-- /content --}}

</body>
</html>
