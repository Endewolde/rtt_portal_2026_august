<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Congratulations — Proposal Funded</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#064e3b,#065f46);padding:44px 32px;text-align:center;}
  .hero-icon{width:72px;height:72px;border-radius:18px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:26px;font-weight:900;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:15px;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;padding:6px 18px;border-radius:999px;margin-top:16px;}
  .body{padding:36px 32px;}
  .award-card{background:linear-gradient(135deg,#f0fdf4,#ecfdf5);border:2px solid #6ee7b7;border-radius:16px;padding:28px;margin:20px 0;}
  .grant-label{font-size:11px;font-weight:700;color:#065f46;letter-spacing:.09em;text-transform:uppercase;margin:0 0 8px;}
  .grant-ref{font-size:24px;font-family:monospace;font-weight:800;color:#065f46;letter-spacing:.06em;margin:0 0 18px;}
  .row{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #a7f3d0;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#065f46;font-weight:500;}
  .amount-highlight{font-size:20px;font-weight:900;color:#064e3b;}
  .contact-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:22px;margin:22px 0;}
  .contact-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 14px;}
  .contact-item{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:#374151;line-height:1.55;margin-bottom:8px;}
  .contact-item:last-child{margin-bottom:0;}
  .contact-dot{width:6px;height:6px;border-radius:50%;background:#059669;margin-top:5px;flex-shrink:0;}
  .note{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin:20px 0;display:flex;gap:10px;align-items:flex-start;}
  .note p{font-size:13px;color:#166534;margin:0;line-height:1.6;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
@php
  use App\Models\AppSetting;
  $s = AppSetting::whereIn('key', ['organization_name','system_name','mail_from_address'])->pluck('value','key');
  $platformName  = $s->get('system_name', 'RTT Platform');
  $orgName       = $s->get('organization_name', 'Research Office');
  $contactEmail  = $s->get('mail_from_address');
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#064e3b;">
    <div class="hero-icon">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    </div>
    <h1>Congratulations!</h1>
    <p>Your research proposal has been funded</p>
    <span class="badge">✓ Funded</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $recipient->name ?? 'Researcher' }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      We are delighted to inform you that your research proposal has been <strong>approved for funding</strong>.
      This is a significant achievement — congratulations on this outcome!
    </p>

    <div class="award-card">
      @if(!empty($grant_reference) && $grant_reference !== 'To be assigned')
      <p class="grant-label">Grant Reference</p>
      <p class="grant-ref">{{ $grant_reference }}</p>
      @endif
      @if(!empty($title))
      <div class="row"><label>Proposal</label><span style="font-weight:600;color:#064e3b;text-align:right;max-width:60%;">{{ $title }}</span></div>
      @endif
      @if(!empty($tracker_number))
      <div class="row"><label>Tracker No.</label><span style="font-family:monospace;font-weight:700;color:#064e3b;">{{ $tracker_number }}</span></div>
      @endif
      @if(!empty($awarded_amount))
      <div class="row"><label>Awarded Amount</label><span class="amount-highlight">ETB {{ number_format($awarded_amount, 2) }}</span></div>
      @endif
    </div>

    <div class="contact-box">
      <p class="contact-title">To Begin Disbursement</p>
      <p style="font-size:13px;color:#374151;margin:0 0 12px;line-height:1.6;">
        Contact the <strong>{{ $orgName }} Research &amp; Technology Transfer Office</strong>
        with your grant reference number to initiate the fund disbursement process:
      </p>
      @if($contactEmail)
      <div class="contact-item">
        <div class="contact-dot"></div>
        <span><strong>Email:</strong> <a href="mailto:{{ $contactEmail }}" style="color:#059669;font-weight:600;">{{ $contactEmail }}</a></span>
      </div>
      @endif
      @if(!empty($grant_reference) && $grant_reference !== 'To be assigned')
      <div class="contact-item">
        <div class="contact-dot"></div>
        <span><strong>Reference your Grant:</strong> {{ $grant_reference }}</span>
      </div>
      @endif
    </div>

    <div class="note">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" style="flex-shrink:0;margin-top:1px;">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p>Please bring a printed copy of this notification to any in-person meetings with the Research Office.</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Sent to <strong>{{ $recipient->email ?? '' }}</strong> via <strong>{{ $platformName }}</strong>.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
