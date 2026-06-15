<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Abstract Received</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}.hero{background:linear-gradient(135deg,#7c3aed,#4338ca);padding:36px 32px;text-align:center;}.hero-icon{width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.75);margin:0;font-size:13px;}.body{padding:32px;}.token-box{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:12px;padding:18px;margin:20px 0;text-align:center;}.token-label{font-size:11px;font-weight:700;color:#5b21b6;letter-spacing:.08em;text-transform:uppercase;margin:0 0 6px;}.token-val{font-size:17px;font-family:monospace;font-weight:700;color:#5b21b6;letter-spacing:.05em;word-break:break-all;}.detail{background:#f8fafc;border-radius:12px;padding:18px;margin:20px 0;}.detail-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}.detail-row:last-child{border-bottom:none;}.divider{border:none;border-top:1px solid #e5e7eb;margin:24px 0;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#7c3aed;"><div class="hero-icon"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></div>
    <h1>Abstract Received!</h1><p>Your submission is under review</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $abstract->submitter_name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 20px;">We have received your abstract submission for <strong>{{ $conference->title }}</strong>. Our review team will evaluate it and notify you of the decision.</p>
    <div class="token-box"><p class="token-label">Your Tracking Token</p><p class="token-val">{{ $abstract->submission_token }}</p><p style="font-size:11px;color:#7c3aed;margin:8px 0 0;">Keep this safe — use it to track or withdraw your submission.</p></div>
    <div class="detail">
      <div class="detail-row"><label style="color:#64748b;font-weight:500;">Title</label><span style="color:#0f172a;font-weight:600;text-align:right;max-width:60%;">{{ $abstract->title }}</span></div>
      <div class="detail-row"><label style="color:#64748b;font-weight:500;">Type</label><span style="color:#0f172a;font-weight:600;">{{ ucfirst($abstract->presentation_type) }}</span></div>
      <div class="detail-row"><label style="color:#64748b;font-weight:500;">Word Count</label><span style="color:#0f172a;font-weight:600;">{{ number_format($abstract->word_count ?? 0) }}</span></div>
      <div class="detail-row"><label style="color:#64748b;font-weight:500;">Status</label><span style="color:#7c3aed;font-weight:600;">Submitted</span></div>
    </div>
    <hr class="divider"><p style="font-size:13px;color:#9ca3af;margin:0;">Sent to <strong>{{ $abstract->submitter_email }}</strong> · {{ $senderName }}</p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
