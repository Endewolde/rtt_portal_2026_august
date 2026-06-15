<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conference Cancelled</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#7f1d1d,#991b1b);padding:36px 32px;text-align:center;}
  .hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.75);margin:0;font-size:13px;}
  .body{padding:32px;}
  .conf-name{font-size:19px;font-weight:700;color:#0f172a;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:16px 20px;margin:20px 0;}
  .apology{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:20px 0;}
  .apology p{font-size:14px;color:#4b5563;line-height:1.7;margin:0;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}
  .footer p{font-size:12px;color:#9ca3af;margin:0;}
</style>
</head>
<body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#7f1d1d;">
    <div class="hero-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
    </div>
    <h1>Conference Cancelled</h1>
    <p>We regret to inform you of this cancellation</p>
  </div>

  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $registration->name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 16px;">
      We regret to inform you that the following conference has been cancelled.
      We sincerely apologize for any inconvenience this may cause.
    </p>

    <div class="conf-name">{{ $conference->title }}</div>

    <div class="apology">
      <p>
        Your registration (ID: <strong>{{ strtoupper(substr($registration->id, 0, 8)) }}</strong>) has been
        automatically voided. No further action is required on your part.
        <br><br>
        We hope to welcome you to future events and appreciate your understanding.
      </p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      You received this notice because you were registered for this event via <strong>{{ $senderName }}</strong>.
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</p>
  </div>
</div>
</body>
</html>
