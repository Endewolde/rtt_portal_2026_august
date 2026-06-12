<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Deadline Reminder</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#744210;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Deadline Reminder</h1>
  </div>
  <div style="padding:32px;">
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <div style="background:#fffaf0;border-left:4px solid #d69e2e;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="font-size:32px;font-weight:bold;color:#744210;margin:0;text-align:center;">{{ $days_remaining ?? '?' }} days</p>
      <p style="text-align:center;color:#744210;margin:4px 0 0;">remaining until deadline</p>
    </div>
    @if(!empty($call_title))<p style="color:#4a5568;"><strong>Call:</strong> {{ $call_title }}</p>@endif
    @if(!empty($deadline_date))<p style="color:#4a5568;"><strong>Deadline:</strong> {{ $deadline_date }}</p>@endif
    <p style="color:#4a5568;">Please ensure your proposal is submitted before the deadline.</p>
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
