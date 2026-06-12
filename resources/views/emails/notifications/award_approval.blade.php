<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Proposal Funded</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
  <div style="background:#276749;padding:24px;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:20px;">Congratulations!</h1>
    <p style="color:#c6f6d5;margin:4px 0 0;">Your Proposal Has Been Funded</p>
  </div>
  <div style="padding:32px;">
    <p style="color:#4a5568;">Dear {{ $recipient->name ?? 'Researcher' }},</p>
    <p style="color:#4a5568;">We are pleased to inform you that your research proposal has been approved for funding.</p>

    <div style="background:#f0fff4;border:1px solid #9ae6b4;padding:20px;margin:24px 0;border-radius:8px;">
      <p style="margin:0 0 8px;color:#4a5568;"><strong>Grant Reference:</strong></p>
      <p style="font-size:20px;font-family:monospace;color:#276749;font-weight:bold;margin:0;">{{ $grant_reference ?? 'N/A' }}</p>
      @if(!empty($awarded_amount))
      <p style="margin:12px 0 0;color:#4a5568;"><strong>Awarded Amount:</strong> ETB {{ number_format($awarded_amount, 2) }}</p>
      @endif
    </div>

    @php
      $orgName    = \Illuminate\Support\Facades\DB::table('app_settings')->where('key','organization_name')->value('value') ?? 'Research Office';
      $contactEmail = \Illuminate\Support\Facades\DB::table('app_settings')->where('key','mail_from_address')->value('value');
    @endphp

    <p style="color:#4a5568;margin-bottom:8px;">
      To begin the fund disbursement process, please contact the
      <strong>{{ $orgName }} Research &amp; Technology Transfer Office</strong>
      with your grant reference number:
    </p>
    <ul style="color:#4a5568;margin:8px 0 16px;padding-left:20px;">
      @if($contactEmail)
      <li style="margin-bottom:6px;">
        <strong>Email:</strong>
        <a href="mailto:{{ $contactEmail }}" style="color:#276749;">{{ $contactEmail }}</a>
      </li>
      @endif
      <li style="margin-bottom:6px;"><strong>Reference your Grant #:</strong> {{ $grant_reference ?? 'N/A' }}</li>
    </ul>

    <p style="color:#718096;font-size:13px;border-top:1px solid #e2e8f0;padding-top:16px;margin-top:16px;">
      Please bring a printed copy of this notification to any in-person meetings with the Research Office.
    </p>
  </div>
  @include('emails.partials.footer')
</div>
</body>
</html>
