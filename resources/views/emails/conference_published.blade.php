<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conference Published</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#065f46,#0e7490);padding:36px 32px;text-align:center;}
  .hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.75);margin:0;font-size:13px;}
  .body{padding:32px;}
  .conf-title{font-size:20px;font-weight:700;color:#0f172a;margin:0 0 20px;line-height:1.3;}
  .meta{display:flex;flex-direction:column;gap:8px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px;margin:18px 0;}
  .meta-row{font-size:13px;color:#374151;display:flex;gap:8px;align-items:flex-start;}
  .meta-row strong{color:#065f46;min-width:80px;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}
  .footer p{font-size:12px;color:#9ca3af;margin:0;}
</style>
</head>
<body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#065f46;">
    <div class="hero-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
    </div>
    <h1>Conference Published</h1>
    <p>A new conference is now live on the platform</p>
  </div>

  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Hi <strong>{{ $admin->name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 20px;">
      The following conference has been published and is now visible to the public.
    </p>

    <div class="conf-title">{{ $conference->title }}</div>

    <div class="meta">
      <div class="meta-row">
        <strong>Date:</strong>
        <span>{{ $conference->start_date->format('d M Y') }}{{ $conference->end_date ? ' — '.$conference->end_date->format('d M Y') : '' }}</span>
      </div>
      <div class="meta-row">
        <strong>Time:</strong>
        <span>{{ $conference->start_date->format('H:i') }} {{ $conference->timezone }}</span>
      </div>
      <div class="meta-row">
        <strong>Type:</strong>
        <span>{{ ucfirst($conference->location_type) }}</span>
      </div>
      @if($conference->location_address)
      <div class="meta-row">
        <strong>Venue:</strong>
        <span>{{ $conference->location_address }}</span>
      </div>
      @endif
      @if($conference->max_capacity)
      <div class="meta-row">
        <strong>Capacity:</strong>
        <span>{{ number_format($conference->max_capacity) }} attendees</span>
      </div>
      @endif
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      This notification was sent because you are an administrator of <strong>{{ $senderName }}</strong>.
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</p>
  </div>
</div>
</body>
</html>
