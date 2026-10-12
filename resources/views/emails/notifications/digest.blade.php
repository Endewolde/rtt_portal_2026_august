<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>RTT Platform Notification Digest</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#1a365d,#1e40af);padding:36px 32px;text-align:center;}
  .hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.18);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.75);margin:0;font-size:13px;}
  .body{padding:32px;}
  .item{padding:14px 16px;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:10px;}
  .item-type{font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.04em;margin:0 0 4px;}
  .item-detail{font-size:13px;color:#4b5563;margin:0;}
  .item-time{font-size:11px;color:#9ca3af;margin:4px 0 0;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
@php
  use App\Models\AppSetting;
  $s = AppSetting::whereIn('key', ['organization_name','system_name'])->pluck('value','key');
  $platformName = $s->get('system_name', 'RTT Platform');
  $orgName      = $s->get('organization_name', 'Research Office');
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#1a365d;">
    <div class="hero-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </div>
    <h1>{{ ucfirst($frequency) }} Digest</h1>
    <p>{{ $platformName }} — {{ $orgName }}</p>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $user->name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      Here's a summary of your {{ count($items) }} update{{ count($items) === 1 ? '' : 's' }} since your last {{ $frequency }} digest.
    </p>

    @foreach ($items as $item)
      <div class="item">
        <p class="item-type">{{ str_replace('_', ' ', $item->type) }}</p>
        @php $data = is_string($item->data) ? json_decode($item->data, true) : (array) $item->data; @endphp
        <p class="item-detail">
          {{ $data['tracker_number'] ?? '' }}{{ isset($data['tracker_number'], $data['title']) ? ' — ' : '' }}{{ $data['title'] ?? '' }}
        </p>
        <p class="item-time">{{ \Illuminate\Support\Carbon::parse($item->created_at)->format('d M Y, g:i A') }}</p>
      </div>
    @endforeach

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      You're receiving this because your notification preferences are set to a {{ $frequency }} digest instead of real-time email.
      You can change this any time from your profile settings.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research Office
  </div>
</div>
</body>
</html>
