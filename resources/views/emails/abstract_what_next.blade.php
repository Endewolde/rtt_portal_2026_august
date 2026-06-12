<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ $senderName }} — What Happens Next</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#0f766e,#0891b2);padding:36px 32px;text-align:center;}
  .hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:13px;}
  .body{padding:32px;}
  .abstract-pill{display:inline-block;background:#f0fdfa;border:1px solid #99f6e4;color:#0f766e;font-size:12px;font-weight:600;padding:6px 14px;border-radius:999px;margin:16px 0;}
  .message{font-size:14px;color:#374151;line-height:1.8;white-space:pre-line;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="hero-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
    </div>
    <h1>What Happens Next</h1>
    <p>{{ $conference->title }}</p>
  </div>

  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 6px;">Dear <strong>{{ $abstract->submitter_name }}</strong>,</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 4px;">Regarding your accepted abstract:</p>
    <span class="abstract-pill">{{ $abstract->title }}</span>

    <div class="message">{{ $body }}</div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Sent by the organising team of <strong>{{ $senderName }}</strong>.
      Please do not reply to this email — contact the conference coordinators directly if you have questions.
    </p>
  </div>

  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</div>
</div>
</body>
</html>
