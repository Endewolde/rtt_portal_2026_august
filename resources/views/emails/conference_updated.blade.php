<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Conference Updated</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#1e40af,#4338ca);padding:36px 32px;text-align:center;}
  .hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.75);margin:0;font-size:13px;}
  .body{padding:32px;}
  .alert{background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:14px 18px;margin:0 0 20px;display:flex;gap:10px;align-items:flex-start;}
  .alert-icon{flex-shrink:0;color:#ca8a04;}
  .alert p{font-size:13px;color:#713f12;margin:0;line-height:1.5;}
  .conf-card{background:#f1f5f9;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin:20px 0;}
  .conf-card h2{margin:0 0 16px;font-size:17px;color:#0f172a;font-weight:700;}
  .meta-row{display:flex;align-items:center;gap:10px;font-size:13px;color:#374151;padding:6px 0;border-bottom:1px solid #e2e8f0;}
  .meta-row:last-child{border-bottom:none;}
  .meta-row strong{min-width:80px;color:#1e40af;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}
  .footer p{font-size:12px;color:#9ca3af;margin:0;}
</style>
</head>
<body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#1e40af;">
    <div class="hero-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <h1>Conference Update</h1>
    <p>Important changes to a conference you've registered for</p>
  </div>

  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $registration->name }}</strong>,</p>

    <div class="alert">
      <svg class="alert-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <p>The details for a conference you've registered for have been updated. Please review the latest information below.</p>
    </div>

    <div class="conf-card">
      <h2>{{ $conference->title }}</h2>
      <div class="meta-row">
        <strong>Date:</strong>
        <span>{{ $conference->start_date->format('l, d F Y') }}{{ $conference->end_date ? ' — '.$conference->end_date->format('d F Y') : '' }}</span>
      </div>
      <div class="meta-row">
        <strong>Time:</strong>
        <span>{{ $conference->start_date->format('H:i') }} {{ $conference->timezone }}</span>
      </div>
      <div class="meta-row">
        <strong>Format:</strong>
        <span>{{ ucfirst($conference->location_type) }}</span>
      </div>
      @if($conference->location_address)
      <div class="meta-row">
        <strong>Venue:</strong>
        <span>{{ $conference->location_address }}</span>
      </div>
      @endif
      @if($conference->virtual_link)
      <div class="meta-row">
        <strong>Join Link:</strong>
        <a href="{{ $conference->virtual_link }}" style="color:#1e40af;">{{ $conference->virtual_link }}</a>
      </div>
      @endif
    </div>

    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:20px 0;">
      Your registration is still confirmed and no action is required.
      If you have any questions, please contact the conference organizers.
    </p>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      You received this update because you are registered for this event via <strong>{{ $senderName }}</strong>.
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</p>
  </div>
</div>
</body>
</html>
