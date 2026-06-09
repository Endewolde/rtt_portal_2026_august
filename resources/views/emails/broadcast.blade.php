<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ $subject }}</title>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:580px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { padding:28px 32px 24px; border-bottom:1px solid #e5e7eb; }
  .logo   { display:flex; align-items:center; gap:10px; margin-bottom:16px; }
  .logo-icon { width:36px; height:36px; border-radius:10px; display:flex; align-items:center; justify-content:center;
               background:linear-gradient(135deg,#047857,#0e7490); }
  .logo-text { font-size:15px; font-weight:700; color:#111827; }
  .logo-sub  { font-size:11px; color:#6b7280; }
  .subject   { font-size:18px; font-weight:700; color:#111827; line-height:1.3; }
  .body   { padding:28px 32px; }
  .greeting { font-size:14px; color:#374151; margin:0 0 16px; }
  .message-text { font-size:14px; color:#374151; line-height:1.75; white-space:pre-line; }
  .divider { border:none; border-top:1px solid #e5e7eb; margin:24px 0; }
  .footer { background:#f8fafc; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; border-top:1px solid #e5e7eb; }
  .footer strong { color:#6b7280; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo">
      <div class="logo-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
        </svg>
      </div>
      <div>
        <div class="logo-text">{{ $senderName ?? 'RTT Platform' }}</div>
        <div class="logo-sub">Research &amp; Technology Transfer</div>
      </div>
    </div>
    <div class="subject">{{ $subject }}</div>
  </div>

  <div class="body">
    <p class="greeting">Dear {{ $recipientName }},</p>
    <div class="message-text">{{ $body }}</div>
    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0">
      This message was sent by <strong>{{ $senderName ?? 'RTT Platform' }}</strong> administration.
      Please do not reply directly to this email.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $senderName ?? 'RTT Platform' }}</strong> · Research &amp; Technology Transfer Platform
  </div>
</div>
</body>
</html>
