<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ $title }}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
@php
  $s = \App\Models\AppSetting::whereIn('key', ['organization_name','system_name'])->pluck('value','key');
  $platformName = $s->get('system_name', 'RTT Platform');
@endphp
<div style="max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);">
  @include('emails.partials.logo_header')
  <div style="background:#0f172a;padding:30px 32px;">
    <p style="margin:0;color:#a5b4fc;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">{{ $frequency === 'weekly' ? 'Your weekly report' : 'Your monthly report' }}</p>
    <h1 style="margin:6px 0 4px;color:#fff;font-size:22px;">{{ $title }}</h1>
    <p style="margin:0;color:#94a3b8;font-size:13px;">{{ $scope }}</p>
  </div>
  <div style="padding:28px 32px;">
    <p style="font-size:15px;color:#374151;margin:0 0 14px;">Dear <strong>{{ $recipient->name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 22px;">
      Today’s figures are attached ({{ $rows }} row{{ $rows === 1 ? '' : 's' }}). Open the live report to filter it, click into the numbers or download it in another format.
    </p>
    <p style="margin:0 0 24px;"><a href="{{ $link }}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 20px;border-radius:10px;">Open live report</a></p>
    <p style="font-size:12px;color:#9ca3af;margin:0;">You receive this because you scheduled it in {{ $platformName }} → Reports. You can pause or stop it there at any time.</p>
  </div>
</div>
</body>
</html>
