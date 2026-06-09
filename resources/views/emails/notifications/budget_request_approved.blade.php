<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Budget Request Approved</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">

  <div style="background:#276749;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Budget Request Approved</h1>
    <p style="color:#c6f6d5;margin:4px 0 0;">Research &amp; Technology Transfer — Haramaya University</p>
  </div>

  <div style="padding:32px;">
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <p style="color:#4a5568;">
      We are pleased to inform you that the budget request for your research proposal
      has been <strong style="color:#276749;">approved</strong> by the college.
    </p>

    <div style="background:#f0fff4;border:1px solid #9ae6b4;padding:20px;margin:24px 0;border-radius:8px;">
      @if(!empty($tracker_number))
      <p style="margin:0 0 8px;font-size:13px;color:#2b6cb0;font-weight:bold;">Tracker Number</p>
      <p style="font-size:22px;font-family:monospace;color:#276749;font-weight:bold;margin:0 0 12px;">{{ $tracker_number }}</p>
      @endif
      @if(!empty($title))
      <p style="margin:0 0 6px;color:#4a5568;font-size:14px;"><strong>Proposal:</strong> {{ $title }}</p>
      @endif
      @if(!empty($round_number))
      <p style="margin:0 0 6px;color:#4a5568;font-size:14px;"><strong>Funding Round:</strong> {{ $round_number }}</p>
      @endif
      @if(!empty($requested_amount))
      <p style="margin:0;color:#4a5568;font-size:14px;"><strong>Approved Amount:</strong> ETB {{ number_format($requested_amount, 2) }}</p>
      @endif
    </div>

    @if(!empty($notes))
    <div style="background:#fffbeb;border-left:4px solid #d69e2e;padding:16px;margin-bottom:24px;border-radius:4px;">
      <p style="margin:0 0 6px;font-size:13px;color:#744210;font-weight:bold;">College Review Notes</p>
      <p style="margin:0;color:#4a5568;font-size:14px;">{{ $notes }}</p>
    </div>
    @endif

    <div style="background:#f7fafc;padding:16px;border-radius:4px;">
      <p style="margin:0 0 8px;color:#718096;font-size:14px;font-weight:bold;">Next Steps</p>
      <ol style="color:#4a5568;font-size:14px;padding-left:20px;margin:0;">
        <li>The Finance Office will process the disbursement based on the approved budget.</li>
        <li>You will be notified once the funds are disbursed to your account.</li>
        <li>Ensure all expenditures are properly documented for future settlement reporting.</li>
      </ol>
    </div>
  </div>

  <div style="background:#f7fafc;padding:16px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">RTT Platform — Haramaya University Research Office</p>
  </div>
</div>
</body>
</html>
