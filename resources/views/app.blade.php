<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    @php
        $meta = \Illuminate\Support\Facades\Cache::remember('blade_app_meta', 300, function () {
            $rows = \App\Models\AppSetting::whereIn('key', ['system_name', 'favicon', 'custom_css', 'theme', 'organization_name', 'system_logo', 'public_hero_subtitle'])
                ->get()->keyBy('key');
            $org = $rows->get('organization_name')?->value ?: 'Wolaita Sodo University';
            return [
                'organization_name' => $org,
                'system_logo' => $rows->get('system_logo')?->value,
                'description' => $rows->get('public_hero_subtitle')?->value
                    ?: "Submit research, community engagement and technology transfer proposals to {$org}, follow blind review and open defence, and manage funded projects in one place.",
                'system_name' => $rows->get('system_name')?->value ?? 'RTT Platform',
                'favicon'     => $rows->get('favicon')?->value,
                'custom_css'  => $rows->get('custom_css')?->value,
                'theme'       => in_array($rows->get('theme')?->value, ['light', 'dark', 'system'], true) ? $rows->get('theme')->value : 'light',
            ];
        });
    @endphp

    {{-- Theme (Settings → Appearance): applied before anything is drawn, so there is no light flash. --}}
    <script>
        (function () {
            // The person's own choice (kept on the device, saved on their account) wins;
            // otherwise the organisation's theme from Settings → Appearance.
            var theme = @json($meta['theme']);
            document.documentElement.dataset.orgTheme = theme;
            try {
                var own = localStorage.getItem('rtt_theme');
                if (own === 'light' || own === 'dark' || own === 'system') theme = own;
            } catch (e) {}
            var root = document.documentElement;
            function apply() {
                var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                root.classList.toggle('dark', dark);
            }
            apply();
            if (theme === 'system' && window.matchMedia) {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
            }
        })();
    </script>

    <meta name="app-name" content="{{ $meta['system_name'] }}">
    {{-- A page with its own subject (a repository record) names it in the title and description. --}}
    @php
        $pageMeta = $pageMeta ?? null;
    @endphp
    <title inertia>{{ $pageMeta ? $pageMeta['title'].' · '.$meta['organization_name'] : $meta['system_name'].' · '.$meta['organization_name'].' Research & Technology Transfer' }}</title>

    {{-- Search results and link previews (Telegram, Facebook, WhatsApp read these; they don't run JavaScript). --}}
    @php
        $pageUrl = url()->current();
        $shareTitle = $pageMeta['title'] ?? $meta['system_name'].' · '.$meta['organization_name'].' Research & Technology Transfer';
        $shareDescription = $pageMeta['description'] ?? $meta['description'];
        $shareImage = $meta['system_logo'] ? url($meta['system_logo']) : null;
    @endphp
    <meta name="description" content="{{ $shareDescription }}">
    <link rel="canonical" href="{{ $pageUrl }}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="{{ $meta['system_name'] }}">
    <meta property="og:title" content="{{ $shareTitle }}">
    <meta property="og:description" content="{{ $shareDescription }}">
    <meta property="og:url" content="{{ $pageUrl }}">
    @if ($shareImage)<meta property="og:image" content="{{ $shareImage }}">@endif
    <meta name="twitter:card" content="summary">
    <meta name="twitter:title" content="{{ $shareTitle }}">
    <meta name="twitter:description" content="{{ $shareDescription }}">
    @if ($shareImage)<meta name="twitter:image" content="{{ $shareImage }}">@endif
    @if ($pageMeta)
        @foreach ($pageMeta['tags'] ?? [] as $name => $content)
            <meta name="{{ $name }}" content="{{ $content }}">
        @endforeach
        @if (! empty($pageMeta['jsonLd']))
            <script type="application/ld+json">{!! json_encode(array_filter($pageMeta['jsonLd']), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG) !!}</script>
        @endif
    @endif

    @if($meta['favicon'])
        <link rel="icon" href="{{ $meta['favicon'] }}">
    @endif

    {{-- Installable on phones (Add to Home Screen) --}}
    <link rel="manifest" href="/manifest.webmanifest">
    <meta name="theme-color" content="#1e3a8a">
    <link rel="apple-touch-icon" href="/pwa-icon/192.png">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-title" content="{{ $meta['system_name'] }}">

    @viteReactRefresh
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
    @inertiaHead

    @if($meta['custom_css'])
        <style>{!! $meta['custom_css'] !!}</style>
    @endif
</head>
<body class="h-full bg-gray-50 font-sans antialiased">
    @inertia
</body>
</html>
