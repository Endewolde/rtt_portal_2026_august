<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ __('Signature Required') }}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#b45309,#d97706);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .info-card{background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:22px;margin:20px 0;}
  .info-card-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#92400e;margin:0 0 14px;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #fde68a;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#78350f;font-weight:500;}
  .alert{background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:14px 18px;margin:20px 0;display:flex;gap:10px;align-items:flex-start;}
  .alert p{font-size:13px;color:#7f1d1d;margin:0;line-height:1.6;}
  .cta{text-align:center;margin:28px 0 8px;}
  .btn{display:inline-block;background:linear-gradient(135deg,#b45309,#d97706);color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:.01em;}
  .cta-sub{font-size:12px;color:#94a3b8;margin-top:10px;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
@php
  use App\Models\AppSetting;
  $s = AppSetting::whereIn('key', ['organization_name','system_name','app_url'])->pluck('value','key');
  $platformName = $s->get('system_name', 'RTT Platform');
  $orgName      = $s->get('organization_name', 'Research Office');
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#b45309;">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
      </svg>
    </div>
    <h1>{{ __('Signature Required') }}</h1>
    <p>{{ __('Your action is needed on a budget request') }}</p>
    <span class="badge">{{ __('Action Required') }}</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">{!! __('Dear :name,', ['name' => '<strong>'.e($recipient->name ?? __('Team Member')).'</strong>']) !!}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      {!! __('Your <strong>signature is required</strong> on a budget request for the following proposal. Please log in to the platform to review the request and either sign or refuse with a reason.') !!}
    </p>

    <div class="info-card">
      <p class="info-card-title">{{ __('Budget Request Details') }}</p>
      @if(!empty($round_number))
      <div class="row"><label>{{ __('Funding Round') }}</label><span style="font-weight:700;color:#92400e;">{{ __('Round :round', ['round' => $round_number]) }}</span></div>
      @endif
      @if(!empty($title))
      <div class="row"><label>{{ __('Proposal') }}</label><span style="font-weight:600;color:#0f172a;text-align:right;max-width:60%;">{{ $title }}</span></div>
      @endif
    </div>

    <div class="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5" style="flex-shrink:0;margin-top:1px;">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>{!! __('Please review and sign <strong>as soon as possible</strong>. Delays may affect the budget disbursement timeline.') !!}</p>
    </div>

    <div class="cta">
      <a href="{{ config('app.url') }}" class="btn">{{ __('Sign Budget Request →') }}</a>
      <p class="cta-sub">{{ __('Log in to the platform and navigate to your budget requests.') }}</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      {!! __('You received this because you are listed as a co-investigator or signatory on this proposal via <strong>:platform</strong>.', ['platform' => e($platformName)]) !!}
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ __(':org Research & Technology Transfer', ['org' => $orgName]) }}
  </div>
</div>
</body>
</html>
