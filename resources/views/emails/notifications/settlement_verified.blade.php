<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Settlement Verified</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#065f46,#047857);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .verified-box{background:#f0fdf4;border:2px solid #86efac;border-radius:16px;padding:24px;text-align:center;margin:20px 0;}
  .verified-label{font-size:11px;font-weight:700;color:#166534;letter-spacing:.09em;text-transform:uppercase;margin:0 0 8px;}
  .verified-round{font-size:36px;font-weight:900;color:#166534;margin:0 0 8px;}
  .verified-sub{font-size:13px;color:#4ade80;margin:0;}
  .next-pill{display:inline-flex;align-items:center;gap:8px;background:#d1fae5;border:1px solid #6ee7b7;color:#065f46;font-size:13px;font-weight:700;padding:10px 20px;border-radius:999px;margin:20px 0;}
  .cta{text-align:center;margin:28px 0 8px;}
  .btn{display:inline-block;background:linear-gradient(135deg,#065f46,#047857);color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;}
  .cta-sub{font-size:12px;color:#94a3b8;margin-top:10px;}
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
  $roundNum     = (int) ($round_number ?? 1);
  $nextRound    = $roundNum + 1;
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#065f46;">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <h1>Settlement Verified!</h1>
    <p>Your settlement has been confirmed by Finance</p>
    <span class="badge">✓ Verified</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $recipient->name ?? 'Researcher' }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      Your settlement documentation for the funding round below has been reviewed and
      <strong>verified by the Finance Office</strong>. You are now eligible to proceed to the next round.
    </p>

    <div class="verified-box">
      <p class="verified-label">Verified Settlement</p>
      <p class="verified-round">Round {{ $roundNum }}</p>
      <p class="verified-sub">Cleared and confirmed by Finance</p>
    </div>

    <div style="text-align:center;">
      <span class="next-pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        You are now eligible to submit Round {{ $nextRound }}
      </span>
    </div>

    <div class="cta">
      <a href="{{ config('app.url') }}" class="btn">Start Round {{ $nextRound }} →</a>
      <p class="cta-sub">Log in to the platform to submit your next budget request.</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Sent via <strong>{{ $platformName }}</strong>. Contact the {{ $orgName }} Finance Office if you have any questions.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
