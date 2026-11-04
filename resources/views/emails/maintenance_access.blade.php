<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Maintenance access link</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);}.hero{background:#0b3a66;padding:28px 32px;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.8);margin:0;font-size:13px;}.body{padding:28px 32px;}.btn{display:inline-block;background:#0b3a66;color:#fff !important;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;}.facts{width:100%;border-collapse:collapse;margin:0 0 22px;}.facts td{padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;}.facts td.k{color:#6b7280;width:38%;}.link{word-break:break-all;font-size:12px;color:#475569;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin:0 0 20px;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero"><h1>Maintenance is on</h1><p>Your administrator access link for {{ $systemName }}</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px;">Hello {{ $name }}, {{ $systemName }} has been put into maintenance. Everyone else now sees the maintenance page. Open the link below to keep working while it is on.</p>
    <table class="facts" role="presentation">
      <tr><td class="k">Switched on by</td><td>{{ $enabledBy }}</td></tr>
      <tr><td class="k">Started</td><td>{{ $startedAt }}</td></tr>
    </table>
    <p style="text-align:center;margin:0 0 20px;"><a class="btn" href="{{ $url }}">Open {{ $systemName }}</a></p>
    <p class="link">{{ $url }}</p>
    <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0;">The link works only for administrators and only until maintenance is switched off; a new link is sent each time it is switched on. Do not forward it.</p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
