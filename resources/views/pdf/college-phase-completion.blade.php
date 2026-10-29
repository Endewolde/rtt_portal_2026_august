<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>College Phase Completion</title>
<style>
@include('pdf.partials.fonts')
@page { margin: 0 0 34px 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DejaVu Sans', Arial, 'Noto Sans Ethiopic', sans-serif; font-size: 7.5pt; color: #1e293b; line-height: 1.4; }

.footer { position: fixed; bottom: 10px; left: 34px; right: 34px; height: 14px; font-size: 6.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
.footer .right { float: right; }

.cover { background: #0f172a; padding: 24px 34px 18px; }
.cover table { width: 100%; border-collapse: collapse; }
.cover .logo { width: 50px; vertical-align: middle; }
.cover .logo img { width: 42px; height: 42px; }
.accent { height: 4px; background: #10b981; }
.tag { font-size: 6.5pt; font-weight: bold; color: #6ee7b7; letter-spacing: 0.16em; text-transform: uppercase; }
.title { font-size: 19pt; font-weight: bold; color: #fff; line-height: 1.2; }
.sub { font-size: 8pt; color: #94a3b8; }
.scope { margin-top: 12px; padding-top: 8px; border-top: 1px solid #1e293b; font-size: 7pt; color: #94a3b8; }
.scope strong { color: #e2e8f0; }

.content { padding: 16px 34px 0; }
.h { font-size: 9.5pt; font-weight: bold; color: #0f172a; border-left: 3px solid #10b981; padding-left: 8px; margin: 2px 0 9px; }
.h small { font-size: 7pt; font-weight: normal; color: #94a3b8; }

/* Phase summary cards */
table.cards { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 16px; }
.card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; vertical-align: top; background: #fff; }
.card-gap { width: 12px; }
.card .phase { font-size: 6.8pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
.card .big { font-size: 26pt; font-weight: bold; line-height: 1.05; }
.card .big small { font-size: 9pt; font-weight: normal; color: #94a3b8; }
.card .of { font-size: 7.5pt; color: #64748b; margin-bottom: 8px; }
.card .done { margin-top: 8px; padding-top: 7px; border-top: 1px dashed #e2e8f0; font-size: 7pt; color: #475569; }
.card .done b { color: #0f172a; }

table.counts { width: 100%; border-collapse: collapse; margin-top: 7px; }
table.counts td { width: 25%; font-size: 6.6pt; color: #64748b; vertical-align: top; }
table.counts .n { font-size: 11pt; font-weight: bold; color: #0f172a; line-height: 1.1; }

/* Stacked bar — floated segments inside a fixed-height track (dompdf has no flexbox) */
.bar { width: 100%; overflow: hidden; background: #f1f5f9; }
.bar.lg { height: 9px; border-radius: 4px; }
.bar.sm { height: 6px; border-radius: 3px; margin: 4px 0 1px; }
.bar div { float: left; height: 100%; }
.s-rev { background: #10b981; } .s-rej { background: #f43f5e; } .s-pen { background: #fbbf24; } .s-una { background: #cbd5e1; }

.dot { display: inline-block; width: 6px; height: 6px; border-radius: 3px; margin-right: 3px; }
.legend { margin: 0 0 9px; font-size: 6.8pt; color: #475569; }
.legend span.item { padding-right: 14px; }

.t-ok { color: #059669; } .t-mid { color: #d97706; } .t-low { color: #e11d48; } .t-none { color: #cbd5e1; }

/* College table */
table.list { width: 100%; border-collapse: collapse; }
table.list th { background: #f1f5f9; color: #475569; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; padding: 6px 7px; border-bottom: 1px solid #cbd5e1; }
table.list th.r, table.list td.r { text-align: right; }
table.list td { padding: 8px 7px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
table.list tr { page-break-inside: avoid; }
table.list tr.complete td { background: #f0fdf4; }
.rank { color: #94a3b8; font-weight: bold; }
.college { font-weight: bold; color: #0f172a; font-size: 8pt; }
.badge { display: inline-block; margin-top: 3px; padding: 1px 6px; border-radius: 8px; font-size: 6pt; font-weight: bold; background: #d1fae5; color: #047857; }
.pct { font-size: 11pt; font-weight: bold; }
.ofn { font-size: 6.5pt; color: #94a3b8; }
.mini { margin-top: 3px; font-size: 6.4pt; color: #64748b; }
.mini b { color: #334155; }
.empty-phase { font-size: 6.8pt; font-style: italic; color: #94a3b8; }
.empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 9pt; }
.note { margin-top: 12px; font-size: 6.5pt; color: #94a3b8; line-height: 1.5; }
</style>
</head>
<body>
@php
    $tone = fn ($pct) => $pct === null ? 't-none' : ($pct >= 100 ? 't-ok' : ($pct >= 50 ? 't-mid' : 't-low'));
    $fmt = fn ($pct) => $pct === null ? '—' : rtrim(rtrim(number_format($pct, 1), '0'), '.').'%';
    $segments = [['reviewed', 's-rev'], ['rejected', 's-rej'], ['pending', 's-pen'], ['unassigned', 's-una']];
    $bar = function (array $phase, string $size) use ($segments) {
        $parts = ($phase['total'] ?? 0) === 0 ? '' : collect($segments)
            ->filter(fn ($s) => $phase[$s[0]] > 0)
            ->map(fn ($s) => '<div class="'.$s[1].'" style="width: '.round($phase[$s[0]] / $phase['total'] * 100, 2).'%"></div>')
            ->implode('');

        return '<div class="bar '.$size.'">'.$parts.'</div>';
    };
    $isComplete = fn (array $c) => collect($phaseKeys)->every(fn ($k) => $c['phases'][$k]['completion_pct'] == 100 && $c['phases'][$k]['total'] > 0);
@endphp

<div class="footer">
    {{ $orgName }} · {{ $systemName }} — College Phase Completion
    <span class="right">Generated {{ $generatedAt->format('j M Y, H:i') }}</span>
</div>

<div class="cover">
    <table><tr>
        @if ($logo)
            <td class="logo"><img src="{{ $logo }}" alt=""></td>
        @endif
        <td>
            <div class="tag">Review progress report</div>
            <div class="title">College Phase Completion</div>
            <div class="sub">{{ $orgName }} — how far each {{ strtolower(\App\Support\Terms::college()) }} has come through blind review and open defence</div>
        </td>
    </tr></table>
    <div class="scope">
        @foreach ($scope as $label => $value)
            @if (! $loop->first) &nbsp;&nbsp;·&nbsp;&nbsp; @endif{{ $label }}: <strong>{{ $value }}</strong>
        @endforeach
        &nbsp;&nbsp;·&nbsp;&nbsp; Phases: <strong>{{ collect($phaseKeys)->map(fn ($k) => $phaseLabels[$k])->implode(' & ') }}</strong>
    </div>
</div>
<div class="accent"></div>

<div class="content">
    <div class="h">Overall progress <small>— share of proposals with a decision at each phase</small></div>
    <table class="cards"><tr>
        @foreach ($overall as $key => $o)
            @if (! $loop->first)<td class="card-gap"></td>@endif
            <td class="card" style="width: {{ count($overall) === 1 ? 100 : 49 }}%">
                <div class="phase">{{ $o['label'] }}</div>
                <div class="big {{ $tone($o['completion_pct']) }}">{{ $fmt($o['completion_pct']) }} <small>decided</small></div>
                <div class="of">{{ $o['reviewed'] + $o['rejected'] }} of {{ $o['total'] }} proposal{{ $o['total'] === 1 ? '' : 's' }}</div>
                {!! $bar($o, 'lg') !!}
                <table class="counts"><tr>
                    <td><div class="n">{{ $o['reviewed'] }}</div><span class="dot s-rev"></span>Reviewed</td>
                    <td><div class="n">{{ $o['rejected'] }}</div><span class="dot s-rej"></span>Rejected</td>
                    <td><div class="n">{{ $o['pending'] }}</div><span class="dot s-pen"></span>On review</td>
                    <td><div class="n">{{ $o['unassigned'] }}</div><span class="dot s-una"></span>Waiting</td>
                </tr></table>
                <div class="done"><b>{{ $o['colleges_done'] }} of {{ $colleges->count() }}</b> {{ strtolower(\App\Support\Terms::college(true)) }} fully complete</div>
            </td>
        @endforeach
    </tr></table>

    <div class="h">By {{ strtolower(\App\Support\Terms::college()) }} <small>— most complete first</small></div>
    <div class="legend">
        <span class="item"><span class="dot s-rev"></span>Reviewed — passed the phase</span>
        <span class="item"><span class="dot s-rej"></span>Rejected at the phase</span>
        <span class="item"><span class="dot s-pen"></span>On review — awaiting a decision</span>
        <span class="item"><span class="dot s-una"></span>Waiting for assignment</span>
    </div>

    @if ($colleges->isEmpty())
        <div class="empty">No {{ strtolower(\App\Support\Terms::college(true)) }} match these filters.</div>
    @else
        @php $phaseWidth = count($phaseKeys) === 1 ? 58 : 32; @endphp
        <table class="list">
            <thead>
                <tr>
                    <th style="width: 5%">#</th>
                    <th>{{ \App\Support\Terms::college() }}</th>
                    <th class="r" style="width: 10%">Proposals</th>
                    @foreach ($phaseKeys as $key)
                        <th style="width: {{ $phaseWidth }}%">{{ $phaseLabels[$key] }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @foreach ($colleges as $c)
                    @php $complete = $isComplete($c); @endphp
                    <tr class="{{ $complete ? 'complete' : '' }}">
                        <td class="rank">{{ $loop->iteration }}</td>
                        <td>
                            <div class="college">{{ $c['college_name'] }}</div>
                            @if ($complete)<span class="badge">✓ Complete</span>@endif
                        </td>
                        <td class="r">{{ $c['total_proposals'] }}</td>
                        @foreach ($phaseKeys as $key)
                            @php $p = $c['phases'][$key]; @endphp
                            <td style="width: {{ $phaseWidth }}%">
                                @if ($p['total'] === 0)
                                    <span class="empty-phase">No proposals at this phase</span>
                                @else
                                    <span class="pct {{ $tone($p['completion_pct']) }}">{{ $fmt($p['completion_pct']) }}</span>
                                    <span class="ofn">&nbsp;of {{ $p['total'] }}</span>
                                    {!! $bar($p, 'sm') !!}
                                    <div class="mini">
                                        <span class="dot s-rev"></span><b>{{ $p['reviewed'] }}</b>&nbsp;&nbsp;
                                        <span class="dot s-rej"></span><b>{{ $p['rejected'] }}</b>&nbsp;&nbsp;
                                        <span class="dot s-pen"></span><b>{{ $p['pending'] }}</b>&nbsp;&nbsp;
                                        <span class="dot s-una"></span><b>{{ $p['unassigned'] }}</b>
                                    </div>
                                @endif
                            </td>
                        @endforeach
                    </tr>
                @endforeach
            </tbody>
        </table>
    @endif

    <p class="note">
        Completion is the share of proposals with a decision (passed or rejected) at the phase. Blind review counts proposals that were validated;
        open defence counts those that passed blind review. Proposals still awaiting validation, rejected before the phase, or granted as legacy
        projects are not counted. A proposal waiting for a reviewer counts against completion just like one awaiting a decision.
    </p>
</div>
</body>
</html>
