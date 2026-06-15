<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New Abstract Submission</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}.hero{background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:32px;display:flex;align-items:center;gap:16px;}.hero-icon{width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;flex-shrink:0;}.hero-text h1{color:#fff;margin:0 0 4px;font-size:18px;font-weight:700;}.hero-text p{color:rgba(255,255,255,.65);margin:0;font-size:13px;}.body{padding:28px 32px;}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:16px 0;}.row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:13px;}.row:last-child{border-bottom:none;}.divider{border:none;border-top:1px solid #e5e7eb;margin:20px 0;}.footer{background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero" style="background-color:#0f172a;"><div class="hero-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
    <div class="hero-text"><h1>New Abstract Submission</h1><p>{{ $conference->title }}</p></div></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;margin:0 0 16px;">Hi <strong>{{ $admin->name }}</strong>, a new abstract has been submitted.</p>
    <div class="card">
      <div class="row"><label style="color:#64748b;">Abstract Title</label><span style="font-weight:600;color:#0f172a;text-align:right;max-width:60%;">{{ $abstract->title }}</span></div>
      <div class="row"><label style="color:#64748b;">Submitter</label><span style="font-weight:600;color:#0f172a;">{{ $abstract->submitter_name }}</span></div>
      <div class="row"><label style="color:#64748b;">Email</label><span style="font-weight:600;color:#0f172a;">{{ $abstract->submitter_email }}</span></div>
      @if($abstract->submitter_affiliation)<div class="row"><label style="color:#64748b;">Affiliation</label><span style="font-weight:600;color:#0f172a;">{{ $abstract->submitter_affiliation }}</span></div>@endif
      <div class="row"><label style="color:#64748b;">Type</label><span style="font-weight:600;color:#0f172a;">{{ ucfirst($abstract->presentation_type) }}</span></div>
      <div class="row"><label style="color:#64748b;">Word Count</label><span style="font-weight:600;color:#0f172a;">{{ number_format($abstract->word_count ?? 0) }}</span></div>
    </div>
    <hr class="divider"><p style="font-size:13px;color:#9ca3af;margin:0;">Sent because you are an admin of <strong>{{ $senderName }}</strong>.</p>
  </div>
  <div class="footer">&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</div>
</div></body></html>
