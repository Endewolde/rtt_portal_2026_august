<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Abstract Decision</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}.hero{background:linear-gradient(135deg,#374151,#1f2937);padding:36px 32px;text-align:center;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.75);margin:0;font-size:13px;}.body{padding:32px;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}</style></head><body>
<div class="wrap">
  <div class="hero"><h1>Abstract Decision</h1><p>We regret to inform you of the outcome</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $abstract->submitter_name }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 16px;">Thank you for submitting your abstract to <strong>{{ $conference->title }}</strong>. After careful review, we regret to inform you that your submission was not selected for presentation at this event.</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:0 0 16px;"><strong>Abstract:</strong> {{ $abstract->title }}</p>
    @if($abstract->admin_notes)<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:16px 0;"><p style="font-size:13px;color:#374151;font-weight:500;margin:0 0 4px;">Reviewer feedback:</p><p style="font-size:13px;color:#4b5563;margin:0;line-height:1.6;">{{ $abstract->admin_notes }}</p></div>@endif
    <p style="font-size:14px;color:#4b5563;line-height:1.7;margin:16px 0 0;">We encourage you to consider submitting to future conferences. Thank you for your contribution to the research community.</p>
  </div>
  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</div>
</div></body></html>
