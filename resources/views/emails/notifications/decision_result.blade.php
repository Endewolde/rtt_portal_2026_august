<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ __('Proposal Decision') }}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero-accepted{background:linear-gradient(135deg,#065f46,#059669);}
  .hero-rejected{background:linear-gradient(135deg,#7f1d1d,#dc2626);}
  .hero-validated{background:linear-gradient(135deg,#1e40af,#3b82f6);}
  .hero-review{background:linear-gradient(135deg,#6b21a8,#9333ea);}
  .hero-central{background:linear-gradient(135deg,#0e7490,#0891b2);}
  .hero-default{background:linear-gradient(135deg,#334155,#475569);}
  .hero{padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .tracker-row{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin:16px 0;}
  .tracker-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;}
  .tracker-val{font-size:14px;font-family:monospace;color:#374151;font-weight:700;}
  .reason-box{border-radius:12px;padding:18px;margin:20px 0;}
  .reason-accepted{background:#f0fdf4;border:1px solid #86efac;}
  .reason-rejected{background:#fef2f2;border:1px solid #fca5a5;}
  .reason-other{background:#f8fafc;border:1px solid #e2e8f0;}
  .reason-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px;}
  .reason-accepted .reason-label{color:#166534;}
  .reason-rejected .reason-label{color:#991b1b;}
  .reason-other .reason-label{color:#64748b;}
  .reason-text{font-size:14px;line-height:1.7;margin:0;}
  .reason-accepted .reason-text{color:#166534;}
  .reason-rejected .reason-text{color:#7f1d1d;}
  .reason-other .reason-text{color:#374151;}
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

  $dec = strtolower($decision ?? 'pending');
  $isAccepted        = $dec === 'accepted';
  $isRejected        = $dec === 'rejected';
  $isValidated       = $dec === 'validated';
  $isCentralEval     = $dec === 'central_eval_approved';
  $isFundingRevoked  = $dec === 'funding_revoked';
  $isOfficerNotif = in_array($dec, ['appeal_resolved', 'central_eval_approved']);
  $isReview       = str_contains($dec, 'review') || str_contains($dec, 'defence');

  if ($isCentralEval)       { $heroClass = 'hero-central'; $heroBg = '#0e7490'; $icon = 'eye'; $label = '→ Central Evaluation'; $heading = 'Advanced to Central Evaluation'; $sub = 'Your proposal has passed to the next stage.'; }
  elseif ($isFundingRevoked){ $heroClass = 'hero-rejected'; $heroBg = '#7f1d1d'; $icon = 'x'; $label = '✗ Funding Revoked'; $heading = 'Funding Revoked'; $sub = 'We regret to inform you that your research funding has been revoked.'; }
  elseif ($isAccepted)      { $heroClass = 'hero-accepted'; $heroBg = '#065f46'; $icon = 'check'; $label = '✓ Accepted'; $heading = 'Congratulations!'; $sub = 'Your proposal has been accepted.'; }
  elseif ($isRejected)      { $heroClass = 'hero-rejected'; $heroBg = '#7f1d1d'; $icon = 'x'; $label = '✗ Not Selected'; $heading = 'Proposal Decision'; $sub = 'We regret to inform you of the outcome.'; }
  elseif ($isValidated)     { $heroClass = 'hero-validated'; $heroBg = '#1e40af'; $icon = 'check'; $label = '✓ Validated'; $heading = 'Proposal Validated'; $sub = 'Your proposal passed initial review.'; }
  elseif ($isReview)        { $heroClass = 'hero-review'; $heroBg = '#6b21a8'; $icon = 'eye'; $label = '⟳ Under Review'; $heading = 'Under Review'; $sub = 'Your proposal has entered the review phase.'; }
  else                      { $heroClass = 'hero-default'; $heroBg = '#334155'; $icon = 'info'; $label = strtoupper($dec); $heading = 'Proposal Update'; $sub = 'An update on your research proposal.'; }
  [$label, $heading, $sub] = [__($label), __($heading), __($sub)];
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero {{ $heroClass }}" style="background-color:{{ $heroBg }};">
    <div class="hero-icon">
      @if($icon === 'check')
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      @elseif($icon === 'x')
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      @elseif($icon === 'eye')
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
      </svg>
      @else
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      @endif
    </div>
    <h1>{{ $heading }}</h1>
    <p>{{ $sub }}</p>
    <span class="badge">{{ $label }}</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">{!! __('Dear :name,', ['name' => '<strong>'.e($recipient->name ?? __('Researcher')).'</strong>']) !!}</p>

    @if(!empty($title))
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      {!! __('This is an update regarding your research proposal: <strong>:title</strong>.', ['title' => e($title)]) !!}
    </p>
    @endif

    @if(!empty($tracker_number))
    <div class="tracker-row">
      <span class="tracker-label">{{ __('Tracker Number') }}</span>
      <span class="tracker-val">{{ $tracker_number }}</span>
    </div>
    @endif

    @if(!empty($reason))
    <div class="reason-box {{ $isAccepted ? 'reason-accepted' : ($isRejected ? 'reason-rejected' : 'reason-other') }}">
      <p class="reason-label">{{ $isRejected ? __('Reason') : __('Notes') }}</p>
      <p class="reason-text">{{ __($reason) }}</p>
    </div>
    @endif

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      {!! __('Sent to <strong>:email</strong> via <strong>:platform</strong>. Please contact the :org Research Office if you have questions.', ['email' => e($recipient->email ?? ''), 'platform' => e($platformName), 'org' => e($orgName)]) !!}
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ __(':org Research & Technology Transfer', ['org' => $orgName]) }}
  </div>
</div>
</body>
</html>
