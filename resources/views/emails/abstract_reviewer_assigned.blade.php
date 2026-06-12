<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review Assignment</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#1e40af,#3b82f6);padding:36px 32px;text-align:center;}
  .hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}
  .hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:13px;}
  .body{padding:32px;}
  .abstract-card{background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:20px;margin:20px 0;}
  .abstract-card h2{font-size:16px;font-weight:700;color:#1e40af;margin:0 0 12px;line-height:1.4;}
  .meta-row{display:flex;gap:8px;align-items:baseline;font-size:13px;color:#1d4ed8;margin-bottom:6px;}
  .meta-row:last-child{margin-bottom:0;}
  .meta-label{font-weight:600;min-width:90px;color:#1e40af;}
  .steps{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;}
  .steps h3{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 14px;}
  .step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;}
  .step:last-child{margin-bottom:0;}
  .step-num{width:22px;height:22px;border-radius:50%;background:#1e40af;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .step-text{font-size:13px;color:#374151;line-height:1.5;}
  .cta{text-align:center;margin:28px 0 8px;}
  .cta-btn{display:inline-block;background:#1e40af;color:#fff;font-size:15px;font-weight:700;padding:14px 32px;border-radius:12px;text-decoration:none;letter-spacing:.01em;}
  .cta-sub{font-size:12px;color:#94a3b8;margin-top:8px;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}
  .footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="hero-icon">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    </div>
    <h1>Abstract Review Assignment</h1>
    <p>You have been assigned an abstract to review for <strong>{{ $conference->title }}</strong></p>
  </div>

  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $reviewer->name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 20px;">
      You have been selected as a reviewer for the following abstract submission. Please read it carefully
      and submit your score, recommendation, and comments through the platform.
    </p>

    <div class="abstract-card">
      <h2>{{ $abstract->title }}</h2>
      <div class="meta-row"><span class="meta-label">Submitted by</span><span>{{ $abstract->submitter_name }}{{ $abstract->submitter_affiliation ? ', '.$abstract->submitter_affiliation : '' }}</span></div>
      <div class="meta-row"><span class="meta-label">Type</span><span>{{ ucfirst($abstract->presentation_type) }} presentation</span></div>
      @if($abstract->keywords && count($abstract->keywords))<div class="meta-row"><span class="meta-label">Keywords</span><span>{{ implode(', ', $abstract->keywords) }}</span></div>@endif
      @if($abstract->word_count)<div class="meta-row"><span class="meta-label">Length</span><span>{{ number_format($abstract->word_count) }} words</span></div>@endif
    </div>

    <div class="steps">
      <h3>How to submit your review</h3>
      <div class="step"><div class="step-num">1</div><div class="step-text">Click the <strong>"Go to My Reviews"</strong> button below and log in if prompted.</div></div>
      <div class="step"><div class="step-num">2</div><div class="step-text">Find this abstract under the <strong>"My Reviews"</strong> tab — it will appear in your assigned list.</div></div>
      <div class="step"><div class="step-num">3</div><div class="step-text">Read the full abstract text, then fill in your <strong>score (1–10)</strong>, <strong>recommendation</strong> (Accept / Revise / Reject), and <strong>written comments</strong>.</div></div>
      <div class="step"><div class="step-num">4</div><div class="step-text">Click <strong>"Submit Review"</strong>. The admin team will be notified once all reviews are complete.</div></div>
    </div>

    <div class="cta">
      <a href="{{ config('app.url') }}/admin/abstracts" class="cta-btn">Go to My Reviews →</a>
      <p class="cta-sub">Opens the Abstracts page — click the "My Reviews" tab to find your assignment.</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      You received this because you have been assigned as a reviewer on <strong>{{ $senderName }}</strong>.
      If you believe this was sent in error, please contact the administrator.
    </p>
  </div>

  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</div>
</div>
</body>
</html>
