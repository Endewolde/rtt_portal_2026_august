<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>RTT Notification</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#1a365d;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Research & Technology Transfer</h1>
    <p style="color:#90cdf4;margin:4px 0 0;">Haramaya University</p>
  </div>
  <div style="padding:32px;">
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'User' }},</p>
    <p style="color:#4a5568;">{{ $message ?? 'You have a new notification from the RTT platform.' }}</p>
  </div>
  <div style="background:#f7fafc;padding:16px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">RTT Platform — Haramaya University Research Office</p>
  </div>
</div>
</body>
</html>
