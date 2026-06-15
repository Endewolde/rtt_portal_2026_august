@php
  use App\Models\AppSetting;
  $emailHeaderSettings = AppSetting::whereIn('key', ['organization_name','system_logo','system_name'])
      ->pluck('value', 'key');
  $emailOrgName    = $emailHeaderSettings->get('organization_name', 'Research Office');
  $emailLogoPath   = $emailHeaderSettings->get('system_logo');
  $emailLogoUrl    = $emailLogoPath ? url($emailLogoPath) : null;
  $emailSystemName = $emailHeaderSettings->get('system_name', 'RTT Platform');
@endphp
<div style="background:linear-gradient(135deg,#1a365d,#1e40af);padding:28px 32px;text-align:center;">
  @if($emailLogoUrl)
  <img src="{{ $emailLogoUrl }}" alt="{{ $emailOrgName }}" style="height:48px;width:auto;display:block;margin:0 auto 12px;border-radius:6px;">
  @endif
  <h1 style="color:#ffffff;margin:0 0 4px;font-size:20px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{{ $emailSystemName }}</h1>
  <p style="color:rgba(255,255,255,.7);margin:0;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">{{ $emailOrgName }} &mdash; Research &amp; Technology Transfer</p>
</div>
