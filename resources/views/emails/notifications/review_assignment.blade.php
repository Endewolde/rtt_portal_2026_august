<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Review Assignment</title>
<style>
  body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}
  .wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.10);}
  .hero-blue{background:linear-gradient(135deg,#1e40af,#3b82f6);}
  .hero-purple{background:linear-gradient(135deg,#6b21a8,#9333ea);}
  .hero{padding:40px 32px;text-align:center;}
  .hero-icon{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.2);display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px;}
  .hero h1{color:#fff;margin:0 0 8px;font-size:22px;font-weight:800;}
  .hero p{color:rgba(255,255,255,.8);margin:0;font-size:14px;max-width:380px;margin:0 auto;}
  .badge{display:inline-block;background:rgba(255,255,255,.22);border:1px solid rgba(255,255,255,.35);color:#fff;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:5px 14px;border-radius:999px;margin-top:14px;}
  .body{padding:36px 32px;}
  .proposal-card{border-radius:14px;padding:22px;margin:20px 0;}
  .card-blue{background:#eff6ff;border:1px solid #bfdbfe;}
  .card-purple{background:#faf5ff;border:1px solid #d8b4fe;}
  .card-title{font-size:16px;font-weight:700;margin:0 0 14px;line-height:1.4;}
  .card-blue .card-title{color:#1e40af;}
  .card-purple .card-title{color:#6b21a8;}
  .meta-row{display:flex;gap:8px;align-items:baseline;font-size:13px;margin-bottom:8px;}
  .meta-row:last-child{margin-bottom:0;}
  .meta-label{font-weight:600;min-width:100px;}
  .card-blue .meta-label{color:#1e40af;}
  .card-purple .meta-label{color:#6b21a8;}
  .meta-val{color:#374151;}
  .due-date{color:#dc2626;font-weight:700;}
  .defence-box{background:#faf5ff;border:1px solid #d8b4fe;border-radius:12px;padding:18px;margin:20px 0;}
  .defence-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b21a8;margin:0 0 12px;}
  .steps{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;}
  .steps-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin:0 0 14px;}
  .step{display:flex;gap:12px;margin-bottom:10px;align-items:flex-start;}
  .step:last-child{margin-bottom:0;}
  .step-num-blue{background:#1e40af;}
  .step-num-purple{background:#6b21a8;}
  .step-num{width:22px;height:22px;border-radius:50%;color:#fff;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;}
  .step-text{font-size:13px;color:#374151;line-height:1.55;}
  .cta{text-align:center;margin:28px 0 8px;}
  .btn-blue{background:linear-gradient(135deg,#1e40af,#3b82f6);}
  .btn-purple{background:linear-gradient(135deg,#6b21a8,#9333ea);}
  .btn{display:inline-block;color:#fff;font-size:15px;font-weight:700;padding:14px 36px;border-radius:12px;text-decoration:none;letter-spacing:.01em;}
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

  $isDefence  = ($review_type ?? '') === 'Open Defence';
  $isReassign = !empty($reassigned);
  $themeHero  = $isDefence ? 'hero-purple' : 'hero-blue';
  $heroBg     = $isDefence ? '#6b21a8' : '#1e40af';
  $themeCard  = $isDefence ? 'card-purple' : 'card-blue';
  $themeNum   = $isDefence ? 'step-num-purple' : 'step-num-blue';
  $themeBtn   = $isDefence ? 'btn-purple' : 'btn-blue';
  $badgeText  = $isReassign ? ($review_type ?? 'Review').' — Reassigned' : ($review_type ?? 'Review').' Assignment';
@endphp
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero {{ $themeHero }}" style="background-color:{{ $heroBg }};">
    <div class="hero-icon">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    </div>
    <h1>{{ $isReassign ? 'Review Reassignment' : 'New Review Assignment' }}</h1>
    <p>{{ $isReassign ? 'You have been reassigned to review a proposal' : 'You have been assigned a proposal to evaluate' }}</p>
    <span class="badge">{{ $badgeText }}</span>
  </div>

  <div class="body">
    <p style="font-size:15px;color:#374151;margin:0 0 16px;">Dear <strong>{{ $recipient->name ?? 'Reviewer' }}</strong>,</p>
    <p style="font-size:14px;color:#4b5563;line-height:1.75;margin:0 0 20px;">
      You have been {{ $isReassign ? 'reassigned' : 'assigned' }} to evaluate a proposal as part of the
      <strong>{{ $review_type ?? 'review' }}</strong> phase. Please complete your evaluation before the due date.
    </p>

    <div class="proposal-card {{ $themeCard }}">
      @if(!empty($proposal_title))
      <p class="card-title">{{ $proposal_title }}</p>
      @endif
      @if(!empty($tracker_number))
      <div class="meta-row">
        <span class="meta-label">Tracker No.</span>
        <span class="meta-val"><code style="background:#e2e8f0;padding:2px 8px;border-radius:4px;font-size:12px;">{{ $tracker_number }}</code></span>
      </div>
      @endif
      @if(!empty($due_date))
      <div class="meta-row">
        <span class="meta-label">Your Due Date</span>
        <span class="meta-val due-date">{{ \Carbon\Carbon::parse($due_date)->format('d M Y') }}</span>
      </div>
      @endif
    </div>

    @if($isDefence && (!empty($scheduled_date) || !empty($venue)))
    <div class="defence-box">
      <p class="defence-title">Defence Schedule</p>
      @if(!empty($scheduled_date))
      <p style="font-size:14px;color:#4b5563;margin:0 0 6px;">
        <strong style="color:#6b21a8;">Date:</strong>
        {{ \Carbon\Carbon::parse($scheduled_date)->format('l, d F Y') }}
        @if(!empty($scheduled_time)) at {{ \Carbon\Carbon::parse($scheduled_time)->format('H:i') }} @endif
      </p>
      @endif
      @if(!empty($venue))
      <p style="font-size:14px;color:#4b5563;margin:0;">
        <strong style="color:#6b21a8;">Venue:</strong> {{ $venue }}
      </p>
      @endif
    </div>
    @endif

    <div class="steps">
      <p class="steps-title">How to Submit Your Evaluation</p>
      <div class="step">
        <div class="step-num {{ $themeNum }}">1</div>
        <div class="step-text">Click <strong>"Go to My Assignments"</strong> below and log in if prompted.</div>
      </div>
      <div class="step">
        <div class="step-num {{ $themeNum }}">2</div>
        <div class="step-text">Find this proposal under <strong>My Review Assignments</strong> — it will appear in your list.</div>
      </div>
      <div class="step">
        <div class="step-num {{ $themeNum }}">3</div>
        <div class="step-text">Read the full proposal, then fill in your <strong>score</strong>, <strong>recommendation</strong>, and <strong>written comments</strong>.</div>
      </div>
      <div class="step">
        <div class="step-num {{ $themeNum }}">4</div>
        <div class="step-text">Click <strong>"Submit Review"</strong>. The admin team will be notified once submitted.</div>
      </div>
    </div>

    <div class="cta">
      <a href="{{ config('app.url') }}" class="btn {{ $themeBtn }}">Go to My Assignments →</a>
      <p class="cta-sub">Navigate to "My Review Assignments" to find your assigned proposal.</p>
    </div>

    <hr class="divider">
    <p style="font-size:13px;color:#9ca3af;margin:0;">
      You received this because you have been assigned as a reviewer on <strong>{{ $platformName }}</strong>.
      If you believe this was sent in error, please contact the {{ $orgName }} Research Office.
    </p>
  </div>

  <div class="footer">
    &copy; {{ date('Y') }} <strong>{{ $platformName }}</strong> &middot; {{ $orgName }} Research &amp; Technology Transfer
  </div>
</div>
</body>
</html>
