<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Co-Investigator Invitation</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">

  @include('emails.partials.header')

  <div style="padding:32px;">
    <h2 style="color:#2d3748;">You Are a Co-Investigator</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <p style="color:#4a5568;">
      This is to inform you that you have been listed as a <strong>Co-Investigator</strong>
      on a research proposal that has been successfully submitted by
      <strong>{{ $pi_name ?? 'the Principal Investigator' }}</strong>.
    </p>

    <div style="background:#ebf8ff;border-left:4px solid #3182ce;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0 0 6px;font-size:13px;color:#2b6cb0;font-weight:bold;">Proposal Details</p>
      @if(!empty($tracker_number))
      <p style="margin:0 0 6px;font-size:22px;font-family:monospace;color:#1a365d;font-weight:bold;">{{ $tracker_number }}</p>
      @endif
      @if(!empty($title))
      <p style="margin:0;color:#4a5568;font-size:14px;"><strong>Title:</strong> {{ $title }}</p>
      @endif
    </div>

    <div style="background:#f0fff4;border-left:4px solid #38a169;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0;color:#2f855a;font-size:14px;"><strong>What this means for you:</strong></p>
      <ul style="color:#4a5568;font-size:14px;padding-left:20px;margin:8px 0 0;">
        <li>You may be required to sign budget request documents during the funding phase.</li>
        <li>You will receive email updates on the proposal's progress.</li>
        <li>Log in to the RTT Platform to view proposal details using your tracker number.</li>
      </ul>
    </div>

    <p style="color:#4a5568;font-size:14px;">
      If you believe this is an error or were not informed about this proposal,
      please contact the Principal Investigator or the Research Office.
    </p>
  </div>

  @include('emails.partials.footer')
</div>
</body>
</html>
