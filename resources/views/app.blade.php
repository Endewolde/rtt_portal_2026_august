<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="h-full">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">

    @php
        $meta = \Illuminate\Support\Facades\Cache::remember('blade_app_meta', 300, function () {
            $rows = \App\Models\AppSetting::whereIn('key', ['system_name', 'favicon', 'custom_css'])
                ->get()->keyBy('key');
            return [
                'system_name' => $rows['system_name']?->value ?? 'RTT Platform',
                'favicon'     => $rows['favicon']?->value ?? null,
                'custom_css'  => $rows['custom_css']?->value ?? null,
            ];
        });
    @endphp

    <meta name="app-name" content="{{ $meta['system_name'] }}">
    <title inertia>{{ $meta['system_name'] }}</title>

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
