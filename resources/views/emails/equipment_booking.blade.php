<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ $booking->equipment->name }}</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);}.hero{background:#0b3a66;padding:28px 32px;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.85);margin:0;font-size:13px;}.body{padding:28px 32px;}.btn{display:inline-block;background:#0b3a66;color:#fff !important;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;}.facts{width:100%;border-collapse:collapse;margin:0 0 22px;}.facts td{padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;}.facts td.k{color:#6b7280;width:38%;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero"><h1>
    @if($kind === 'request') A booking request is waiting for you
    @elseif($booking->status === 'approved') Your booking is confirmed
    @else Your booking could not be confirmed
    @endif</h1><p>{{ $booking->equipment->name }}</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 18px;">Dear {{ $name }},</p>
    <table class="facts" role="presentation">
      <tr><td class="k">Equipment</td><td>{{ $booking->equipment->name }}@if($booking->equipment->location) — {{ $booking->equipment->location }}@endif</td></tr>
      <tr><td class="k">When</td><td>{{ $booking->starts_at->format('D j M Y, H:i') }} – {{ $booking->ends_at->format($booking->starts_at->isSameDay($booking->ends_at) ? 'H:i' : 'D j M Y, H:i') }}</td></tr>
      @if($kind === 'request')<tr><td class="k">Requested by</td><td>{{ $booking->user->name }}</td></tr>@endif
      <tr><td class="k">For</td><td>{{ $booking->purpose }}</td></tr>
      @if($booking->decision_note)<tr><td class="k">Note</td><td>{{ $booking->decision_note }}</td></tr>@endif
    </table>
    <p style="text-align:center;margin:0;"><a class="btn" href="{{ $url }}">{{ $kind === 'request' ? 'Approve or decline' : 'See your bookings' }}</a></p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
