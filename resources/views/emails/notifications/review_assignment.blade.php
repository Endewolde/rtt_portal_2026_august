<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Review Assignment</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">

  @include('emails.partials.header')

  <!-- Body -->
  <div style="padding:32px;">

    @php
      $isDefence   = ($review_type ?? '') === 'Open Defence';
      $isReassign  = !empty($reassigned);
      $accentColor = $isDefence ? '#6b21a8' : '#1e40af';
      $badgeBg     = $isDefence ? '#f3e8ff' : '#eff6ff';
      $badgeText   = $isDefence ? '#6b21a8' : '#1d4ed8';
    @endphp

    <!-- Review type badge -->
    <div style="margin-bottom:20px;">
      <span style="display:inline-block;background:{{ $badgeBg }};color:{{ $badgeText }};border:1px solid {{ $accentColor }}33;font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;letter-spacing:0.5px;text-transform:uppercase;">
        {{ $review_type ?? 'Review' }} Assignment{{ $isReassign ? ' — Reassigned' : '' }}
      </span>
    </div>

    <h2 style="color:#2d3748;margin:0 0 8px;">
      @if($isReassign)
        You Have Been Reassigned as Reviewer
      @else
        New Review Assignment
      @endif
    </h2>

    <p style="color:#4a5568;margin:0 0 20px;">Dear {{ $recipient->name ?? 'Reviewer' }},</p>

    <p style="color:#4a5568;margin:0 0 20px;">
      @if($isReassign)
        You have been reassigned to review a proposal for the <strong>{{ $review_type ?? 'review' }}</strong> phase.
        Please log in to the RTT platform to begin your evaluation before the due date.
      @else
        You have been assigned to evaluate a proposal as part of the <strong>{{ $review_type ?? 'review' }}</strong> phase.
        Please log in to the RTT platform to begin your evaluation before the due date.
      @endif
    </p>

    <!-- Proposal details card -->
    <div style="background:#f8fafc;border-left:4px solid {{ $accentColor }};padding:16px 20px;margin:0 0 20px;border-radius:0 6px 6px 0;">
      <p style="margin:0 0 8px;color:#4a5568;font-size:14px;">
        <strong style="color:#2d3748;">Tracker No.:</strong>
        <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-size:13px;">{{ $tracker_number ?? 'N/A' }}</code>
      </p>
      @if(!empty($proposal_title))
      <p style="margin:0 0 8px;color:#4a5568;font-size:14px;">
        <strong style="color:#2d3748;">Proposal:</strong> {{ $proposal_title }}
      </p>
      @endif
      @if(!empty($due_date))
      <p style="margin:0;color:#4a5568;font-size:14px;">
        <strong style="color:#2d3748;">Your Due Date:</strong>
        <span style="color:#dc2626;font-weight:600;">{{ \Carbon\Carbon::parse($due_date)->format('d M Y') }}</span>
      </p>
      @endif
    </div>

    {{-- Open defence venue/schedule block --}}
    @if($isDefence && (!empty($scheduled_date) || !empty($venue)))
    <div style="background:#faf5ff;border:1px solid #d8b4fe;padding:16px 20px;border-radius:6px;margin:0 0 20px;">
      <p style="margin:0 0 6px;color:#6b21a8;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:0.5px;">
        Defence Schedule
      </p>
      @if(!empty($scheduled_date))
      <p style="margin:0 0 4px;color:#4a5568;font-size:14px;">
        <strong>Date:</strong> {{ \Carbon\Carbon::parse($scheduled_date)->format('l, d F Y') }}
        @if(!empty($scheduled_time))
          at {{ \Carbon\Carbon::parse($scheduled_time)->format('H:i') }}
        @endif
      </p>
      @endif
      @if(!empty($venue))
      <p style="margin:0;color:#4a5568;font-size:14px;">
        <strong>Venue:</strong> {{ $venue }}
      </p>
      @endif
    </div>
    @endif

    <p style="color:#4a5568;margin:0 0 6px;">
      To submit your evaluation, log in to the RTT Platform and navigate to <strong>My Review Assignments</strong>.
    </p>
    <p style="color:#718096;font-size:13px;margin:0;">
      If you believe this assignment was sent in error, please contact the research office.
    </p>

  </div>

  @include('emails.partials.footer')
</div>
</body>
</html>
