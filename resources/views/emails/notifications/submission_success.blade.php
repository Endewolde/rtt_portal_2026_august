<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Proposal Submitted</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  @include('emails.partials.header')
  <div style="padding:32px;">
    <h2 style="color:#2d3748;">Proposal Submitted Successfully</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <p style="color:#4a5568;">Your proposal has been successfully submitted and is now awaiting validation.</p>
    <div style="background:#ebf8ff;border-left:4px solid #3182ce;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0;font-size:13px;color:#2b6cb0;">Tracker Number</p>
      <p style="margin:8px 0 0;font-size:24px;font-family:monospace;color:#1a365d;font-weight:bold;">{{ $tracker_number ?? 'N/A' }}</p>
    </div>
    @if(!empty($title))
    <p style="color:#4a5568;"><strong>Title:</strong> {{ $title }}</p>
    @endif
    <p style="color:#4a5568;"><strong>Submitted:</strong> {{ now()->format('d M Y, H:i') }}</p>
    <div style="background:#f7fafc;padding:16px;border-radius:4px;margin-top:24px;">
      <p style="margin:0;color:#718096;font-size:14px;"><strong>Next Steps</strong></p>
      <ol style="color:#4a5568;font-size:14px;padding-left:20px;">
        <li>Your proposal will be reviewed for completeness by the Central Office.</li>
        <li>You will receive a notification once validation is complete.</li>
        <li>Use your tracker number to check your proposal status at any time.</li>
      </ol>
    </div>
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
