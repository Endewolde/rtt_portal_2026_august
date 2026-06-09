<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Team Update</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#1a365d;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Research & Technology Transfer</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#2d3748;">Team Update</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Team Member' }},</p>
    <p style="color:#4a5568;">There has been an update to the team for proposal <strong>{{ $tracker_number ?? 'N/A' }}</strong>.</p>
    <div style="background:#f7fafc;padding:16px;border-radius:4px;margin:24px 0;">
      @if(!empty($member_name))<p style="margin:0 0 8px;color:#4a5568;"><strong>Member:</strong> {{ $member_name }}</p>@endif
      @if(!empty($action))<p style="margin:0;color:#4a5568;"><strong>Action:</strong> {{ $action }}</p>@endif
    </div>
  </div>
  <div style="background:#f7fafc;padding:16px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">RTT Platform — Haramaya University Research Office</p>
  </div>
</div>
</body>
</html>
