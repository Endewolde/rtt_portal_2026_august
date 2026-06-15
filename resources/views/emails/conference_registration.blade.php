<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Registration Confirmed</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#4338ca 0%,#7c3aed 100%);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.3);color:#fff;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:4px 12px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .greeting{font-size:15px;color:#374151;margin:0 0 20px;}
  .conf-card{background:linear-gradient(135deg,#eef2ff,#f5f3ff);border:1px solid #c7d2fe;border-radius:14px;padding:24px;margin:24px 0;}
  .conf-card h2{margin:0 0 16px;font-size:18px;color:#1e1b4b;line-height:1.3;}
  .conf-meta{display:flex;flex-direction:column;gap:10px;}
  .conf-meta-row{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#4338ca;}
  .conf-meta-row span{color:#374151;}
  .icon-circle{width:28px;height:28px;border-radius:8px;background:#4338ca;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
  .reg-box{background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin:20px 0;text-align:center;}
  .reg-label{font-size:11px;font-weight:700;color:#166534;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px;}
  .reg-id{font-size:20px;font-family:monospace;font-weight:700;color:#166534;letter-spacing:.1em;}
  .steps{margin:24px 0;}
  .steps h3{font-size:13px;font-weight:700;color:#111827;margin:0 0 14px;text-transform:uppercase;letter-spacing:.05em;}
  .step{display:flex;gap:12px;margin-bottom:12px;align-items:flex-start;}
  .step-num{width:24px;height:24px;border-radius:50%;background:#4338ca;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .step-text{font-size:13px;color:#4b5563;line-height:1.5;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;}
  .footer p{font-size:12px;color:#9ca3af;margin:0;}
  .footer strong{color:#6b7280;}
  @media(max-width:600px){.body,.hero{padding:24px 20px!important;}.conf-card{padding:16px!important;}}
</style>
</head>
<body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#4338ca;">
    <div class="hero-icon">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <h1>Registration Confirmed!</h1>
    <p>You're all set for the conference.</p>
    <span class="badge">Confirmed</span>
  </div>

  <div class="body">
    <p class="greeting">Dear <strong>{{ $registration->name }}</strong>,</p>
    <p style="color:#4b5563;font-size:14px;line-height:1.7;margin:0 0 20px;">
      Great news — your registration for the following conference has been confirmed.
      We look forward to seeing you there!
    </p>

    <div class="conf-card">
      <h2>{{ $conference->title }}</h2>
      <div class="conf-meta">
        <div class="conf-meta-row">
          <div class="icon-circle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <span>
            <strong>Date:</strong> {{ $conference->start_date->format('l, d F Y') }}
            @if($conference->end_date && $conference->end_date->format('Y-m-d') !== $conference->start_date->format('Y-m-d'))
              — {{ $conference->end_date->format('d F Y') }}
            @endif
          </span>
        </div>
        <div class="conf-meta-row">
          <div class="icon-circle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <span><strong>Time:</strong> {{ $conference->start_date->format('H:i') }} {{ $conference->timezone }}</span>
        </div>
        <div class="conf-meta-row">
          <div class="icon-circle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span>
            <strong>Location:</strong>
            @if($conference->location_type === 'virtual') Online (Virtual)
            @elseif($conference->location_address) {{ $conference->location_address }}
            @else Hybrid Event @endif
          </span>
        </div>
        @if($conference->virtual_link && $conference->location_type !== 'physical')
        <div class="conf-meta-row">
          <div class="icon-circle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <span><strong>Join Link:</strong> <a href="{{ $conference->virtual_link }}" style="color:#4338ca;">{{ $conference->virtual_link }}</a></span>
        </div>
        @endif
        @if($registration->organization)
        <div class="conf-meta-row">
          <div class="icon-circle">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <span><strong>Organization:</strong> {{ $registration->organization }}</span>
        </div>
        @endif
      </div>
    </div>

    <div class="reg-box">
      <p class="reg-label">Your Registration ID</p>
      <p class="reg-id">{{ strtoupper(substr($registration->id, 0, 8)) }}</p>
    </div>

    <div class="steps">
      <h3>What's next?</h3>
      <div class="step">
        <div class="step-num">1</div>
        <div class="step-text">Save the conference dates to your calendar to avoid missing out.</div>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <div class="step-text">Keep this email handy — your registration ID confirms your spot.</div>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <div class="step-text">Watch for updates — we'll email you if there are any changes to the schedule or venue.</div>
      </div>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      This confirmation was sent to <strong>{{ $registration->email }}</strong>.
      If you did not register for this event, please disregard this email.
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</p>
  </div>
</div>
</body>
</html>
