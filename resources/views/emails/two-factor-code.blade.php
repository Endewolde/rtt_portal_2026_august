<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Your Sign-In Code</title>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:linear-gradient(135deg,#1e3a5f,#2563eb); padding:32px; text-align:center; }
  .header-icon { width:52px; height:52px; background:rgba(255,255,255,.15); border-radius:14px;
                 display:inline-flex; align-items:center; justify-content:center; margin:0 auto 14px; }
  .header h1 { color:#fff; font-size:20px; font-weight:700; margin:0 0 4px; }
  .header p  { color:rgba(255,255,255,.7); font-size:13px; margin:0; }
  .body   { padding:32px; }
  .greeting { font-size:15px; color:#111827; font-weight:600; margin:0 0 12px; }
  p  { font-size:14px; color:#6b7280; line-height:1.7; margin:0 0 16px; }
  .code-box { background:#f0f4ff; border:2px solid #c7d4fe; border-radius:14px; padding:20px;
              text-align:center; margin:24px 0; }
  .code-box .code { font-size:40px; font-weight:800; letter-spacing:10px; color:#2563eb; font-family:monospace; }
  .code-box .hint { font-size:12px; color:#6b7280; margin:6px 0 0; }
  .warning { display:flex; gap:10px; background:#fef3c7; border:1px solid #fcd34d; border-radius:10px;
             padding:12px 14px; margin:20px 0; }
  .warning p { margin:0; font-size:12px; color:#92400e; }
  .divider { border:none; border-top:1px solid #e5e7eb; margin:24px 0; }
  .footer { background:#f8fafc; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; }
</style>
</head>
<body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="header" style="background-color:#1e3a5f;">
    <div class="header-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
    </div>
    <h1>Verification Code</h1>
    <p>RTT Platform — Two-Factor Authentication</p>
  </div>

  <div class="body">
    <p class="greeting">Hi {{ $user->name }},</p>
    <p>
      Use the code below to complete your sign-in. This code expires in
      <strong>5 minutes</strong>.
    </p>

    <div class="code-box">
      <div class="code">{{ $code }}</div>
      <p class="hint">Enter this code on the sign-in screen</p>
    </div>

    <div class="warning">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2" style="flex-shrink:0;margin-top:1px">
        <path d="m10.29 3.86-8.37 14.48A1 1 0 0 0 2.79 20h18.42a1 1 0 0 0 .87-1.5L13.71 3.86a1 1 0 0 0-1.73.0z"/>
        <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
      </svg>
      <p>If you did not attempt to sign in, please ignore this email and consider changing your password.</p>
    </div>

    <hr class="divider">
    <p style="margin:0;font-size:12px;color:#9ca3af">
      Never share this code with anyone. RTT Platform will never ask for your code by phone or email.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>RTT Platform</strong>
    &nbsp;·&nbsp; Research &amp; Technology Transfer Platform
  </div>
</div>
</body>
</html>
