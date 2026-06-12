<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>RTT Notification</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  @include('emails.partials.header')
  <div style="padding:32px;">
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'User' }},</p>
    <p style="color:#4a5568;">{{ $message ?? 'You have a new notification from the RTT platform.' }}</p>
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
