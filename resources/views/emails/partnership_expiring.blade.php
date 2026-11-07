<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agreement ending soon</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);}.hero{background:#92400e;padding:28px 32px;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.85);margin:0;font-size:13px;}.body{padding:28px 32px;}.btn{display:inline-block;background:#0b3a66;color:#fff !important;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;}.facts{width:100%;border-collapse:collapse;margin:0 0 22px;}.facts td{padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;}.facts td.k{color:#6b7280;width:38%;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero"><h1>An agreement ends soon</h1><p>{{ $partnership->partner_name }}</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 18px;">Dear {{ $name }}, the agreement below ends on <strong>{{ $partnership->expires_on->format('l j F Y') }}</strong> — in {{ (int) now()->startOfDay()->diffInDays($partnership->expires_on) }} days. Renew it, or record that it will end.</p>
    <table class="facts" role="presentation">
      <tr><td class="k">Partner</td><td>{{ $partnership->partner_name }}@if($partnership->country) ({{ $partnership->country }})@endif</td></tr>
      <tr><td class="k">Agreement</td><td>{{ strtoupper($partnership->agreement_type) }}@if($partnership->title) — {{ $partnership->title }}@endif</td></tr>
      @if($partnership->signed_on)<tr><td class="k">Signed</td><td>{{ $partnership->signed_on->format('j F Y') }}</td></tr>@endif
      @if($partnership->focalPerson)<tr><td class="k">Focal person</td><td>{{ $partnership->focalPerson->name }}</td></tr>@endif
    </table>
    <p style="text-align:center;margin:0;"><a class="btn" href="{{ $url }}">Open the partnerships register</a></p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
