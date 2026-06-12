<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Revision Required</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#b45309,#d97706);padding:36px 32px;text-align:center;}
  .hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.85);margin:0;font-size:13px;}
  .body{padding:32px;}
  .title-box{background:#fffbeb;border:1px solid #fde047;border-radius:12px;padding:14px 18px;margin:16px 0;}
  .alert{background:#fefce8;border:1px solid #fde047;border-radius:12px;padding:16px 18px;margin:20px 0;}
  .alert-label{font-size:12px;font-weight:700;color:#92400e;margin:0 0 8px;text-transform:uppercase;letter-spacing:.05em;}
  .alert-body{font-size:14px;color:#713f12;margin:0;line-height:1.7;}
  .cta{text-align:center;margin:28px 0 8px;}
  .cta-btn{display:inline-block;background:#b45309;color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;}
  .cta-sub{font-size:12px;color:#94a3b8;margin-top:10px;}
  .steps{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;}
  .steps h3{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:#64748b;margin:0 0 14px;}
  .step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;}
  .step:last-child{margin-bottom:0;}
  .step-num{width:22px;height:22px;border-radius:50%;background:#b45309;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .step-text{font-size:13px;color:#374151;line-height:1.5;}
  .token-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:16px 0;text-align:center;}
  .token-label{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px;}
  .token-val{font-size:13px;font-family:monospace;color:#374151;word-break:break-all;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="hero-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </div>
    <h1>Revision Requested</h1>
    <p>Your abstract needs modifications before a final decision</p>
  </div>

  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $abstract->submitter_name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 16px;">
      Your abstract submitted to <strong>{{ $conference->title }}</strong> has been reviewed.
      The review committee has requested revisions before a final decision can be made.
    </p>

    <div class="title-box">
      <p style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">Your Abstract</p>
      <p style="font-size:15px;font-weight:700;color:#1e1b4b;margin:0;">{{ $abstract->title }}</p>
    </div>

    @if($abstract->admin_notes)
    <div class="alert">
      <p class="alert-label">Required Revisions / Reviewer Feedback</p>
      <p class="alert-body">{{ $abstract->admin_notes }}</p>
    </div>
    @endif

    @if(!empty($resubmitUrl))
    <div class="steps">
      <h3>How to resubmit your revised abstract</h3>
      <div class="step"><div class="step-num">1</div><div class="step-text">Click the <strong>"Revise &amp; Resubmit"</strong> button below.</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Your previous submission will be pre-loaded. Update your abstract addressing the feedback above.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Click <strong>"Submit Abstract"</strong> to send your revised version for re-review.</div></div>
    </div>

    <div class="cta">
      <a href="{{ $resubmitUrl }}" class="cta-btn">Revise &amp; Resubmit →</a>
      <p class="cta-sub">Or copy the link: <span style="font-family:monospace;font-size:11px;">{{ $resubmitUrl }}</span></p>
    </div>
    @endif

    <div class="token-box">
      <p class="token-label">Your Tracking Token</p>
      <p class="token-val">{{ $abstract->submission_token }}</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      Sent to <strong>{{ $abstract->submitter_email }}</strong> via <strong>{{ $senderName }}</strong>.
    </p>
  </div>

  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</div>
</div>
</body>
</html>
