<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ __('Budget Request Approved') }}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#065f46,#059669);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .approval-card{background:#f0fdf4;border:1px solid #86efac;border-radius:16px;padding:24px;margin:20px 0;}
  .tracker-label{font-size:11px;font-weight:700;color:#166534;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px;}
  .tracker-val{font-size:22px;font-family:monospace;font-weight:800;color:#166534;letter-spacing:.05em;margin:0 0 14px;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #bbf7d0;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#166534;font-weight:500;}
  .amount-highlight{font-size:20px;font-weight:800;color:#065f46;}
  .notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px;margin:20px 0;}
  .notes-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#92400e;margin:0 0 8px;}
  .notes-text{font-size:14px;color:#78350f;line-height:1.7;margin:0;}
  .steps{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:22px 0;}
  .steps-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 14px;}
  .step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;}
  .step:last-child{margin-bottom:0;}
  .step-num{width:22px;height:22px;border-radius:50%;background:#059669;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .step-text{font-size:13px;color:#374151;line-height:1.55;}
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
  <div class="hero" style="background-color:#065f46;">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <h1>{{ __('Budget Approved!') }}</h1>
    <p>{{ __('Your budget request has been approved by the college') }}</p>
    <span class="badge">{{ __('✓ Approved') }}</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">{!! __('Dear :name,', ['name' => '<strong>'.e($recipient->name ?? __('Researcher')).'</strong>']) !!}</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      {!! __('We are pleased to inform you that your budget request has been <strong>approved</strong> by the college. The Finance Office will process the disbursement based on the approved budget.') !!}
    </p>

    <div class="approval-card">
      @if(!empty($tracker_number))
      <p class="tracker-label">{{ __('Tracker Number') }}</p>
      <p class="tracker-val">{{ $tracker_number }}</p>
      @endif
      @if(!empty($title))
      <div class="row"><label>{{ __('Proposal') }}</label><span style="font-weight:600;color:#14532d;text-align:right;max-width:60%;">{{ $title }}</span></div>
      @endif
      @if(!empty($round_number))
      <div class="row"><label>{{ __('Funding Round') }}</label><span style="font-weight:600;color:#14532d;">{{ __('Round :round', ['round' => $round_number]) }}</span></div>
      @endif
      @if(!empty($requested_amount))
      <div class="row"><label>{{ __('Approved Amount') }}</label><span class="amount-highlight">{{ \App\Support\Terms::currency() }} {{ number_format($requested_amount, 2) }}</span></div>
      @endif
    </div>

    @if(!empty($notes))
    <div class="notes-box">
      <p class="notes-label">{{ __('College Review Notes') }}</p>
      <p class="notes-text">{{ $notes }}</p>
    </div>
    @endif

    <div class="steps">
      <p class="steps-title">{{ __('Next Steps') }}</p>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">{!! __('The <strong>Finance Office</strong> will process the disbursement based on the approved budget.') !!}</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">{!! __('You will be <strong>notified once the funds</strong> are disbursed to your account.') !!}</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">{!! __('Ensure all expenditures are <strong>properly documented</strong> for future settlement reporting.') !!}</div>
      </div>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      {!! __('Sent via <strong>:platform</strong>. Contact the :org Finance Office for disbursement queries.', ['platform' => e($platformName), 'org' => e($orgName)]) !!}
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ __(':org Research & Technology Transfer', ['org' => $orgName]) }}
  </div>
</div>
</body>
</html>
