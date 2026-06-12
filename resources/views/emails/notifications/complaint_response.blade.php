<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Complaint Response</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  @include('emails.partials.header')
  <div style="padding:32px;">
    <h2 style="color:#2d3748;">Complaint Response</h2>
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <p style="color:#4a5568;">Your complaint regarding proposal <strong>{{ $tracker_number ?? 'N/A' }}</strong> has been responded to.</p>
    @if(!empty($resolution))
    <div style="background:{{ $resolution === 'resolved' ? '#f0fff4' : '#fff5f5' }};border-left:4px solid {{ $resolution === 'resolved' ? '#38a169' : '#e53e3e' }};padding:16px;margin:24px 0;border-radius:4px;">
      <p style="margin:0;font-weight:bold;color:{{ $resolution === 'resolved' ? '#276749' : '#c53030' }};">{{ ucfirst($resolution ?? '') }}</p>
    </div>
    @endif
    @if(!empty($response))
    <div style="background:#f7fafc;padding:16px;border-radius:4px;">
      <p style="margin:0 0 8px;color:#718096;font-size:14px;"><strong>Response from {{ $resolved_by ?? 'Officer' }}</strong></p>
      <p style="color:#4a5568;margin:0;">{{ $response }}</p>
    </div>
    @endif
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
