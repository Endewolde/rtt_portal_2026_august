<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Database Backup</title>
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
  .badge  { display:inline-flex; align-items:center; gap:6px; background:#ecfdf5; border:1px solid #6ee7b7;
            color:#065f46; font-size:12px; font-weight:600; padding:4px 10px; border-radius:20px; margin-bottom:20px; }
  .badge-dot { width:7px; height:7px; border-radius:50%; background:#10b981; }
  .meta-box { background:#f8fafc; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:20px; }
  .meta-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0;
              border-bottom:1px solid #f1f5f9; font-size:13px; }
  .meta-row:last-child { border-bottom:none; }
  .meta-label { color:#6b7280; }
  .meta-value { color:#111827; font-weight:600; font-family:monospace; }
  .note  { font-size:13px; color:#6b7280; line-height:1.6; margin:0; }
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
          <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
      </div>
      <div>
        <div class="logo-text">{{ $senderName ?? 'RTT Platform' }}</div>
        <div class="logo-sub">Research &amp; Technology Transfer</div>
      </div>
    </div>
    <div class="subject">Database Backup — {{ $backupDate }}</div>
  </div>

  <div class="body">
    <div class="badge">
      <span class="badge-dot"></span>
      Backup Completed Successfully
    </div>

    <div class="meta-box">
      <div class="meta-row">
        <span class="meta-label">Date &amp; Time</span>
        <span class="meta-value">{{ $backupDate }}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">File</span>
        <span class="meta-value">{{ $filename }}</span>
      </div>
      <div class="meta-row">
        <span class="meta-label">Size</span>
        <span class="meta-value">{{ $size }}</span>
      </div>
    </div>

    <p class="note">
      The database backup is attached to this email as a compressed <strong>.sql.gz</strong> file.
      Store it securely and verify it periodically to ensure restores will work correctly.
    </p>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0">
      This is an automated message from <strong>{{ $senderName ?? 'RTT Platform' }}</strong>.
      Please do not reply directly to this email.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $senderName ?? 'RTT Platform' }}</strong> · Research &amp; Technology Transfer Platform
  </div>
</div>
</body>
</html>
