<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ __('Review Deadline Reminder') }}</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .body{padding:36px 32px;}
  .countdown{border-radius:16px;padding:24px;text-align:center;margin:20px 0;}
  .countdown-num{font-size:52px;font-weight:900;line-height:1;margin:0 0 4px;}
  .countdown-label{font-size:14px;font-weight:600;margin:0;}
  .urgency-pill{display:inline-block;background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-top:12px;}
  .proposal-card{border-radius:14px;padding:22px;margin:20px 0;border:1px solid;}
  .card-title{font-size:16px;font-weight:700;margin:0 0 16px;line-height:1.4;}
  .meta-row{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:13px;padding:9px 0;border-bottom:1px solid rgba(15,23,42,.06);}
  .meta-row:last-child{padding-bottom:0;border-bottom:none;}
  .meta-label{font-weight:600;flex-shrink:0;}
  .meta-val{color:#374151;font-weight:600;text-align:right;}
  .tracker-badge{background:rgba(15,23,42,.06);padding:3px 9px;border-radius:6px;font-size:12px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.01em;}
  .type-pill{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;}
  .cta{text-align:center;margin:28px 0 8px;}
  .btn{display:inline-block;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:.01em;}
  .cta-sub{font-size:12px;color:#94a3b8;margin-top:12px;}
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
  $daysRemaining = (int) ($days_remaining ?? 0);
  $isOverdue = $daysRemaining < 0;
  $heroColor = $isOverdue ? '#991b1b' : '#92400e';
  $accentColor = $isOverdue ? '#dc2626' : '#d97706';
  $countdownBg = $isOverdue ? 'linear-gradient(135deg,#fef2f2,#fee2e2)' : 'linear-gradient(135deg,#fffbeb,#fef3c7)';
  $countdownBorder = $isOverdue ? '#f87171' : '#fbbf24';
  $countdownColor = $isOverdue ? '#991b1b' : '#92400e';
  $countdownLabelColor = $isOverdue ? '#b91c1c' : '#b45309';
  $cardBg = $isOverdue ? '#fef2f2' : '#fffbeb';
  $cardBorder = $isOverdue ? '#fecaca' : '#fde68a';
  $has = fn ($v) => ! empty($v) && $v !== '—';
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background:linear-gradient(135deg,{{ $heroColor }},{{ $accentColor }});">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    </div>
    <h1>{{ $isOverdue ? __('Review Overdue') : __('Review Deadline Reminder') }}</h1>
    <p>{{ $isOverdue ? __('Please submit your evaluation as soon as possible') : __('Action required — submit your evaluation before the due date') }}</p>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 20px;">{!! __('Dear :name,', ['name' => '<strong>'.e($reviewer_name ?? $recipient->name ?? __('Reviewer')).'</strong>']) !!}</p>

    <div class="countdown" style="background:{{ $countdownBg }};border:2px solid {{ $countdownBorder }};">
      <p class="countdown-num" style="color:{{ $countdownColor }};">{{ abs($daysRemaining) }}</p>
      <p class="countdown-label" style="color:{{ $countdownLabelColor }};">
        @if($isOverdue)
          {{ abs($daysRemaining) === 1 ? __('day overdue') : __('days overdue') }}
        @elseif($daysRemaining === 0)
          {{ __('due today') }}
        @else
          {{ $daysRemaining === 1 ? __('day remaining until your review is due') : __('days remaining until your review is due') }}
        @endif
      </p>
      @if($isOverdue)
      <span class="urgency-pill">{{ __('⚠ Overdue — Act Now') }}</span>
      @endif
    </div>

    @if($has($proposal_title ?? null) || $has($tracker_number ?? null) || $has($review_type ?? null) || $has($due_date ?? null))
    <div class="proposal-card" style="background:{{ $cardBg }};border-color:{{ $cardBorder }};">
      @if($has($proposal_title ?? null))
      <p class="card-title" style="color:{{ $heroColor }};">{{ $proposal_title }}</p>
      @endif
      @if($has($tracker_number ?? null))
      <div class="meta-row">
        <span class="meta-label" style="color:{{ $heroColor }};">{{ __('Tracker No.') }}</span>
        <span class="meta-val"><code class="tracker-badge">{{ $tracker_number }}</code></span>
      </div>
      @endif
      @if($has($review_type ?? null))
      <div class="meta-row">
        <span class="meta-label" style="color:{{ $heroColor }};">{{ __('Review Type') }}</span>
        <span class="meta-val">
          <span class="type-pill" style="background:rgba(15,23,42,.06);color:{{ $heroColor }};">{{ $review_type }}</span>
        </span>
      </div>
      @endif
      @if($has($due_date ?? null))
      <div class="meta-row">
        <span class="meta-label" style="color:{{ $heroColor }};">{{ __('Due Date') }}</span>
        <span class="meta-val" style="color:{{ $accentColor }};">{{ $due_date }}</span>
      </div>
      @endif
    </div>
    @endif

    <div class="cta">
      <a href="{{ $review_url ?? config('app.url') }}" class="btn" style="background:linear-gradient(135deg,{{ $heroColor }},{{ $accentColor }});">{{ __('Submit Your Review →') }}</a>
      <p class="cta-sub">{!! __('Opens your assignment directly in :platform.', ['platform' => e($platformName)]) !!}</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      {!! __('Log in to <strong>:platform</strong> to complete your evaluation. Contact the :org Research Office if you need assistance.', ['platform' => e($platformName), 'org' => e($orgName)]) !!}
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ __(':org Research & Technology Transfer', ['org' => $orgName]) }}
  </div>
</div>
</body>
</html>
