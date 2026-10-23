<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ __('Complaint Response') }}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{padding:40px 32px;text-align:center;}
  .hero-resolved{background:linear-gradient(135deg,#065f46,#059669);}
  .hero-unresolved{background:linear-gradient(135deg,#7f1d1d,#dc2626);}
  .hero-default{background:linear-gradient(135deg,#334155,#475569);}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .tracker-row{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin:16px 0;}
  .tracker-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;}
  .tracker-val{font-size:14px;font-family:monospace;color:#374151;font-weight:700;}
  .response-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin:20px 0;}
  .response-from{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 10px;}
  .response-text{font-size:14px;color:#374151;line-height:1.75;margin:0;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
@php
  use App\Models\AppSetting;
  $s = AppSetting::whereIn('key', ['organization_name','system_name'])->pluck('value','key');
  $platformName = $s->get('system_name', 'RTT Platform');
  $orgName      = $s->get('organization_name', 'Research Office');

  $res = strtolower($resolution ?? '');
  $isResolved   = $res === 'resolved';
  $isUnresolved = $res === 'unresolved' || $res === 'rejected';
  $heroClass    = $isResolved ? 'hero-resolved' : ($isUnresolved ? 'hero-unresolved' : 'hero-default');
  $heroBg       = $isResolved ? '#065f46' : ($isUnresolved ? '#7f1d1d' : '#334155');
  $badgeText    = $isResolved ? __('✓ Resolved') : ($isUnresolved ? __('✗ Not Resolved') : __(ucfirst($res ?: 'Responded')));
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero {{ $heroClass }}" style="background-color:{{ $heroBg }};">
    <div class="hero-icon">
      @if($isResolved)
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      @else
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      @endif
    </div>
    <h1>{{ __('Complaint Response') }}</h1>
    <p>{{ __('A response has been provided to your complaint') }}</p>
    <span class="badge">{{ $badgeText }}</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">{!! __('Dear :name,', ['name' => '<strong>'.e($recipient->name ?? __('Researcher')).'</strong>']) !!}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      {{ __('Your complaint regarding the following proposal has been reviewed and a response has been provided.') }}
    </p>

    @if(!empty($tracker_number))
    <div class="tracker-row">
      <span class="tracker-label">{{ __('Proposal Tracker') }}</span>
      <span class="tracker-val">{{ $tracker_number }}</span>
    </div>
    @endif

    @if(!empty($response))
    <div class="response-box">
      <p class="response-from">{!! __('Response from :name', ['name' => e($resolved_by ?? __('Research Officer'))]) !!}</p>
      <p class="response-text">{{ $response }}</p>
    </div>
    @endif

    @if($isResolved)
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:10px;padding:14px 18px;margin:20px 0;display:flex;gap:10px;align-items:flex-start;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" style="flex-shrink:0;margin-top:1px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      <p style="font-size:13px;color:#166534;margin:0;line-height:1.6;">{!! __('Your complaint has been <strong>resolved</strong>. No further action is needed on your part.') !!}</p>
    </div>
    @endif

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      {!! __('Sent via <strong>:platform</strong>. If you have further questions, contact the :org Research Office directly.', ['platform' => e($platformName), 'org' => e($orgName)]) !!}
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ __(':org Research & Technology Transfer', ['org' => $orgName]) }}
  </div>
</div>
</body>
</html>
