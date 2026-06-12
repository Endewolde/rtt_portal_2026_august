@php
    use App\Models\AppSetting;
    $emailHeaderSettings = AppSetting::whereIn('key', ['organization_name', 'system_logo', 'system_name'])
        ->pluck('value', 'key');
    $emailOrgName   = $emailHeaderSettings->get('organization_name', 'Research Office');
    $emailLogoPath  = $emailHeaderSettings->get('system_logo');
    $emailLogoUrl   = $emailLogoPath ? url($emailLogoPath) : null;
@endphp
<div style="background:#1a365d;padding:24px;text-align:center;">
    @if($emailLogoUrl)
    <img src="{{ $emailLogoUrl }}" alt="{{ $emailOrgName }}" style="height:52px;width:auto;display:block;margin:0 auto 10px;border-radius:4px;">
    @endif
    <h1 style="color:#fff;margin:0;font-size:20px;">Research &amp; Technology Transfer</h1>
    <p style="color:#90cdf4;margin:4px 0 0;">{{ $emailOrgName }}</p>
</div>
