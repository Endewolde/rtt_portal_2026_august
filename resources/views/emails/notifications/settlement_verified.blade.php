<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Settlement Verified</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#276749;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Settlement Verified</h1>
  </div>
  <div style="padding:32px;">
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <p style="color:#4a5568;">Your settlement for Round {{ $round_number ?? 'N/A' }} has been verified by Finance.</p>
    <div style="background:#f0fff4;border-left:4px solid #38a169;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0;color:#276749;font-weight:bold;">You are now eligible to submit Round {{ ($round_number ?? 0) + 1 }}.</p>
    </div>
    <p style="color:#4a5568;">Log in to the RTT platform to start your next funding round.</p>
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
