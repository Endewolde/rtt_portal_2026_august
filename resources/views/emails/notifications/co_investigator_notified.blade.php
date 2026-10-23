<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ __('Co-Investigator Invitation') }}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#3730a3,#4338ca);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .proposal-card{background:#eef2ff;border:1px solid #c7d2fe;border-radius:14px;padding:22px;margin:20px 0;}
  .proposal-label{font-size:11px;font-weight:700;color:#3730a3;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px;}
  .proposal-tracker{font-size:22px;font-family:monospace;font-weight:800;color:#3730a3;margin:0 0 12px;letter-spacing:.05em;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #c7d2fe;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#4338ca;font-weight:500;}
  .implications{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin:22px 0;}
  .impl-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 14px;}
  .impl-item{display:flex;gap:10px;margin-bottom:10px;align-items:flex-start;font-size:13px;color:#374151;line-height:1.55;}
  .impl-item:last-child{margin-bottom:0;}
  .impl-dot{width:6px;height:6px;border-radius:50%;background:#4338ca;margin-top:5px;flex-shrink:0;}
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
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#3730a3;">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
    <h1>{{ __('You Are a Co-Investigator') }}</h1>
    <p>{{ __('You have been listed on a research proposal') }}</p>
    <span class="badge">{{ __('Co-Investigator') }}</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">{!! __('Dear :name,', ['name' => '<strong>'.e($recipient->name ?? __('Researcher')).'</strong>']) !!}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      {!! __('You have been listed as a <strong>Co-Investigator</strong> on a research proposal that has been successfully submitted by <strong>:pi</strong>.', ['pi' => e($pi_name ?? __('the Principal Investigator'))]) !!}
    </p>

    <div class="proposal-card">
      <p class="proposal-label">{{ __('Proposal Details') }}</p>
      @if(!empty($tracker_number))
      <p class="proposal-tracker">{{ $tracker_number }}</p>
      @endif
      @if(!empty($title))
      <div class="row"><label>{{ __('Title') }}</label><span style="font-weight:600;color:#1e1b4b;text-align:right;max-width:60%;">{{ $title }}</span></div>
      @endif
      @if(!empty($pi_name))
      <div class="row"><label>{{ __('Principal Investigator') }}</label><span style="font-weight:600;color:#1e1b4b;">{{ $pi_name }}</span></div>
      @endif
    </div>

    <div class="implications">
      <p class="impl-title">{{ __('What This Means for You') }}</p>
      <div class="impl-item">
        <div class="impl-dot"></div>
        <span>{!! __('You may be required to <strong>sign budget request documents</strong> during the funding phase.') !!}</span>
      </div>
      <div class="impl-item">
        <div class="impl-dot"></div>
        <span>{!! __('You will receive <strong>email updates</strong> on the proposal\'s progress throughout the review process.') !!}</span>
      </div>
      <div class="impl-item">
        <div class="impl-dot"></div>
        <span>{!! __('Log in to <strong>:platform</strong> to view proposal details using your tracker number.', ['platform' => e($platformName)]) !!}</span>
      </div>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      {!! __('If you were not informed about this proposal or believe this is an error, please contact <strong>:pi</strong> or the :org Research Office.', ['pi' => e($pi_name ?? __('the Principal Investigator')), 'org' => e($orgName)]) !!}
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ __(':org Research & Technology Transfer', ['org' => $orgName]) }}
  </div>
</div>
</body>
</html>
