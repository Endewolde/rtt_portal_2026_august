<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review Submitted</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero{background:linear-gradient(135deg,#1e3a5f,#1e40af);padding:32px;display:flex;align-items:center;gap:16px;}
  .hero-icon{width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .hero-text h1{color:#fff;margin:0 0 4px;font-size:18px;font-weight:700;}
  .hero-text p{color:rgba(255,255,255,.65);margin:0;font-size:13px;}
  .body{padding:28px 32px;}
  .outcome{border-radius:14px;padding:18px;margin:18px 0;text-align:center;}
  .outcome.accepted{background:#f0fdf4;border:1px solid #86efac;}
  .outcome.rejected{background:#fef2f2;border:1px solid #fca5a5;}
  .outcome.revision{background:#fefce8;border:1px solid #fde047;}
  .outcome-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin:0 0 6px;}
  .outcome-value{font-size:22px;font-weight:800;margin:0;}
  .outcome.accepted .outcome-label{color:#166534;} .outcome.accepted .outcome-value{color:#166534;}
  .outcome.rejected .outcome-label{color:#991b1b;} .outcome.rejected .outcome-value{color:#991b1b;}
  .outcome.revision .outcome-label{color:#92400e;} .outcome.revision .outcome-value{color:#92400e;}
  .detail{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:16px 0;}
  .row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}
  .row:last-child{border-bottom:none;}
  .row label{color:#64748b;font-weight:500;}
  .comments{background:#f8fafc;border-radius:10px;padding:14px;margin:16px 0;font-size:13px;color:#374151;line-height:1.7;border:1px solid #e2e8f0;}
  .cta{text-align:center;margin:24px 0 8px;}
  .cta-btn{display:inline-block;background:#1e40af;color:#fff;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;}
  .divider{border:none;border-top:1px solid #e5e7eb;margin:20px 0;}
  .footer{background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <div class="hero-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    </div>
    <div class="hero-text">
      <h1>Review Submitted</h1>
      <p>{{ $reviewer->name }} has completed their review</p>
    </div>
  </div>

  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Hi <strong>{{ $admin->name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 20px;">
      A reviewer has submitted their evaluation for the abstract below. The abstract status has been updated automatically.
    </p>

    @php
      $recClass = match($reviewData['recommendation']) {
        'accept' => 'accepted',
        'reject' => 'rejected',
        default  => 'revision',
      };
      $recLabel = match($reviewData['recommendation']) {
        'accept' => '✓ Accepted',
        'reject' => '✗ Rejected',
        default  => '⟳ Revision Requested',
      };
    @endphp

    <div class="outcome {{ $recClass }}">
      <p class="outcome-label">Recommendation</p>
      <p class="outcome-value">{{ $recLabel }}</p>
    </div>

    <div class="detail">
      <div class="row"><label>Abstract</label><span style="font-weight:600;color:#0f172a;text-align:right;max-width:55%;">{{ $abstract->title }}</span></div>
      <div class="row"><label>Submitter</label><span style="font-weight:600;color:#0f172a;">{{ $abstract->submitter_name }}</span></div>
      <div class="row"><label>Reviewer</label><span style="font-weight:600;color:#0f172a;">{{ $reviewer->name }}</span></div>
      <div class="row"><label>Score</label><span style="font-weight:700;color:#1e40af;">{{ $reviewData['score'] ?? '—' }} / 10</span></div>
      <div class="row"><label>New Status</label><span style="font-weight:600;color:#0f172a;">{{ ucwords(str_replace('_',' ', $abstract->status)) }}</span></div>
    </div>

    @if(!empty($reviewData['comments']))
    <p style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin:16px 0 6px;">Reviewer Comments</p>
    <div class="comments">{{ $reviewData['comments'] }}</div>
    @endif

    <div class="cta">
      <a href="{{ config('app.url') }}/admin/abstracts" class="cta-btn">View in Admin Panel →</a>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">You received this as an admin of <strong>{{ $senderName }}</strong>.</p>
  </div>

  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> &middot; Research &amp; Technology Transfer Platform</div>
</div>
</body>
</html>
