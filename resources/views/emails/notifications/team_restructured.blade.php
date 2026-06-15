<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Team Update</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#1e3a5f,#1e40af);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .body{padding:36px 32px;}
  .tracker-row{background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;margin:16px 0;}
  .tracker-label{font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.06em;}
  .tracker-val{font-size:14px;font-family:monospace;color:#1e3a5f;font-weight:700;}
  .change-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin:20px 0;}
  .change-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 14px;}
  .change-row{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}
  .change-row:last-child{border-bottom:none;}
  .change-dot{width:8px;height:8px;border-radius:50%;background:#1e40af;margin-top:4px;flex-shrink:0;}
  .change-label{color:#64748b;font-weight:500;min-width:80px;}
  .change-val{color:#0f172a;font-weight:600;}
  .action-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;}
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

  $actionText  = $action ?? '';
  $isAdded     = str_contains(strtolower($actionText), 'add');
  $isRemoved   = str_contains(strtolower($actionText), 'remov');
  $actionColor = $isAdded ? '#166534' : ($isRemoved ? '#991b1b' : '#1e40af');
  $actionBg    = $isAdded ? '#f0fdf4' : ($isRemoved ? '#fef2f2' : '#eff6ff');
  $actionBorder= $isAdded ? '#86efac' : ($isRemoved ? '#fca5a5' : '#bfdbfe');
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#1e3a5f;">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
    <h1>Team Update</h1>
    <p>A change has been made to your proposal team</p>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $recipient->name ?? 'Team Member' }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      There has been a team update on the following proposal. Please review the details below.
    </p>

    @if(!empty($tracker_number))
    <div class="tracker-row">
      <span class="tracker-label">Tracker Number</span>
      <span class="tracker-val">{{ $tracker_number }}</span>
    </div>
    @endif

    @if(!empty($member_name) || !empty($actionText))
    <div class="change-card">
      <p class="change-title">Change Details</p>
      @if(!empty($member_name))
      <div class="change-row">
        <div class="change-dot"></div>
        <span class="change-label">Member</span>
        <span class="change-val">{{ $member_name }}</span>
      </div>
      @endif
      @if(!empty($actionText))
      <div class="change-row">
        <div class="change-dot"></div>
        <span class="change-label">Action</span>
        <span>
          <span class="action-badge" style="background:{{ $actionBg }};color:{{ $actionColor }};border:1px solid {{ $actionBorder }};">
            {{ $actionText }}
          </span>
        </span>
      </div>
      @endif
    </div>
    @endif

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      You received this notification because you are a member of this proposal on <strong>{{ $platformName }}</strong>.
      Contact the {{ $orgName }} Research Office if you have questions.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
