<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Deadline Reminder</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#92400e,#d97706);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .body{padding:36px 32px;}
  .countdown{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #fbbf24;border-radius:16px;padding:28px;text-align:center;margin:20px 0;}
  .countdown-num{font-size:56px;font-weight:900;color:#92400e;line-height:1;margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .countdown-label{font-size:14px;color:#b45309;font-weight:600;margin:0;}
  .urgency-pill{display:inline-block;background:#fee2e2;border:1px solid #fca5a5;color:#991b1b;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;margin-top:12px;}
  .detail{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:20px 0;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#64748b;font-weight:500;}
  .alert{background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:14px 18px;margin:20px 0;display:flex;gap:10px;align-items:flex-start;}
  .alert p{font-size:13px;color:#713f12;margin:0;line-height:1.6;}
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
  $daysLeft = (int) ($days_remaining ?? 0);
  $isUrgent = $daysLeft <= 3;
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#92400e;">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    </div>
    <h1>Deadline Reminder</h1>
    <p>Action required — submit before the deadline</p>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 20px;">Dear <strong>{{ $recipient->name ?? 'Researcher' }}</strong>,</p>

    <div class="countdown">
      <p class="countdown-num">{{ $days_remaining ?? '?' }}</p>
      <p class="countdown-label">{{ $daysLeft === 1 ? 'day' : 'days' }} remaining until the submission deadline</p>
      @if($isUrgent)
      <span class="urgency-pill">⚠ Urgent — Act Now</span>
      @endif
    </div>

    @if(!empty($call_title) || !empty($deadline_date))
    <div class="detail">
      @if(!empty($call_title))
      <div class="row"><label>Proposal Call</label><span style="font-weight:600;color:#0f172a;text-align:right;max-width:60%;">{{ $call_title }}</span></div>
      @endif
      @if(!empty($deadline_date))
      <div class="row"><label>Deadline</label><span style="font-weight:700;color:#dc2626;">{{ $deadline_date }}</span></div>
      @endif
    </div>
    @endif

    <div class="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ca8a04" stroke-width="2.5" style="flex-shrink:0;margin-top:1px;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <p>Please ensure your proposal is complete and submitted before the deadline. Late submissions may not be accepted.</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Log in to <strong>{{ $platformName }}</strong> to submit your proposal before the deadline.
      Contact the {{ $orgName }} Research Office if you need assistance.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
