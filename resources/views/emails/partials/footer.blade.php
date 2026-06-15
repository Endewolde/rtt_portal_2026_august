@php
  use App\Models\AppSetting;
  $emailFooterSettings = AppSetting::whereIn('key', ['organization_name','system_name'])
      ->pluck('value', 'key');
  $emailFooterOrgName    = $emailFooterSettings->get('organization_name', 'Research Office');
  $emailFooterSystemName = $emailFooterSettings->get('system_name', 'RTT Platform');
@endphp
<div style="background:#f8fafc;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
  <p style="color:#9ca3af;font-size:12px;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    &copy; {{ date('Y') }} <strong style="color:#6b7280;">{{ $emailFooterSystemName }}</strong>
    &middot; {{ $emailFooterOrgName }} Research &amp; Technology Transfer
  </p>
</div>
