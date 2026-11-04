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

    // Small line icons (Lucide paths), drawn inline so the page needs nothing else.
    $icon = fn (string $paths) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'.$paths.'</svg>';
    $services = [
        ['Proposal submission', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="m9 15 3-3 3 3"/>'],
        ['Reviews & scoring', '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'],
        ['Funding & finance', '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>'],
        ['Reports & dashboards', '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>'],
    ];
    $figures = $info ? [
        ['Proposals this year', $info['stats']['submitted'], '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/>'],
        ['In review now', $info['stats']['in_review'], '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'],
        ['Projects funded', $info['stats']['funded'], '<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>'],
        ['Colleges taking part', $info['stats']['colleges'], '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/>'],
    ] : [];
    $telegramIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.04 15.47 8.9 19.4c.41 0 .59-.18.8-.39l1.93-1.85 4 2.93c.73.4 1.25.19 1.45-.68l2.63-12.33c.24-1.08-.39-1.5-1.1-1.24L3.2 10.04c-1.05.41-1.04 1-.18 1.27l3.94 1.23 9.14-5.77c.43-.28.82-.12.5.16"/></svg>';
    $facebookIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.6c0-.87.25-1.46 1.5-1.46H16.6V4.46A21 21 0 0 0 14.27 4.3c-2.3 0-3.87 1.4-3.87 3.98v2.22H7.9v3h2.5V21h3.1Z"/></svg>';
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
    :root {
        --brand: {{ $brand }};
        --accent: {{ $accent }};
        --page: #f3f5f8;
        --surface: #ffffff;
        --ink: #0f172a;
        --body: #475569;
        --muted: #64748b;
        --rule: #e5e9f0;
        --soft: #f6f8fb;
        --tint: color-mix(in srgb, var(--brand) 8%, #ffffff);
        --tint-ink: var(--brand);
        --shadow: 0 1px 2px rgba(15, 23, 42, .05), 0 12px 32px -16px rgba(15, 23, 42, .18);
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --page: #0a0e14;
            --surface: #111720;
            --ink: #e8edf3;
            --body: #b6c0cc;
            --muted: #8592a3;
            --rule: #212a36;
            --soft: #161e29;
            --tint: color-mix(in srgb, var(--accent) 16%, #111720);
            --tint-ink: color-mix(in srgb, var(--accent) 55%, #ffffff);
            --shadow: 0 1px 2px rgba(0, 0, 0, .5);
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
    .top .wrap { display: flex; align-items: center; justify-content: space-between; gap: 16px; height: 70px; }
    .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .brand img { width: 40px; height: 40px; object-fit: contain; }
    .brand strong { display: block; color: var(--ink); font-size: 15px; font-weight: 700; line-height: 1.25; letter-spacing: -.01em; }
    .brand span { display: block; color: var(--muted); font-size: 12.5px; }
    .flag { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 12px; border-radius: 999px; border: 1px solid #fde68a; background: #fffbeb; color: #92400e; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
    .flag i { width: 7px; height: 7px; border-radius: 50%; background: #f59e0b; }
    @media (prefers-color-scheme: dark) { .flag { border-color: rgba(251, 191, 36, .3); background: rgba(251, 191, 36, .1); color: #fcd34d; } }

    /* Buttons */
    .btn {
        display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 18px; border-radius: 10px;
        font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; text-decoration: none; white-space: nowrap;
        border: 1px solid transparent; transition: background .15s, border-color .15s, transform .15s;
    }
    .btn svg { width: 16px; height: 16px; }
    .btn:active { transform: translateY(1px); }
    .btn-light { background: #fff; color: #0f172a; box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 6px 16px -8px rgba(0,0,0,.4); }
    .btn-light:hover { background: #f1f5f9; }
    .btn-ghost { color: #fff; background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.2); }
    .btn-ghost:hover { background: rgba(255,255,255,.12); border-color: rgba(255,255,255,.32); }

    /* Hero — the brand colour with a faint dot grid */
    .hero {
        position: relative; color: #fff; padding: 64px 0 120px;
        background-color: var(--brand);
        background-image: radial-gradient(rgba(255,255,255,.09) 1px, transparent 1px);
        background-size: 22px 22px;
    }
    .hero::after { content: ""; position: absolute; inset: auto 0 0 0; height: 1px; background: rgba(255,255,255,.08); }
    .hero .wrap { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 44px; }
    @media (min-width: 980px) { .hero .wrap { grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 72px; align-items: center; } }
    .chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 10px; border-radius: 999px; background: rgba(251, 191, 36, .14); border: 1px solid rgba(251, 191, 36, .28); color: #fde68a; font-size: 12.5px; font-weight: 600; }
    .chip i { width: 7px; height: 7px; border-radius: 50%; background: #fbbf24; box-shadow: 0 0 0 3px rgba(251, 191, 36, .22); }
    .hero h1 { margin-top: 20px; font-size: clamp(34px, 4.6vw, 52px); font-weight: 800; line-height: 1.05; letter-spacing: -.03em; }
    .hero .lead { margin-top: 18px; max-width: 34em; font-size: 17px; line-height: 1.65; color: rgba(255,255,255,.8); }
    .hero .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 30px; }
    .meta { display: flex; flex-wrap: wrap; gap: 12px 28px; margin-top: 32px; padding-top: 22px; border-top: 1px solid rgba(255,255,255,.14); font-size: 13.5px; color: rgba(255,255,255,.72); }
    .meta div { display: flex; align-items: center; gap: 9px; }
    .meta svg { width: 16px; height: 16px; color: rgba(255,255,255,.6); }
    .meta b { color: #fff; font-weight: 600; }
    .ring { transform: rotate(-90deg); }
    .ring circle { fill: none; stroke-width: 3; }
    .ring .bg { stroke: rgba(255,255,255,.2); }
    .ring .fg { stroke: #fff; stroke-dasharray: 50.27; stroke-dashoffset: 0; animation: ring 60s linear forwards; }
    @keyframes ring { to { stroke-dashoffset: 50.27; } }

    /* Service status board */
    .board { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.15); border-radius: 16px; overflow: hidden; backdrop-filter: none; }
    .board-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,.12); }
    .board-head h2 { font-size: 14px; font-weight: 600; color: #fff; }
    .board-head span { font-size: 12px; color: rgba(255,255,255,.6); }
    .board ul { list-style: none; }
    .board li { display: flex; align-items: center; gap: 12px; padding: 13px 20px; font-size: 14.5px; }
    .board li + li { border-top: 1px solid rgba(255,255,255,.09); }
    .board li .ic { width: 30px; height: 30px; border-radius: 8px; display: grid; place-items: center; background: rgba(255,255,255,.08); color: rgba(255,255,255,.85); }
    .board li .ic svg { width: 15px; height: 15px; }
    .board li .name { flex: 1; min-width: 0; }
    .pill { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .pill-paused { background: rgba(251, 191, 36, .15); color: #fde68a; }
    .pill-safe { background: rgba(74, 222, 128, .15); color: #bbf7d0; }
    .pill i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

    /* Figures card */
    main { flex: 1; margin-top: -76px; padding-bottom: 64px; }
    .card { position: relative; background: var(--surface); border: 1px solid var(--rule); border-radius: 16px; box-shadow: var(--shadow); overflow: hidden; }
    .card-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; padding: 20px 24px; border-bottom: 1px solid var(--rule); }
    .card-head h3 { color: var(--ink); font-size: 16px; font-weight: 700; letter-spacing: -.01em; }
    .card-head p { margin-top: 2px; font-size: 13px; color: var(--muted); }
    .year { display: inline-flex; align-items: center; height: 28px; padding: 0 11px; border-radius: 999px; background: var(--tint); color: var(--tint-ink); font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .figures { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .figures div { padding: 24px; }
    .figures div:nth-child(even) { border-left: 1px solid var(--rule); }
    .figures div:nth-child(n+3) { border-top: 1px solid var(--rule); }
    @media (min-width: 760px) {
        .figures { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .figures div + div { border-left: 1px solid var(--rule); }
        .figures div:nth-child(n+3) { border-top: 0; }
    }
    .figures .ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; background: var(--tint); color: var(--tint-ink); }
    .figures .ic svg { width: 18px; height: 18px; }
    .figures b { display: block; margin-top: 16px; color: var(--ink); font-size: 38px; font-weight: 800; line-height: 1; letter-spacing: -.035em; font-variant-numeric: tabular-nums; }
    .figures span { display: block; margin-top: 8px; font-size: 13.5px; color: var(--muted); }

    /* Footer */
    footer { border-top: 1px solid var(--rule); background: var(--surface); }
    footer .wrap { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-top: 20px; padding-bottom: 20px; font-size: 13px; color: var(--muted); }
    footer .who { display: flex; align-items: center; gap: 10px; }
    footer .who img { width: 22px; height: 22px; object-fit: contain; }
    footer nav { display: flex; gap: 18px; }
    footer nav a { display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: var(--muted); }
    footer nav a:hover { color: var(--ink); }
    footer nav svg { width: 14px; height: 14px; }

    button:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    @media (max-width: 640px) {
        .wrap { padding: 0 16px; }
        .flag span { display: none; }
        .flag { padding: 0 10px; }
        .hero { padding: 40px 0 100px; }
        .hero .lead { font-size: 16px; }
        .hero .actions .btn { flex: 1 1 auto; justify-content: center; }
        .card-head, .figures div { padding-left: 16px; padding-right: 16px; }
        .figures b { font-size: 32px; }
    }
    @media (prefers-reduced-motion: reduce) { .ring .fg { animation: none; } .btn { transition: none; } }
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
            <span class="flag" title="Under maintenance"><i></i><span>Under maintenance</span></span>
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
                        {!! $icon('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>') !!}
                        Check again
                    </button>
                    @if ($telegram)
                        <a class="btn btn-ghost" href="{{ $telegram }}" target="_blank" rel="noopener">{!! $telegramIcon !!} Telegram updates</a>
                    @endif
                    @if ($facebook)
                        <a class="btn btn-ghost" href="{{ $facebook }}" target="_blank" rel="noopener">{!! $facebookIcon !!} Facebook</a>
                    @endif
                </div>
                <div class="meta" aria-live="polite">
                    <div>
                        {!! $icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') !!}
                        <span>Started <b>{{ $since->format('H:i') }}</b> · {{ $since->format('D j M Y') }}</span>
                    </div>
                    <div>
                        <svg class="ring" viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><circle class="bg" cx="10" cy="10" r="8"/><circle class="fg" cx="10" cy="10" r="8"/></svg>
                        <span>Checking again in <b><span id="countdown">60</span>s</b></span>
                    </div>
                </div>
            </div>

            <div class="board" role="region" aria-label="Service status">
                <div class="board-head">
                    <h2>Service status</h2>
                    <span>Updated {{ $since->format('H:i') }}</span>
                </div>
                <ul>
                    @foreach ($services as [$service, $paths])
                        <li>
                            <span class="ic">{!! $icon($paths) !!}</span>
                            <span class="name">{{ $service }}</span>
                            <span class="pill pill-paused"><i></i>Paused</span>
                        </li>
                    @endforeach
                    <li>
                        <span class="ic">{!! $icon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>') !!}</span>
                        <span class="name">Your data</span>
                        <span class="pill pill-safe"><i></i>Safe</span>
                    </li>
                </ul>
            </div>
        </div>
    </section>

    <main>
        <div class="wrap">
            @if ($info)
                <section class="card" aria-labelledby="figures-title">
                    <div class="card-head">
                        <div>
                            <h3 id="figures-title">Research at {{ $orgName }}</h3>
                            <p>Figures as of {{ $since->format('H:i') }} today</p>
                        </div>
                        @if ($info['academic_year'])<span class="year">{{ $info['academic_year'] }} academic year</span>@endif
                    </div>
                    <div class="figures">
                        @foreach ($figures as [$label, $value, $paths])
                            <div>
                                <span class="ic">{!! $icon($paths) !!}</span>
                                <b>{{ number_format($value) }}</b>
                                <span>{{ $label }}</span>
                            </div>
                        @endforeach
                    </div>
                </section>
            @endif
        </div>
    </main>

    <footer>
        <div class="wrap">
            <div class="who">
                @if ($logo)<img src="{{ $logo }}" alt="">@endif
                <span>© {{ $since->year }} {{ $orgName }} · {{ $systemName }}</span>
            </div>
            @if ($telegram || $facebook)
                <nav aria-label="Follow us">
                    @if ($telegram)<a href="{{ $telegram }}" target="_blank" rel="noopener">{!! $telegramIcon !!} Telegram</a>@endif
                    @if ($facebook)<a href="{{ $facebook }}" target="_blank" rel="noopener">{!! $facebookIcon !!} Facebook</a>@endif
                </nav>
            @endif
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
        })();
    </script>
</body>
</html>
