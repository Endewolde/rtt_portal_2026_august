<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Review Assignment</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#1a365d;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Research & Technology Transfer</h1>
    <p style="color:#90cdf4;margin:4px 0 0;">Haramaya University</p>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#2d3748;">New Review Assignment</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Reviewer' }},</p>
    <p style="color:#4a5568;">You have been assigned to review a proposal. Please complete your review by the due date.</p>
    <div style="background:#fffaf0;border-left:4px solid #d69e2e;padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0 0 8px;color:#4a5568;"><strong>Proposal:</strong> <code>{{ $tracker_number ?? 'N/A' }}</code></p>
      @if(!empty($due_date))
      <p style="margin:0;color:#4a5568;"><strong>Due Date:</strong> {{ $due_date }}</p>
      @endif
    </div>
    <p style="color:#4a5568;">Please log in to the RTT platform to begin your review.</p>
  </div>
  <div style="background:#f7fafc;padding:16px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">RTT Platform — Haramaya University Research Office</p>
  </div>
</div>
</body>
</html>
