<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Abstract Accepted</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#065f46,#059669);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:24px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.85);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.25);border:1px solid rgba(255,255,255,.4);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .title-box{background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:16px 20px;margin:16px 0;}
  .title-label{font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:.06em;margin:0 0 5px;}
  .title-val{font-size:16px;font-weight:700;color:#14532d;margin:0;line-height:1.4;}
  .next-steps{background:#fffbeb;border:2px solid #fbbf24;border-radius:14px;padding:22px;margin:24px 0;}
  .next-steps-header{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
  .next-steps-icon{width:36px;height:36px;border-radius:10px;background:#f59e0b;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .next-steps-title{font-size:14px;font-weight:700;color:#92400e;margin:0;}
  .next-steps-body{font-size:14px;color:#78350f;line-height:1.8;white-space:pre-line;margin:0;}
  .note{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin:20px 0;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <h1>Congratulations!</h1>
    <p>Your abstract has been accepted for presentation</p>
    <span class="badge">✓ Accepted</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 18px;">Dear <strong>{{ $abstract->submitter_name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 18px;">
      We are delighted to inform you that your abstract submitted to
      <strong>{{ $conference->title }}</strong> has been <strong>accepted</strong> for presentation.
      Congratulations on this achievement!
    </p>

    <div class="title-box">
      <p class="title-label">Accepted Abstract</p>
      <p class="title-val">{{ $abstract->title }}</p>
    </div>

    @if($abstract->admin_notes)
    {{-- Admin provided explicit next steps --}}
    <div class="next-steps">
      <div class="next-steps-header">
        <div class="next-steps-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
        </div>
        <p class="next-steps-title">What happens next — Instructions from the Committee</p>
      </div>
      <p class="next-steps-body">{{ $abstract->admin_notes }}</p>
    </div>
    @else
    {{-- Fallback when admin didn't write next steps --}}
    <div class="note">
      <p style="font-size:14px;color:#166534;margin:0;line-height:1.7;">
        <strong>Next Steps:</strong> You will receive further details about your presentation schedule,
        assigned time slot, venue or virtual link, and any materials required from the conference organizers.
        Please watch your inbox for these details.
      </p>
    </div>
    @endif

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:20px 0;">
      <p style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin:0 0 5px;">Tracking Token</p>
      <p style="font-size:13px;font-family:monospace;color:#374151;word-break:break-all;margin:0;">{{ $abstract->submission_token }}</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Sent to <strong>{{ $abstract->submitter_email }}</strong> · {{ $senderName }}
    </p>
  </div>

  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</div>
</div>
</body>
</html>
