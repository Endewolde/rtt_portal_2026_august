<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ __('What is waiting on you today') }}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#312e81,#4f46e5);padding:30px 32px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:13px;}
  .big{font-size:40px;font-weight:800;color:#fff;margin:0;line-height:1;}
  .body{padding:28px 32px;}
  .row{display:block;text-decoration:none;padding:12px 16px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:8px;color:#111827;}
  .count{display:inline-block;min-width:34px;text-align:center;padding:3px 8px;border-radius:999px;background:#eef2ff;color:#4338ca;font-weight:700;font-size:13px;margin-right:10px;}
  .label{font-size:14px;}
  .go{float:right;color:#4f46e5;font-size:13px;font-weight:600;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
@php
  $s = \App\Models\AppSetting::whereIn('key', ['organization_name', 'system_name'])->pluck('value', 'key');
  $platformName = $s->get('system_name', 'RTT Platform');
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero">
    <p>{{ __('Good morning, :name', ['name' => $user->name]) }}</p>
    <p class="big" style="margin-top:10px;">{{ $total }}</p>
    <h1>{{ trans_choice('item waiting on you today|items waiting on you today', $total) }}</h1>
  </div>
  <div class="body">
    @foreach ($items as $item)
      <a class="row" href="{{ $item['url'] }}">
        <span class="count">{{ $item['count'] }}</span>
        <span class="label">{{ __($item['label']) }}</span>
        <span class="go">{{ __('Open') }} &rarr;</span>
      </a>
    @endforeach
    <p style="font-size:12px;color:#9ca3af;margin:18px 0 0;">{{ __('You get this each morning when something is waiting on you. Turn off email notifications in your profile to stop it.') }}</p>
  </div>
  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $platformName }}</strong></div>
</div>
</body>
</html>
