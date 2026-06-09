<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirm Your Email Address</title>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:linear-gradient(135deg,#047857,#0e7490); padding:32px; text-align:center; }
  .header-icon { width:52px; height:52px; background:rgba(255,255,255,.15); border-radius:14px;
                 display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
  .header h1 { color:#fff; font-size:20px; font-weight:700; margin:0 0 4px; }
  .header p  { color:rgba(255,255,255,.7); font-size:13px; margin:0; }
  .body   { padding:32px; }
  .greeting { font-size:15px; color:#111827; font-weight:600; margin:0 0 12px; }
  p  { font-size:14px; color:#6b7280; line-height:1.7; margin:0 0 16px; }
  .badge { display:inline-flex; align-items:center; gap:6px; background:#d1fae5; color:#065f46;
           border:1px solid #a7f3d0; border-radius:100px; padding:6px 16px; font-size:12px; font-weight:700;
           margin-bottom:20px; }
  .btn-wrap { text-align:center; margin:28px 0; }
  .btn { display:inline-block; padding:14px 40px; background:linear-gradient(135deg,#047857,#0e7490);
         color:#fff; font-size:15px; font-weight:700; text-decoration:none;
         border-radius:12px; letter-spacing:.2px; }
  .link-fallback { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; margin:20px 0; }
  .link-fallback p { margin:0 0 6px; font-size:12px; color:#6b7280; }
  .link-fallback code { font-size:11px; color:#374151; word-break:break-all; font-family:monospace; }
  .info-row { display:flex; align-items:center; gap:12px; padding:12px 14px; background:#f0fdf4;
              border:1px solid #bbf7d0; border-radius:10px; margin-bottom:16px; }
  .info-row p { margin:0; font-size:13px; color:#166534; }
  .divider { border:none; border-top:1px solid #e5e7eb; margin:24px 0; }
  .footer { background:#f8fafc; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="header-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.38 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 6.29 6.29l.62-.72a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
      </svg>
    </div>
    <h1>Confirm Your Email</h1>
    <p>{{ $senderName ?? 'RTT Platform' }}</p>
  </div>

  <div class="body">
    <p class="greeting">Welcome, {{ $userName }}! 👋</p>

    <div class="badge">✓ One more step to get started</div>

    <p>
      Thank you for registering on the RTT Platform. Before you can access your account,
      please verify your email address by clicking the button below.
    </p>

    <div class="btn-wrap">
      <a href="{!! $verifyUrl !!}" class="btn">Verify My Email Address</a>
    </div>

    <div class="link-fallback">
      <p>Or copy and paste this link in your browser:</p>
      <code>{!! $verifyUrl !!}</code>
    </div>

    <div class="info-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" style="flex-shrink:0">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
      <p>This link expires in <strong>24 hours</strong>. After that, you'll need to register again or request a new link.</p>
    </div>

    <hr class="divider">
    <p style="margin:0;font-size:12px;color:#9ca3af">
      If you did not create an account, you can safely ignore this email.
      No account will be created without email verification.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $senderName ?? 'RTT Platform' }}</strong>
    &nbsp;·&nbsp; Research &amp; Technology Transfer Platform
  </div>
</div>
</body>
</html>
