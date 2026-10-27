<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your conference abstracts</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}.hero{background:linear-gradient(135deg,#7c3aed,#4338ca);padding:32px;text-align:center;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.8);margin:0;font-size:13px;}.body{padding:32px;}.btn{display:inline-block;background:#4338ca;color:#fff !important;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:12px;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#7c3aed;"><h1>Your conference abstracts</h1><p>Track, edit or withdraw your submissions</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 22px;">Someone — hopefully you — asked to see the abstracts submitted with this email address. Open them with the button below.</p>
    <p style="text-align:center;margin:0 0 22px;"><a class="btn" href="{{ $url }}">View my abstracts</a></p>
    <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0;">The link works for 24 hours. If you did not ask for it, you can ignore this email — nothing has changed.</p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
