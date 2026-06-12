<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>New Conference Registration</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:36px 32px;display:flex;align-items:center;gap:20px;}
  .hero-icon{width:52px;height:52px;border-radius:14px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .hero-text h1{color:#fff;margin:0 0 4px;font-size:19px;font-weight:700;}
  .hero-text p{color:rgba(255,255,255,.65);margin:0;font-size:13px;}
  .body{padding:32px;}
  .alert-badge{display:inline-flex;align-items:center;gap:6px;background:#fef3c7;border:1px solid #fcd34d;color:#92400e;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:5px 12px;border-radius:999px;margin-bottom:20px;}
  .registrant-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:20px;margin:16px 0;}
  .registrant-card h3{margin:0 0 14px;font-size:14px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:.04em;}
  .field{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13px;}
  .field:last-child{border-bottom:none;}
  .field label{color:#64748b;font-weight:500;}
  .field value{color:#0f172a;font-weight:600;text-align:right;}
  .conf-pill{display:inline-block;background:#4338ca;color:#fff;font-size:13px;font-weight:600;padding:10px 18px;border-radius:10px;margin:16px 0;}
  .stats-row{display:flex;gap:12px;margin:20px 0;}
  .stat{flex:1;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;text-align:center;}
  .stat-num{font-size:24px;font-weight:700;color:#0f172a;}
  .stat-label{font-size:11px;color:#64748b;margin-top:2px;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}
  .footer p{font-size:12px;color:#9ca3af;margin:0;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="hero-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
    <div class="hero-text">
      <h1>New Registration</h1>
      <p>Someone just registered for a conference</p>
    </div>
  </div>

  <div class="body">
    <span class="alert-badge">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      New Registration Alert
    </span>

    <p style="font-size:14px;color:#374151;margin:0 0 4px;">Hi <strong>{{ $admin->name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;margin:0 0 20px;line-height:1.7;">A new participant has registered for the conference below.</p>

    <div class="conf-pill">{{ $conference->title }}</div>

    <div class="registrant-card">
      <h3>Registrant Details</h3>
      <div class="field"><label>Name</label><span style="color:#0f172a;font-weight:600;">{{ $registration->name }}</span></div>
      <div class="field"><label>Email</label><span style="color:#0f172a;font-weight:600;">{{ $registration->email }}</span></div>
      @if($registration->organization)
      <div class="field"><label>Organization</label><span style="color:#0f172a;font-weight:600;">{{ $registration->organization }}</span></div>
      @endif
      @if($registration->phone)
      <div class="field"><label>Phone</label><span style="color:#0f172a;font-weight:600;">{{ $registration->phone }}</span></div>
      @endif
      <div class="field"><label>Registered At</label><span style="color:#0f172a;font-weight:600;">{{ $registration->registered_at?->format('d M Y, H:i') ?? now()->format('d M Y, H:i') }}</span></div>
    </div>

    @php
      $totalRegistrations = $conference->registrations()->whereIn('status', ['pending','confirmed'])->count();
      $capacity = $conference->max_capacity;
    @endphp

    <div class="stats-row">
      <div class="stat">
        <div class="stat-num">{{ $totalRegistrations }}</div>
        <div class="stat-label">Total Registrations</div>
      </div>
      @if($capacity)
      <div class="stat">
        <div class="stat-num">{{ $capacity - $totalRegistrations }}</div>
        <div class="stat-label">Spots Remaining</div>
      </div>
      <div class="stat">
        <div class="stat-num">{{ round(($totalRegistrations / $capacity) * 100) }}%</div>
        <div class="stat-label">Capacity Used</div>
      </div>
      @endif
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      You received this notification because you are an administrator of <strong>{{ $senderName }}</strong>.
    </p>
  </div>

  <div class="footer">
    <p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</p>
  </div>
</div>
</body>
</html>
