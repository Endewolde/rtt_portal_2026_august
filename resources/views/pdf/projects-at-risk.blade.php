<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Projects at Risk</title>
<style>
@include('pdf.partials.fonts')
@page { margin: 0 0 30px 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DejaVu Sans', Arial, 'Noto Sans Ethiopic', sans-serif; font-size: 7.5pt; color: #1e293b; line-height: 1.4; }

.footer { position: fixed; bottom: 8px; left: 32px; right: 32px; height: 14px; font-size: 6.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
.footer .right { float: right; }

.cover { background: #0f172a; padding: 22px 32px 18px; }
.cover table { width: 100%; border-collapse: collapse; }
.cover .logo { width: 46px; vertical-align: middle; }
.cover .logo img { width: 40px; height: 40px; }
.tag { font-size: 6.5pt; font-weight: bold; color: #fca5a5; letter-spacing: 0.16em; text-transform: uppercase; }
.title { font-size: 18pt; font-weight: bold; color: #fff; line-height: 1.2; }
.sub { font-size: 8pt; color: #94a3b8; }
.scope { margin-top: 10px; padding-top: 8px; border-top: 1px solid #1e293b; font-size: 7pt; color: #94a3b8; }
.scope span { padding-right: 22px; }
.scope strong { color: #e2e8f0; }

.kpis { padding: 12px 32px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.kpis table { width: 100%; border-collapse: collapse; }
.kpi { width: 25%; padding: 4px 10px; border-right: 1px solid #e2e8f0; }
.kpi.last { border-right: none; }
.kpi .n { font-size: 17pt; font-weight: bold; line-height: 1.1; }
.kpi .l { font-size: 6.5pt; font-weight: bold; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
.c-all { color: #0f172a; } .c-high { color: #dc2626; } .c-watch { color: #d97706; } .c-ok { color: #059669; }

.content { padding: 14px 32px 0; }
.h { font-size: 9pt; font-weight: bold; color: #0f172a; border-left: 3px solid #dc2626; padding-left: 8px; margin: 4px 0 8px; }
.chips { margin-bottom: 12px; }
.chip { display: inline-block; margin: 0 5px 5px 0; padding: 2px 8px; border: 1px solid #e2e8f0; border-radius: 9px; font-size: 7pt; color: #334155; background: #fff; }
.chip b { color: #0f172a; }

table.list { width: 100%; border-collapse: collapse; }
table.list th { background: #f1f5f9; color: #475569; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; padding: 5px 6px; border-bottom: 1px solid #cbd5e1; }
table.list td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
table.list tr { page-break-inside: avoid; }
.lvl { display: inline-block; padding: 1px 6px; border-radius: 8px; font-size: 6.5pt; font-weight: bold; }
.lvl-high { background: #fee2e2; color: #b91c1c; }
.lvl-watch { background: #fef3c7; color: #b45309; }
.lvl-on_track { background: #d1fae5; color: #047857; }
.trk { font-size: 6.5pt; color: #94a3b8; }
.ttl { font-weight: bold; color: #0f172a; }
.muted { color: #64748b; font-size: 6.8pt; }
.late { color: #dc2626; font-weight: bold; }
.soon { color: #d97706; font-weight: bold; }

.bar { width: 100%; height: 5px; background: #e2e8f0; border-radius: 3px; margin-top: 2px; }
.bar div { height: 5px; border-radius: 3px; }
.b-time { background: #94a3b8; } .b-money { background: #3b82f6; } .b-work { background: #10b981; }
.pct { font-weight: bold; font-size: 7pt; }

.sig { margin-bottom: 3px; }
.dot { display: inline-block; width: 5px; height: 5px; border-radius: 3px; margin-right: 3px; }
.dot-high { background: #dc2626; } .dot-watch { background: #f59e0b; }
.empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 9pt; }
.note { margin-top: 10px; font-size: 6.5pt; color: #94a3b8; }
</style>
</head>
<body>
@php
    $bar = fn ($value, $class) => $value === null
        ? '<span class="muted">—</span>'
        : '<span class="pct">'.$value.'%</span><div class="bar"><div class="'.$class.'" style="width: '.max(2, $value).'%"></div></div>';
@endphp

<div class="footer">
    {{ $orgName }} · {{ $systemName }} — Projects at Risk
    <span class="right">Generated {{ $generatedAt->format('j M Y, H:i') }}</span>
</div>

<div class="cover">
    <table><tr>
        @if ($logo)
            <td class="logo"><img src="{{ $logo }}" alt=""></td>
        @endif
        <td>
            <div class="tag">Monitoring report</div>
            <div class="title">Projects at Risk</div>
            <div class="sub">{{ $orgName }} — running funded projects compared on time, money and reported progress</div>
        </td>
    </tr></table>
    <div class="scope">
        @foreach ($scope as $line)
            @php [$k, $v] = array_pad(explode(': ', $line, 2), 2, ''); @endphp
            @if (! $loop->first) &nbsp;&nbsp;·&nbsp;&nbsp; @endif{{ $k }}: <strong>{{ $v }}</strong>
        @endforeach
    </div>
</div>

<div class="kpis">
    <table><tr>
        <td class="kpi"><div class="n c-all">{{ $summary['total'] }}</div><div class="l">Projects</div></td>
        <td class="kpi"><div class="n c-high">{{ $summary['high'] }}</div><div class="l">High risk</div></td>
        <td class="kpi"><div class="n c-watch">{{ $summary['watch'] }}</div><div class="l">Watch</div></td>
        <td class="kpi last"><div class="n c-ok">{{ $summary['on_track'] }}</div><div class="l">On track</div></td>
    </tr></table>
</div>

<div class="content">
    @if (! empty($summary['by_signal']))
        <div class="h">Warnings</div>
        <div class="chips">
            @foreach (collect($summary['by_signal'])->sortDesc() as $key => $count)
                <span class="chip">{{ $signalLabels[$key] ?? $key }} <b>{{ $count }}</b></span>
            @endforeach
        </div>
    @endif

    <div class="h">Projects</div>
    @if ($projects->isEmpty())
        <div class="empty">No projects match.</div>
    @else
        <table class="list">
            <thead>
                <tr>
                    <th style="width: 7%">Level</th>
                    <th style="width: 25%">Project</th>
                    <th style="width: 11%">Timeline</th>
                    <th style="width: 8%">Time used</th>
                    <th style="width: 11%">Money released</th>
                    <th style="width: 8%">Work done</th>
                    <th style="width: 30%">Warnings</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($projects as $p)
                    <tr>
                        <td><span class="lvl lvl-{{ $p['level'] }}">{{ $levelLabels[$p['level']] }}</span></td>
                        <td>
                            <div class="trk">{{ $p['tracker_number'] }}</div>
                            <div class="ttl">{{ $p['title'] }}</div>
                            <div class="muted">{{ collect([$p['pi'], $p['college']])->filter()->implode(' · ') }}</div>
                        </td>
                        <td>
                            @if ($p['end_date'])
                                <div class="{{ $p['days_left'] < 0 ? 'late' : ($p['days_left'] <= 60 ? 'soon' : '') }}">
                                    {{ $p['days_left'] < 0 ? abs($p['days_left']).' days over' : $p['days_left'].' days left' }}
                                </div>
                                <div class="muted">{{ \Illuminate\Support\Carbon::parse($p['start_date'])->format('j M Y') }} –<br>{{ \Illuminate\Support\Carbon::parse($p['end_date'])->format('j M Y') }}</div>
                            @else
                                <span class="muted">No timeline</span>
                            @endif
                        </td>
                        <td>{!! $bar($p['elapsed_pct'], 'b-time') !!}</td>
                        <td>
                            {!! $bar($p['released_pct'], 'b-money') !!}
                            <div class="muted">{{ number_format($p['released']) }} / {{ number_format($p['budget']) }} ETB</div>
                        </td>
                        <td>{!! $bar($p['reported_progress'], 'b-work') !!}</td>
                        <td>
                            @forelse ($p['signals'] as $s)
                                <div class="sig"><span class="dot dot-{{ $s['level'] }}"></span><b>{{ $s['label'] }}.</b> <span class="muted">{{ $s['detail'] }}</span></div>
                            @empty
                                <span class="muted">No warnings</span>
                            @endforelse
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <p class="note">
        High risk: past the end date, no money released after a quarter of the project, progress 40+ points behind time, reports long overdue, or three or more warnings together.
        Work done and spending are as reported by the PI in progress reports; money released is from recorded disbursements.
    </p>
</div>
</body>
</html>
