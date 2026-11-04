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
    $accent = preg_match('/^#[0-9a-f]{6}$/i', $s['primary_color'] ?? '') ? $s['primary_color'] : '#1d4ed8';
    $telegram = $s['public_social_telegram'] ?? null;
    $facebook = $s['public_social_facebook'] ?? null;
    $since = now();
    $safeColor = fn ($c) => preg_match('/^#[0-9a-f]{6}$/i', (string) $c) ? $c : '#64748b';
    $funded = array_slice($info['recently_funded'] ?? [], 0, 5);
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Scheduled maintenance · {{ $systemName }}</title>
@if ($logo)<link rel="icon" href="{{ $logo }}">@endif
<style>
    :root {
        --brand: {{ $brand }};
        --accent: {{ $accent }};
        --page: #f5f6f8;
        --surface: #ffffff;
        --ink: #14171c;
        --body: #3f4650;
        --muted: #6b7380;
        --rule: #e3e6ea;
        --soft: #f0f2f5;
        --amber: #b45309;
        --amber-dot: #f59e0b;
        --mark: var(--brand);
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --page: #0f1216;
            --surface: #161a20;
            --ink: #eef1f4;
            --body: #c4cad2;
            --muted: #8a929d;
            --rule: #262c34;
            --soft: #1c2129;
            --amber: #fbbf24;
            /* The brand colour is usually a dark navy; lift it so it reads on a dark page. */
            --mark: color-mix(in srgb, var(--accent) 55%, #ffffff);
        }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
        min-height: 100vh; display: flex; flex-direction: column;
        background: var(--page); color: var(--body);
        font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans Ethiopic", sans-serif;
        -webkit-font-smoothing: antialiased;
    }
    a { color: inherit; }
    .wrap { width: 100%; max-width: 1120px; margin: 0 auto; padding: 0 24px; }

    /* Masthead */
    .bar { height: 4px; background: var(--brand); }
    .masthead { background: var(--surface); border-bottom: 1px solid var(--rule); }
    .masthead .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 68px; }
    .identity { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .identity img { width: 38px; height: 38px; object-fit: contain; }
    .identity strong { display: block; color: var(--ink); font-size: 15px; line-height: 1.25; }
    .identity span { display: block; color: var(--muted); font-size: 12.5px; }
    .status { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; font-size: 13px; font-weight: 600; color: var(--amber); }
    .status i { width: 8px; height: 8px; border-radius: 50%; background: var(--amber-dot); }

    /* Layout */
    main { flex: 1; padding: 56px 0 64px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 48px; }
    @media (min-width: 960px) { .grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 64px; align-items: start; } }

    /* Notice */
    .label { font-size: 12px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
    h1 {
        margin-top: 14px; color: var(--ink);
        font: 600 clamp(30px, 4.2vw, 42px)/1.15 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif Ethiopic", serif;
        letter-spacing: -.01em;
    }
    .lead { margin-top: 16px; max-width: 34em; font-size: 16.5px; }
    .facts { margin-top: 32px; border-top: 1px solid var(--rule); }
    .facts div { display: grid; grid-template-columns: 9.5em 1fr; gap: 16px; padding: 13px 0; border-bottom: 1px solid var(--rule); }
    .facts dt { color: var(--muted); font-size: 13.5px; }
    .facts dd { color: var(--ink); font-size: 14.5px; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 22px; margin-top: 32px; }
    .button {
        display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; border-radius: 8px; border: 0;
        background: var(--brand); color: #fff; font: inherit; font-size: 14.5px; font-weight: 600; cursor: pointer;
    }
    .button:hover { filter: brightness(1.12); }
    @media (prefers-color-scheme: dark) { .button { background: var(--mark); color: #0f1216; } }
    .link { display: inline-flex; align-items: center; gap: 7px; font-size: 14.5px; font-weight: 600; color: var(--ink); text-decoration: none; border-bottom: 1px solid var(--rule); padding-bottom: 1px; }
    .link:hover { border-color: currentColor; }
    .button svg, .link svg { width: 16px; height: 16px; flex-shrink: 0; }
    .recheck { margin-top: 26px; max-width: 22em; font-size: 13px; color: var(--muted); }
    .recheck .track { margin-top: 8px; height: 3px; border-radius: 3px; background: var(--rule); overflow: hidden; }
    .recheck .track b { display: block; height: 100%; background: var(--muted); transform-origin: left; animation: drain 60s linear forwards; }
    @keyframes drain { to { transform: scaleX(0); } }

    /* Panel */
    .panel { background: var(--surface); border: 1px solid var(--rule); border-radius: 12px; }
    .panel-head { padding: 22px 24px 18px; border-bottom: 1px solid var(--rule); }
    .panel-head h2 { color: var(--ink); font-size: 16.5px; font-weight: 700; line-height: 1.35; }
    .panel-head p { margin-top: 3px; font-size: 13px; color: var(--muted); }
    .figures { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-bottom: 1px solid var(--rule); }
    .figures div { padding: 18px 20px; border-left: 1px solid var(--rule); }
    .figures div:first-child { border-left: 0; }
    .figures b { display: block; color: var(--ink); font-size: 28px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -.01em; }
    .figures span { display: block; margin-top: 8px; font-size: 12.5px; line-height: 1.35; color: var(--muted); }

    .tabs { display: flex; gap: 24px; padding: 0 24px; border-bottom: 1px solid var(--rule); overflow-x: auto; }
    .tab {
        position: relative; padding: 14px 0 13px; border: 0; background: none; cursor: pointer; white-space: nowrap;
        font: inherit; font-size: 14px; font-weight: 600; color: var(--muted);
    }
    .tab small { margin-left: 4px; font-weight: 500; font-variant-numeric: tabular-nums; }
    .tab:hover { color: var(--ink); }
    .tab[aria-selected="true"] { color: var(--ink); }
    .tab[aria-selected="true"]::after { content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--mark); }
    .tabpanel[hidden] { display: none; }

    .rows { list-style: none; }
    .rows > li { border-bottom: 1px solid var(--rule); }
    .rows > li:last-child { border-bottom: 0; }

    .stage { display: grid; grid-template-columns: 28px 1fr auto; align-items: center; gap: 14px; width: 100%; padding: 14px 24px; border: 0; background: none; text-align: left; font: inherit; color: inherit; cursor: pointer; }
    .stage:hover { background: var(--soft); }
    .stage .no { width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--rule); display: grid; place-items: center; font-size: 12.5px; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
    .stage .name { color: var(--ink); font-size: 14.5px; font-weight: 600; }
    .stage .count { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .stage .count b { color: var(--ink); font-size: 15px; }
    .stage[aria-expanded="true"] .no { border-color: var(--mark); background: var(--mark); color: var(--surface); }
    .stage-text { padding: 0 24px 16px 66px; font-size: 14px; color: var(--body); }
    .stage-text[hidden] { display: none; }

    .row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 24px; }
    .row .main { min-width: 0; }
    .row .title { color: var(--ink); font-size: 14.5px; font-weight: 600; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .row .meta { margin-top: 3px; display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--muted); }
    .row .meta i { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
    .row .days { flex-shrink: 0; text-align: right; font-size: 12.5px; color: var(--muted); }
    .row .days b { display: block; color: var(--ink); font-size: 18px; font-variant-numeric: tabular-nums; line-height: 1.1; }
    .row .days.soon b { color: #b91c1c; }
    .none { padding: 28px 24px; font-size: 14px; color: var(--muted); }

    footer { border-top: 1px solid var(--rule); background: var(--surface); }
    footer .wrap { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 8px; padding-top: 18px; padding-bottom: 18px; font-size: 12.5px; color: var(--muted); }

    button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }

    @media (max-width: 640px) {
        main { padding: 36px 0 48px; }
        .wrap { padding: 0 16px; }
        .status span { display: none; }
        .facts div { grid-template-columns: 1fr; gap: 2px; }
        .figures { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .figures div:nth-child(3) { border-left: 0; }
        .figures div:nth-child(n+3) { border-top: 1px solid var(--rule); }
        .panel-head, .tabs, .stage, .row { padding-left: 18px; padding-right: 18px; }
        .tabs { gap: 16px; }
        .tab { font-size: 13.5px; }
        .tab small { display: none; }
        .stage-text { padding-left: 60px; padding-right: 18px; }
    }
    @media (prefers-reduced-motion: reduce) { .recheck .track b { animation: none; } }
</style>
</head>
<body>
    <div class="bar"></div>
    <header class="masthead">
        <div class="wrap">
            <div class="identity">
                @if ($logo)<img src="{{ $logo }}" alt="">@endif
                <div>
                    <strong>{{ $orgName }}</strong>
                    <span>{{ $systemName }} · Research &amp; Technology Transfer</span>
                </div>
            </div>
            <div class="status" title="Scheduled maintenance"><i></i><span>Scheduled maintenance</span></div>
        </div>
    </header>

    <main>
        <div class="wrap grid">
            <section aria-labelledby="title">
                <p class="label">Service notice</p>
                <h1 id="title">{{ $systemName }} is offline for scheduled maintenance</h1>
                <p class="lead">
                    We are carrying out planned work on the platform. Proposals, reviews and every other record
                    are stored safely and will be exactly as you left them when the service returns.
                </p>

                <dl class="facts">
                    <div><dt>Started</dt><dd>{{ $since->format('H:i') }}, {{ $since->format('l j F Y') }}</dd></div>
                    <div><dt>Your work</dt><dd>Saved — nothing has been lost</dd></div>
                    <div><dt>Expected back</dt><dd>Shortly; most maintenance takes a few minutes</dd></div>
                </dl>

                <div class="actions">
                    <button type="button" class="button" onclick="location.reload()">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>
                        Check again
                    </button>
                    @if ($telegram)
                        <a class="link" href="{{ $telegram }}" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.04 15.47 8.9 19.4c.41 0 .59-.18.8-.39l1.93-1.85 4 2.93c.73.4 1.25.19 1.45-.68l2.63-12.33c.24-1.08-.39-1.5-1.1-1.24L3.2 10.04c-1.05.41-1.04 1-.18 1.27l3.94 1.23 9.14-5.77c.43-.28.82-.12.5.16"/></svg>
                            Updates on Telegram
                        </a>
                    @endif
                    @if ($facebook)
                        <a class="link" href="{{ $facebook }}" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.6c0-.87.25-1.46 1.5-1.46H16.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.9v3h2.5V21h3.1Z"/></svg>
                            Facebook
                        </a>
                    @endif
                </div>

                <div class="recheck" aria-live="polite">
                    This page checks again on its own in <span id="countdown">60</span> seconds.
                    <div class="track" aria-hidden="true"><b></b></div>
                </div>
            </section>

            @if ($info)
                <section class="panel" aria-labelledby="panel-title">
                    <div class="panel-head">
                        <h2 id="panel-title">Research and innovation at {{ $orgName }}</h2>
                        <p>@if ($info['academic_year']){{ $info['academic_year'] }} academic year · @endif figures as of {{ $since->format('H:i') }} today</p>
                    </div>

                    <div class="figures">
                        <div><b>{{ number_format($info['stats']['submitted']) }}</b><span>Proposals this year</span></div>
                        <div><b>{{ number_format($info['stats']['in_review']) }}</b><span>In review now</span></div>
                        <div><b>{{ number_format($info['stats']['funded']) }}</b><span>Projects funded</span></div>
                        <div><b>{{ number_format($info['stats']['colleges']) }}</b><span>Colleges taking part</span></div>
                    </div>

                    <div class="tabs" role="tablist" aria-label="Proposal information">
                        <button class="tab" role="tab" id="tab-journey" aria-controls="panel-journey" aria-selected="true">Proposal journey</button>
                        <button class="tab" role="tab" id="tab-calls" aria-controls="panel-calls" aria-selected="false" tabindex="-1">Open calls <small>{{ count($info['open_calls']) }}</small></button>
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
                                            <div class="meta"><i style="background: {{ $safeColor($call['color']) }}"></i>{{ $call['programme'] }} · closes {{ $call['ends'] }}</div>
                                        </div>
                                        <div class="days {{ $call['days_left'] <= 7 ? 'soon' : '' }}"><b>{{ $call['days_left'] }}</b>{{ $call['days_left'] === 1 ? 'day left' : 'days left' }}</div>
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
                                            <div class="meta"><i style="background: {{ $safeColor($project['color']) }}"></i>{{ collect([$project['programme'], $project['college'], $project['year']])->filter()->implode(' · ') }}</div>
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
