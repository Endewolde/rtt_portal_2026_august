<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signature Required</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  @include('emails.partials.header')
  <div style="padding:32px;">
    <h2 style="color:#2d3748;">Signature Required</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Team Member' }},</p>
    <p style="color:#4a5568;">Your signature is required on a budget request. Please sign or refuse with a reason.</p>
    <div style="background:#ebf8ff;border-left:4px solid #3182ce;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0 0 4px;color:#4a5568;"><strong>Funding Round:</strong> Round {{ $round_number ?? '1' }}</p>
      @if(!empty($title))<p style="margin:0;color:#4a5568;"><strong>Proposal:</strong> {{ $title }}</p>@endif
    </div>
    <p style="color:#4a5568;">Please log in to the RTT platform to review and sign.</p>
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
