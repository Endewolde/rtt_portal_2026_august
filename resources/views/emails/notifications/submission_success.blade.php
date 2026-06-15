<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proposal Submitted Successfully</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#065f46,#059669);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .tracker-box{background:#f0fdf4;border:1px solid #86efac;border-radius:14px;padding:22px;text-align:center;margin:20px 0;}
  .tracker-label{font-size:11px;font-weight:700;color:#166534;letter-spacing:.09em;text-transform:uppercase;margin:0 0 8px;}
  .tracker-val{font-size:26px;font-family:monospace;font-weight:800;color:#166534;letter-spacing:.06em;margin:0;}
  .tracker-hint{font-size:12px;color:#4ade80;margin:8px 0 0;}
  .detail{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:20px 0;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#64748b;font-weight:500;}
  .steps{background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:22px 0;}
  .steps-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#92400e;margin:0 0 14px;}
  .step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;}
  .step:last-child{margin-bottom:0;}
  .step-num{width:22px;height:22px;border-radius:50%;background:#d97706;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .step-text{font-size:13px;color:#78350f;line-height:1.55;}
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
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    </div>
    <h1>Proposal Submitted!</h1>
    <p>Your proposal is now awaiting validation</p>
    <span class="badge">✓ Submitted</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $recipient->name ?? 'Researcher' }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      Your research proposal has been <strong>successfully submitted</strong> and is now pending validation by the Central Office.
      Your tracking number is shown below — keep it safe.
    </p>

    <div class="tracker-box">
      <p class="tracker-label">Tracker Number</p>
      <p class="tracker-val">{{ $tracker_number ?? 'N/A' }}</p>
      <p class="tracker-hint">Use this number to check your proposal status at any time</p>
    </div>

    @if(!empty($title))
    <div class="detail">
      <div class="row"><label>Proposal Title</label><span style="font-weight:600;color:#0f172a;text-align:right;max-width:60%;">{{ $title }}</span></div>
      <div class="row"><label>Submitted</label><span style="font-weight:600;color:#0f172a;">{{ now()->format('d M Y, H:i') }}</span></div>
      <div class="row"><label>Status</label><span style="font-weight:700;color:#059669;">Pending Validation</span></div>
    </div>
    @endif

    <div class="steps">
      <p class="steps-title">What Happens Next</p>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Your proposal will be reviewed for <strong>completeness</strong> by the Central Office.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">You will receive a notification once <strong>validation is complete</strong>.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Use your tracker number to <strong>monitor your proposal status</strong> on the platform at any time.</div>
      </div>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      This confirmation was sent to <strong>{{ $recipient->email ?? '' }}</strong>.
      Please contact the {{ $orgName }} Research Office if you have any questions.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
