<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Budget Allocated</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#1a365d;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Research & Technology Transfer</h1>
  </div>
  <div style="padding:32px;">
    <h2 style="color:#2d3748;">Budget Allocated</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <p style="color:#4a5568;">A budget has been allocated to your proposal for the upcoming fiscal year.</p>
    <div style="background:#ebf8ff;border-left:4px solid #3182ce;padding:16px;margin:24px 0;border-radius:4px;">
      @if(!empty($title))<p style="margin:0 0 8px;color:#4a5568;"><strong>Proposal:</strong> {{ $title }}</p>@endif
      @if(!empty($allocated_amount))<p style="margin:0 0 8px;color:#4a5568;"><strong>Amount:</strong> ETB {{ number_format($allocated_amount, 2) }}</p>@endif
      @if(!empty($fiscal_year))<p style="margin:0;color:#4a5568;"><strong>Fiscal Year:</strong> {{ $fiscal_year }}</p>@endif
    </div>
    <p style="color:#4a5568;">Please log in to the RTT platform to submit your budget request.</p>
  </div>
  <div style="background:#f7fafc;padding:16px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">RTT Platform — Haramaya University Research Office</p>
  </div>
</div>
</body>
</html>
