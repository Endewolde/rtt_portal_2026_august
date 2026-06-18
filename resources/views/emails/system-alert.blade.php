<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>System Alert</title>
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .wrap { max-width:580px; margin:40px auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,.08); }
  .header-critical { background:linear-gradient(135deg,#7f1d1d,#dc2626); padding:32px; text-align:center; }
  .header-warning  { background:linear-gradient(135deg,#78350f,#d97706); padding:32px; text-align:center; }
  .header-anomaly  { background:linear-gradient(135deg,#1e1b4b,#7c3aed); padding:32px; text-align:center; }
  .header-info     { background:linear-gradient(135deg,#1e3a5f,#2563eb); padding:32px; text-align:center; }
  .header-icon { width:54px; height:54px; background:rgba(255,255,255,.15); border-radius:14px;
                 display:inline-flex; align-items:center; justify-content:center; margin:0 auto 14px; font-size:26px; }
  .header h1 { color:#fff; font-size:20px; font-weight:700; margin:0 0 4px; }
  .header p  { color:rgba(255,255,255,.75); font-size:13px; margin:0; }
  .body { padding:32px; }
  .greeting { font-size:15px; color:#111827; font-weight:600; margin:0 0 12px; }
  p  { font-size:14px; color:#6b7280; line-height:1.7; margin:0 0 16px; }
  .alert-box { border-radius:12px; padding:18px 20px; margin:20px 0; }
  .alert-box.critical { background:#fef2f2; border-left:4px solid #dc2626; }
  .alert-box.warning  { background:#fffbeb; border-left:4px solid #d97706; }
  .alert-box.anomaly  { background:#f5f3ff; border-left:4px solid #7c3aed; }
  .alert-box .label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.08em; margin:0 0 6px; }
  .alert-box.critical .label { color:#dc2626; }
  .alert-box.warning  .label { color:#d97706; }
  .alert-box.anomaly  .label { color:#7c3aed; }
  .alert-box .text { font-size:14px; font-weight:600; color:#111827; margin:0; }
  .meta-table { width:100%; border-collapse:collapse; margin:20px 0; font-size:13px; }
  .meta-table td { padding:8px 0; border-bottom:1px solid #f3f4f6; color:#6b7280; }
  .meta-table td:first-child { font-weight:600; color:#374151; width:40%; }
  .cta { display:inline-block; background:#2563eb; color:#fff !important; text-decoration:none;
         font-size:14px; font-weight:600; padding:12px 28px; border-radius:10px; margin:20px 0; }
  .note { font-size:12px; color:#9ca3af; background:#f9fafb; border-radius:10px; padding:14px 16px; margin-top:20px; }
  .divider { border:none; border-top:1px solid #e5e7eb; margin:24px 0; }
  .footer { background:#f8fafc; border-top:1px solid #e5e7eb; padding:20px 32px; text-align:center; font-size:12px; color:#9ca3af; }
</style>
</head>
<body>
<div class="wrap">

  @php
    $headerClass = $isAnomaly ? 'header-anomaly' : ($severity === 'critical' ? 'header-critical' : ($severity === 'warning' ? 'header-warning' : 'header-info'));
    $icon = $isAnomaly ? '🔍' : ($severity === 'critical' ? '🚨' : '⚠️');
    $typeLabel = $isAnomaly ? 'Anomaly Detected' : "System Alert — {$severityLabel}";
  @endphp

  <div class="{{ $headerClass }} header">
    <div class="header-icon">{{ $icon }}</div>
    <h1>{{ $typeLabel }}</h1>
    <p>RTT Platform · System Monitor</p>
  </div>

  <div class="body">
    <p class="greeting">Hello, {{ $user->name }}.</p>
    <p>
      @if($isAnomaly)
        An anomaly has been automatically detected in the RTT Platform system metrics. This may indicate unusual activity or a developing performance issue.
      @else
        A system alert has been triggered on the RTT Platform. Immediate attention may be required.
      @endif
    </p>

    <div class="alert-box {{ $isAnomaly ? 'anomaly' : ($severity === 'critical' ? 'critical' : 'warning') }}">
      <p class="label">{{ $isAnomaly ? 'Anomaly' : $severityLabel }}</p>
      <p class="text">{{ $alertMessage }}</p>
    </div>

    <table class="meta-table">
      <tr>
        <td>Type</td>
        <td>{{ str_replace(['.','_'], [' → ', ' '], $alertType) }}</td>
      </tr>
      @if($isAnomaly && $anomalyType)
      <tr>
        <td>Anomaly Pattern</td>
        <td>{{ str_replace('_', ' ', $anomalyType) }}</td>
      </tr>
      @endif
      @if($context)
        @foreach($context as $key => $val)
        <tr>
          <td>{{ ucfirst(str_replace('_', ' ', $key)) }}</td>
          <td>{{ is_numeric($val) ? number_format($val, 2) : $val }}</td>
        </tr>
        @endforeach
      @endif
      <tr>
        <td>Triggered at</td>
        <td>{{ now()->format('d M Y, H:i:s') }} UTC</td>
      </tr>
    </table>

    <a href="{{ $dashboardUrl }}" class="cta">View System Monitor →</a>

    <hr class="divider">

    <div class="note">
      You are receiving this alert because you are a super administrator of the RTT Platform.
      You can adjust your alert preferences from the System Monitor dashboard.
    </div>
  </div>

  <div class="footer">
    RTT Research Management Platform &nbsp;·&nbsp; Do not reply to this email
  </div>
</div>
</body>
</html>
