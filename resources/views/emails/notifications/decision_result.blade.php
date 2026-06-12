<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Proposal Decision</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  @include('emails.partials.header')
  <div style="padding:32px;">
    <h2 style="color:#2d3748;">Proposal Decision</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    @php $decision = strtoupper($decision ?? 'PENDING'); @endphp
    <div style="background:{{ $decision === 'ACCEPTED' ? '#f0fff4' : '#fff5f5' }};border-left:4px solid {{ $decision === 'ACCEPTED' ? '#38a169' : '#e53e3e' }};padding:20px;margin:24px 0;border-radius:4px;text-align:center;">
      <p style="font-size:28px;font-weight:bold;color:{{ $decision === 'ACCEPTED' ? '#276749' : '#c53030' }};margin:0;">{{ $decision }}</p>
    </div>
    <p style="color:#4a5568;"><strong>Tracker:</strong> <code>{{ $tracker_number ?? 'N/A' }}</code></p>
    @if(!empty($reason))
    <div style="background:#f7fafc;padding:16px;border-radius:4px;margin-top:16px;">
      <p style="margin:0;color:#718096;font-size:14px;"><strong>Reason</strong></p>
      <p style="color:#4a5568;margin:8px 0 0;">{{ $reason }}</p>
    </div>
    @endif
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
