@php
    // Rendered once when maintenance is switched on (artisan down --render) and served as
    // static HTML while the app is down — so everything is inline and the settings are read
    // here, defensively, in case the database is the thing under maintenance.
    try {
        $s = \Illuminate\Support\Facades\DB::table('app_settings')
            ->whereIn('key', ['organization_name', 'system_name', 'system_logo', 'public_hero_bg', 'primary_color', 'public_social_telegram', 'public_social_facebook'])
            ->pluck('value', 'key');
    } catch (\Throwable) {
        $s = collect();
    }
    try {
        $info = \App\Support\MaintenancePageData::collect();
    } catch (\Throwable) {
        $info = null;
    }
    $orgName = $s['organization_name'] ?? 'Wolaita Sodo University';
    $systemName = $s['system_name'] ?? 'RTT Platform';
    $logo = $s['system_logo'] ?? null;
    $brand = preg_match('/^#[0-9a-f]{6}$/i', $s['public_hero_bg'] ?? '') ? $s['public_hero_bg'] : '#0b3a66';
    $accent = preg_match('/^#[0-9a-f]{6}$/i', $s['primary_color'] ?? '') ? $s['primary_color'] : '#2563eb';
    $telegram = $s['public_social_telegram'] ?? null;
    $facebook = $s['public_social_facebook'] ?? null;
    $since = now();
    $safeColor = fn ($c) => preg_match('/^#[0-9a-f]{6}$/i', (string) $c) ? $c : '#64748b';
    $funded = array_slice($info['recently_funded'] ?? [], 0, 5);
    $services = ['Proposal submission', 'Reviews & scoring', 'Funding & finance', 'Reports & dashboards'];
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Scheduled maintenance · {{ $systemName }}</title>
@if ($logo)<link rel="icon" href="{{ $logo }}">@endif
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
    :root {
        --brand: {{ $brand }};
        --accent: {{ $accent }};
        --page: #f4f6f9;
        --surface: #ffffff;
        --ink: #0f172a;
        --body: #475569;
        --muted: #64748b;
        --rule: #e2e8f0;
        --soft: #f8fafc;
        --mark: var(--brand);
        --shadow: 0 1px 2px rgba(15, 23, 42, .06), 0 8px 24px -12px rgba(15, 23, 42, .12);
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --page: #0b0f15;
            --surface: #121821;
            --ink: #e8edf3;
            --body: #b6c0cc;
            --muted: #8592a3;
            --rule: #222b37;
            --soft: #18202b;
            --mark: color-mix(in srgb, var(--accent) 55%, #ffffff);
            --shadow: 0 1px 2px rgba(0, 0, 0, .4);
        }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        min-height: 100vh; display: flex; flex-direction: column;
        background: var(--page); color: var(--body);
        font: 15px/1.6 Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans Ethiopic", sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    svg { flex-shrink: 0; }
    .wrap { width: 100%; max-width: 1160px; margin: 0 auto; padding: 0 24px; }

    /* Header */
    .top { background: var(--surface); border-bottom: 1px solid var(--rule); }
    .top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 68px; }
    .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .brand img { width: 38px; height: 38px; object-fit: contain; }
    .brand strong { display: block; color: var(--ink); font-size: 15px; font-weight: 600; line-height: 1.25; letter-spacing: -.01em; }
    .brand span { display: block; color: var(--muted); font-size: 12.5px; }
    .btn {
        display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 8px;
        font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap;
        border: 1px solid transparent; transition: background .15s, border-color .15s;
    }
    .btn svg { width: 16px; height: 16px; }
    .btn-outline { background: var(--surface); color: var(--ink); border-color: var(--rule); }
    .btn-outline:hover { background: var(--soft); }
    .btn-light { background: #fff; color: #0f172a; }
    .btn-light:hover { background: #f1f5f9; }
    .btn-ghost { color: #fff; border-color: rgba(255,255,255,.28); }
    .btn-ghost:hover { background: rgba(255,255,255,.08); }

    /* Hero */
    .hero { background: var(--brand); color: #fff; padding: 56px 0 112px; }
    .hero .wrap { display: grid; grid-template-columns: minmax(0, 1fr); gap: 40px; }
    @media (min-width: 980px) { .hero .wrap { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 64px; align-items: center; } }
    .chip { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px 5px 10px; border-radius: 999px; background: rgba(251, 191, 36, .16); color: #fde68a; font-size: 12.5px; font-weight: 600; }
    .chip i { width: 7px; height: 7px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 0 3px rgba(251, 191, 36, .25); }
    .hero h1 { margin-top: 18px; font-size: clamp(32px, 4.4vw, 48px); font-weight: 700; line-height: 1.08; letter-spacing: -.025em; }
    .hero .lead { margin-top: 16px; max-width: 36em; font-size: 17px; color: rgba(255,255,255,.8); }
    .hero .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 28px; }
    .meta { display: flex; flex-wrap: wrap; gap: 10px 28px; margin-top: 30px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.14); font-size: 13.5px; color: rgba(255,255,255,.72); }
    .meta div { display: flex; align-items: center; gap: 8px; }
    .meta svg { width: 16px; height: 16px; color: rgba(255,255,255,.6); }
    .meta b { color: #fff; font-weight: 600; }
    .ring { transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 3; }
    .ring .bg { stroke: rgba(255,255,255,.2); }
    .ring .fg { stroke: #fff; stroke-dasharray: 50.27; stroke-dashoffset: 0; animation: ring 60s linear forwards; }
    @keyframes ring { to { stroke-dashoffset: 50.27; } }

    .status { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 14px; padding: 4px 0; }
    .status h2 { padding: 14px 20px 10px; font-size: 12px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: rgba(255,255,255,.6); }
    .status ul { list-style: none; }
    .status li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 20px; border-top: 1px solid rgba(255,255,255,.1); font-size: 14.5px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .pill-paused { background: rgba(251, 191, 36, .16); color: #fde68a; }
    .pill-safe { background: rgba(74, 222, 128, .16); color: #bbf7d0; }
    .pill i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    /* Content */
    main { flex: 1; margin-top: -72px; padding-bottom: 56px; }
    .cards { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; }
    @media (min-width: 980px) { .cards { grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); align-items: start; } }
    .card { background: var(--surface); border: 1px solid var(--rule); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
    .card-head { padding: 20px 22px 16px; }
    .card-head h3 { color: var(--ink); font-size: 15.5px; font-weight: 600; letter-spacing: -.01em; }
    .card-head p { margin-top: 2px; font-size: 13px; color: var(--muted); }
    .figures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--rule); }
    .figures div { padding: 22px; }
    .figures div:nth-child(even) { border-left: 1px solid var(--rule); }
    .figures div:nth-child(n+3) { border-top: 1px solid var(--rule); }
    .figures b { display: block; color: var(--ink); font-size: 34px; font-weight: 700; line-height: 1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
    .figures span { display: block; margin-top: 8px; font-size: 13px; color: var(--muted); }

    .tabs { display: flex; gap: 4px; margin: 0 22px; padding: 4px; border-radius: 10px; background: var(--soft); border: 1px solid var(--rule); }
    .tab { flex: 1; height: 34px; border: 0; border-radius: 7px; background: none; cursor: pointer; font: inherit; font-size: 13.5px; font-weight: 600; color: var(--muted); white-space: nowrap; }
    .tab:hover { color: var(--ink); }
    .tab[aria-selected="true"] { background: var(--surface); color: var(--ink); box-shadow: 0 1px 2px rgba(15, 23, 42, .1); }
    .tab small { margin-left: 6px; padding: 1px 6px; border-radius: 999px; background: var(--rule); font-size: 11px; font-variant-numeric: tabular-nums; }
    .tabpanel { padding: 10px 0 6px; }
    .tabpanel[hidden] { display: none; }

    .rows { list-style: none; }
    .rows > li + li { border-top: 1px solid var(--rule); }
    .stage { display: grid; grid-template-columns: 30px 1fr auto 16px; align-items: center; gap: 14px; width: 100%; padding: 13px 22px; border: 0; background: none; text-align: left; font: inherit; color: inherit; cursor: pointer; }
    .stage:hover { background: var(--soft); }
    .stage .no { width: 28px; height: 28px; border-radius: 8px; background: var(--soft); border: 1px solid var(--rule); display: grid; place-items: center; font-size: 12.5px; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
    .stage .name { color: var(--ink); font-size: 14.5px; font-weight: 600; }
    .stage .count { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .stage .count b { color: var(--ink); font-weight: 600; }
    .stage .chev { width: 16px; height: 16px; color: var(--muted); transition: transform .2s; }
    .stage[aria-expanded="true"] .no { background: var(--mark); border-color: var(--mark); color: var(--surface); }
    .stage[aria-expanded="true"] .chev { transform: rotate(180deg); }
    .stage-text { padding: 0 54px 14px 66px; font-size: 14px; color: var(--body); }
    .stage-text[hidden] { display: none; }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 22px; }
    .row .main { min-width: 0; }
    .row .title { color: var(--ink); font-size: 14.5px; font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .row .sub { margin-top: 3px; display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--muted); }
    .row .sub i { width: 7px; height: 7px; border-radius: 50%; }
    .days { flex-shrink: 0; padding: 4px 10px; border-radius: 999px; background: var(--soft); border: 1px solid var(--rule); font-size: 12.5px; font-weight: 600; color: var(--ink); font-variant-numeric: tabular-nums; }
    .days.soon { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
    @media (prefers-color-scheme: dark) { .days.soon { background: rgba(248, 113, 113, .12); border-color: rgba(248, 113, 113, .3); color: #fca5a5; } }
    .none { padding: 26px 22px; font-size: 14px; color: var(--muted); }

    footer { border-top: 1px solid var(--rule); background: var(--surface); }
    footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding-top: 18px; padding-bottom: 18px; font-size: 12.5px; color: var(--muted); }

    button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    @media (max-width: 640px) {
        .wrap { padding: 0 16px; }
        .hero { padding: 36px 0 96px; }
        .hero .lead { font-size: 16px; }
        .hero .actions .btn { flex: 1 1 auto; justify-content: center; }
        .tabs { margin: 0 16px; }
        .tab { font-size: 12.5px; }
        .tab small { display: none; }
        .card-head, .figures div, .stage, .row { padding-left: 16px; padding-right: 16px; }
        .stage-text { padding: 0 16px 14px 60px; }
    }
    @media (prefers-reduced-motion: reduce) { .ring .fg { animation: none; } }
</style>
</head>
<body>
    <header class="top">
        <div class="wrap">
            <div class="brand">
                @if ($logo)<img src="{{ $logo }}" alt="">@endif
                <div>
                    <strong>{{ $orgName }}</strong>
                    <span>{{ $systemName }} · Research &amp; Technology Transfer</span>
                </div>
            </div>
        </div>
    </header>

    <section class="hero" aria-labelledby="title">
        <div class="wrap">
            <div>
                <span class="chip"><i></i>Scheduled maintenance</span>
                <h1 id="title">We'll be back shortly</h1>
                <p class="lead">
                    {{ $systemName }} is offline while we carry out planned work. Your proposals, reviews and every
                    other record are stored safely and will be exactly as you left them.
                </p>
                <div class="actions">
                    <button type="button" class="btn btn-light" onclick="location.reload()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
                        Check again
                    </button>
                    @if ($telegram)
                        <a class="btn btn-ghost" href="{{ $telegram }}" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.04 15.47 8.9 19.4c.41 0 .59-.18.8-.39l1.93-1.85 4 2.93c.73.4 1.25.19 1.45-.68l2.63-12.33c.24-1.08-.39-1.5-1.1-1.24L3.2 10.04c-1.05.41-1.04 1-.18 1.27l3.94 1.23 9.14-5.77c.43-.28.82-.12.5.16"/></svg>
                            Telegram updates
                        </a>
                    @endif
                    @if ($facebook)
                        <a class="btn btn-ghost" href="{{ $facebook }}" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.6c0-.87.25-1.46 1.5-1.46H16.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.9v3h2.5V21h3.1Z"/></svg>
                            Facebook
                        </a>
                    @endif
                </div>
                <div class="meta" aria-live="polite">
                    <div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                        <span>Started <b>{{ $since->format('H:i') }}</b> · {{ $since->format('D j M Y') }}</span>
                    </div>
                    <div>
                        <svg class="ring" viewBox="0 0 20 20" aria-hidden="true"><circle class="bg" cx="10" cy="10" r="8"/><circle class="fg" cx="10" cy="10" r="8"/></svg>
                        <span>Checking again in <b><span id="countdown">60</span>s</b></span>
                    </div>
                </div>
            </div>

            <div class="status" role="region" aria-label="Service status">
                <h2>Service status</h2>
                <ul>
                    @foreach ($services as $service)
                        <li><span>{{ $service }}</span><span class="pill pill-paused"><i></i>Paused</span></li>
                    @endforeach
                    <li><span>Your data</span><span class="pill pill-safe"><i></i>Safe</span></li>
                </ul>
            </div>
        </div>
    </section>

    <main>
        <div class="wrap cards">
            @if ($info)
                <section class="card" aria-labelledby="figures-title">
                    <div class="card-head">
                        <h3 id="figures-title">Research at {{ $orgName }}</h3>
                        <p>@if ($info['academic_year']){{ $info['academic_year'] }} academic year · @endif as of {{ $since->format('H:i') }}</p>
                    </div>
                    <div class="figures">
                        <div><b>{{ number_format($info['stats']['submitted']) }}</b><span>Proposals this year</span></div>
                        <div><b>{{ number_format($info['stats']['in_review']) }}</b><span>In review now</span></div>
                        <div><b>{{ number_format($info['stats']['funded']) }}</b><span>Projects funded</span></div>
                        <div><b>{{ number_format($info['stats']['colleges']) }}</b><span>Colleges taking part</span></div>
                    </div>
                </section>

                <section class="card" aria-labelledby="journey-title">
                    <div class="card-head">
                        <h3 id="journey-title">How proposals move</h3>
                        <p>From submission to a completed project, and what is open right now.</p>
                    </div>
                    <div class="tabs" role="tablist" aria-label="Proposal information">
                        <button class="tab" role="tab" id="tab-journey" aria-controls="panel-journey" aria-selected="true">Proposal journey</button>
                        <button class="tab" role="tab" id="tab-calls" aria-controls="panel-calls" aria-selected="false" tabindex="-1">Open calls<small>{{ count($info['open_calls']) }}</small></button>
                        <button class="tab" role="tab" id="tab-funded" aria-controls="panel-funded" aria-selected="false" tabindex="-1">Recently funded</button>
                    </div>

                    <div class="tabpanel" role="tabpanel" id="panel-journey" aria-labelledby="tab-journey">
                        <ol class="rows">
                            @foreach ($info['journey'] as $i => $step)
                                <li>
                                    <button class="stage" type="button" aria-expanded="{{ $i === 0 ? 'true' : 'false' }}" aria-controls="stage-{{ $i }}">
                                        <span class="no">{{ $i + 1 }}</span>
                                        <span class="name">{{ $step['label'] }}</span>
                                        <span class="count"><b>{{ $step['count'] }}</b> now</span>
                                        <svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                                    </button>
                                    <p class="stage-text" id="stage-{{ $i }}" @if ($i !== 0) hidden @endif>{{ $step['text'] }}</p>
                                </li>
                            @endforeach
                        </ol>
                    </div>

                    <div class="tabpanel" role="tabpanel" id="panel-calls" aria-labelledby="tab-calls" hidden>
                        @if (count($info['open_calls']))
                            <ul class="rows">
                                @foreach ($info['open_calls'] as $call)
                                    <li class="row">
                                        <div class="main">
                                            <div class="title">{{ $call['title'] }}</div>
                                            <div class="sub"><i style="background: {{ $safeColor($call['color']) }}"></i>{{ $call['programme'] }} · closes {{ $call['ends'] }}</div>
                                        </div>
                                        <span class="days {{ $call['days_left'] <= 7 ? 'soon' : '' }}">{{ $call['days_left'] }} {{ $call['days_left'] === 1 ? 'day' : 'days' }} left</span>
                                    </li>
                                @endforeach
                            </ul>
                        @else
                            <p class="none">No calls are open at the moment. New calls are announced on our channels.</p>
                        @endif
                    </div>

                    <div class="tabpanel" role="tabpanel" id="panel-funded" aria-labelledby="tab-funded" hidden>
                        @if (count($funded))
                            <ul class="rows">
                                @foreach ($funded as $project)
                                    <li class="row">
                                        <div class="main">
                                            <div class="title">{{ $project['title'] }}</div>
                                            <div class="sub"><i style="background: {{ $safeColor($project['color']) }}"></i>{{ collect([$project['programme'], $project['college'], $project['year']])->filter()->implode(' · ') }}</div>
                                        </div>
                                    </li>
                                @endforeach
                            </ul>
                        @else
                            <p class="none">Funded projects will be listed here.</p>
                        @endif
                    </div>
                </section>
            @endif
        </div>
    </main>

    <footer>
        <div class="wrap">
            <span>© {{ $since->year }} {{ $orgName }}</span>
            <span>{{ $systemName }} · Research &amp; Technology Transfer</span>
        </div>
    </footer>

    <script>
        (function () {
            var left = 60, countdown = document.getElementById('countdown');
            setInterval(function () {
                left -= 1;
                if (left <= 0) { location.reload(); return; }
                countdown.textContent = left;
            }, 1000);

            var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
            function select(tab) {
                tabs.forEach(function (t) {
                    var on = t === tab;
                    t.setAttribute('aria-selected', on ? 'true' : 'false');
                    t.tabIndex = on ? 0 : -1;
                    document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
                });
            }
            tabs.forEach(function (tab, i) {
                tab.addEventListener('click', function () { select(tab); });
                tab.addEventListener('keydown', function (e) {
                    var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
                    if (!d) return;
                    var next = tabs[(i + d + tabs.length) % tabs.length];
                    next.focus(); select(next);
                });
            });

            document.querySelectorAll('.stage').forEach(function (stage) {
                stage.addEventListener('click', function () {
                    var open = stage.getAttribute('aria-expanded') === 'true';
                    stage.setAttribute('aria-expanded', open ? 'false' : 'true');
                    document.getElementById(stage.getAttribute('aria-controls')).hidden = open;
                });
            });
        })();
    </script>
</body>
</html>
