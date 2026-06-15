<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Budget Allocated</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#0f766e,#0891b2);padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .amount-box{background:linear-gradient(135deg,#f0fdfa,#ecfeff);border:2px solid #99f6e4;border-radius:16px;padding:28px;text-align:center;margin:20px 0;}
  .amount-label{font-size:11px;font-weight:700;color:#0f766e;letter-spacing:.09em;text-transform:uppercase;margin:0 0 10px;}
  .amount-val{font-size:36px;font-weight:900;color:#0f766e;margin:0;line-height:1;}
  .amount-currency{font-size:18px;font-weight:700;color:#0e7490;margin-right:4px;}
  .detail{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:20px 0;}
  .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#64748b;font-weight:500;}
  .cta{text-align:center;margin:28px 0 8px;}
  .btn{display:inline-block;background:linear-gradient(135deg,#0f766e,#0891b2);color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;}
  .cta-sub{font-size:12px;color:#94a3b8;margin-top:10px;}
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
  <div class="hero" style="background-color:#0f766e;">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    </div>
    <h1>Budget Allocated</h1>
    <p>Funding has been assigned to your proposal</p>
    <span class="badge">✓ Allocated</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $recipient->name ?? 'Researcher' }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      A budget has been <strong>allocated to your proposal</strong> for the upcoming fiscal year.
      You may now proceed to submit your budget request on the platform.
    </p>

    @if(!empty($allocated_amount))
    <div class="amount-box">
      <p class="amount-label">Allocated Amount</p>
      <p class="amount-val"><span class="amount-currency">ETB</span>{{ number_format($allocated_amount, 2) }}</p>
    </div>
    @endif

    @if(!empty($title) || !empty($fiscal_year))
    <div class="detail">
      @if(!empty($title))
      <div class="row"><label>Proposal</label><span style="font-weight:600;color:#0f172a;text-align:right;max-width:60%;">{{ $title }}</span></div>
      @endif
      @if(!empty($fiscal_year))
      <div class="row"><label>Fiscal Year</label><span style="font-weight:700;color:#0f766e;">{{ $fiscal_year }}</span></div>
      @endif
    </div>
    @endif

    <div class="cta">
      <a href="{{ config('app.url') }}" class="btn">Submit Budget Request →</a>
      <p class="cta-sub">Log in to the platform to submit your budget request.</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Sent via <strong>{{ $platformName }}</strong>. Contact the {{ $orgName }} Finance Office if you have questions about your allocation.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
