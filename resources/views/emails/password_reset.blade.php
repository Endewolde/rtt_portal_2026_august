<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reset Your Password</title>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:linear-gradient(135deg,#1e3a5f,#2563eb); padding:32px; text-align:center; }
  .header-icon { width:52px; height:52px; background:rgba(255,255,255,.15); border-radius:14px;
                 display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
  .header h1 { color:#fff; font-size:20px; font-weight:700; margin:0 0 4px; }
  .header p  { color:rgba(255,255,255,.7); font-size:13px; margin:0; }
  .body   { padding:32px; }
  .greeting { font-size:15px; color:#111827; font-weight:600; margin:0 0 12px; }
  p  { font-size:14px; color:#6b7280; line-height:1.7; margin:0 0 16px; }
  .btn-wrap { text-align:center; margin:28px 0; }
  .btn { display:inline-block; padding:14px 36px; background:linear-gradient(135deg,#2563eb,#1d4ed8);
         color:#fff; font-size:15px; font-weight:700; text-decoration:none;
         border-radius:12px; letter-spacing:.2px; }
  .link-fallback { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; margin:20px 0; }
  .link-fallback p { margin:0 0 6px; font-size:12px; color:#6b7280; }
  .link-fallback code { font-size:11px; color:#374151; word-break:break-all; font-family:monospace; }
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
    <h1>Reset Your Password</h1>
    <p>{{ $senderName ?? 'RTT Platform' }}</p>
  </div>

  <div class="body">
    <p class="greeting">Hi {{ $userName }},</p>
    <p>
      We received a request to reset the password for your account.
      Click the button below to choose a new password. This link expires in
      <strong>60 minutes</strong>.
    </p>

    <div class="btn-wrap">
      <a href="{!! $resetUrl !!}" class="btn">Reset My Password</a>
    </div>

    <div class="link-fallback">
      <p>Or copy and paste this link in your browser:</p>
      <code>{!! $resetUrl !!}</code>
    </div>

    <div class="warning">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#92400e" stroke-width="2" style="flex-shrink:0;margin-top:1px">
        <path d="m10.29 3.86-8.37 14.48A1 1 0 0 0 2.79 20h18.42a1 1 0 0 0 .87-1.5L13.71 3.86a1 1 0 0 0-1.73.0z"/>
        <line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/>
      </svg>
      <p>If you did not request a password reset, please ignore this email. Your password will not change.</p>
    </div>

    <hr class="divider">
    <p style="margin:0;font-size:12px;color:#9ca3af">
      This link will expire at <strong>{{ $expiresAt }}</strong>.<br>
      If it has expired, request a new one from the login page.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $senderName ?? 'RTT Platform' }}</strong>
    &nbsp;·&nbsp; Research &amp; Technology Transfer Platform
  </div>
</div>
</body>
</html>
