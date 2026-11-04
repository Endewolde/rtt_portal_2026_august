<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your certificate</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);}.hero{background:#0b3a66;padding:28px 32px;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.8);margin:0;font-size:13px;}.body{padding:28px 32px;}.btn{display:inline-block;background:#0b3a66;color:#fff !important;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;}.code{font-family:monospace;font-size:13px;color:#374151;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin:0 0 20px;text-align:center;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero"><h1>Your certificate is ready</h1><p>{{ $conference->title }}</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px;">Dear {{ $certificate->recipient_name }}, thank you for
      @if($certificate->kind === 'attendance') attending
      @elseif($certificate->kind === 'presentation') presenting at
      @else reviewing abstracts for
      @endif
      {{ $conference->title }}. Your certificate {{ ['attendance' => 'of attendance', 'presentation' => 'of presentation', 'reviewer' => 'of appreciation for peer review'][$certificate->kind] }} can be downloaded below.</p>
    <p style="text-align:center;margin:0 0 20px;"><a class="btn" href="{{ $url }}">Download your certificate (PDF)</a></p>
    <p class="code">Certificate No. {{ $certificate->code }}</p>
    <p style="font-size:12px;color:#6b7280;line-height:1.6;margin:0;">Anyone can confirm it is genuine by scanning its QR code or entering the number at {{ rtrim(config('app.url'), '/') }}/certificates/verify.</p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
