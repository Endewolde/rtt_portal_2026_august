<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SMTP Connection Test</title>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:560px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header { background:linear-gradient(135deg,#047857,#0e7490); padding:32px 32px 24px; text-align:center; }
  .header h1 { color:#fff; font-size:20px; font-weight:700; margin:0 0 6px; }
  .header p  { color:rgba(255,255,255,.75); font-size:13px; margin:0; }
  .body   { padding:32px; }
  .badge  { display:inline-flex; align-items:center; gap:6px; background:#d1fae5; color:#065f46;
            border:1px solid #a7f3d0; border-radius:100px; padding:6px 14px; font-size:12px; font-weight:600; }
  .badge::before { content:'✓'; font-size:14px; }
  h2 { font-size:18px; font-weight:700; color:#111827; margin:20px 0 8px; }
  p  { color:#6b7280; font-size:14px; line-height:1.6; margin:0 0 16px; }
  .info-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px 20px; margin:20px 0; }
  .info-row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #f1f5f9; font-size:13px; }
  .info-row:last-child { border-bottom:none; }
  .info-key   { color:#9ca3af; font-weight:500; }
  .info-value { color:#374151; font-weight:600; font-family:monospace; }
  .footer { background:#f8fafc; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <h1>RTT Platform</h1>
    <p>Email Configuration Test</p>
  </div>
  <div class="body">
    <div class="badge">SMTP Connection Successful</div>
    <h2>Your email settings are working!</h2>
    <p>
      This test email confirms that your SMTP configuration is correctly set up and
      RTT Platform can successfully deliver emails to users.
    </p>
    <div class="info-box">
      <div class="info-row">
        <span class="info-key">SMTP Host</span>
        <span class="info-value">{{ $smtpHost ?? '—' }}</span>
      </div>
      <div class="info-row">
        <span class="info-key">From Name</span>
        <span class="info-value">{{ $senderName ?? '—' }}</span>
      </div>
      <div class="info-row">
        <span class="info-key">From Email</span>
        <span class="info-value">{{ $senderEmail ?? '—' }}</span>
      </div>
      <div class="info-row">
        <span class="info-key">Sent At</span>
        <span class="info-value">{{ now()->format('d M Y, H:i') }}</span>
      </div>
    </div>
    <p style="margin-bottom:0">
      If you did not request this, you can safely ignore it.
      It was sent from the RTT Platform admin settings panel.
    </p>
  </div>
  <div class="footer">
    RTT Platform — Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
