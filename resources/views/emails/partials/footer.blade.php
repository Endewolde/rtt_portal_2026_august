@php
    use App\Models\AppSetting;
    $emailFooterSettings = AppSetting::whereIn('key', ['organization_name', 'system_name'])
        ->pluck('value', 'key');
    $emailFooterOrgName     = $emailFooterSettings->get('organization_name', 'Research Office');
    $emailFooterSystemName  = $emailFooterSettings->get('system_name', 'RTT Platform');
@endphp
<div style="background:#f7fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">{{ $emailFooterSystemName }} — {{ $emailFooterOrgName }} Research Office</p>
</div>
