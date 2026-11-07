<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{ $application->scheme->name }}</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);}.hero{padding:28px 32px;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.85);margin:0;font-size:13px;}.body{padding:28px 32px;}.btn{display:inline-block;background:#0b3a66;color:#fff !important;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;}.facts{width:100%;border-collapse:collapse;margin:0 0 22px;}.facts td{padding:9px 0;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;}.facts td.k{color:#6b7280;width:38%;}.note{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;font-size:13px;color:#374151;white-space:pre-line;margin:0 0 20px;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  @php($colour = ['approved' => '#065f46', 'paid' => '#065f46', 'rejected' => '#7f1d1d'][$application->status] ?? '#0b3a66')
  <div class="hero" style="background:{{ $colour }}"><h1>@if($application->status === 'approved')Your application is approved @elseif($application->status === 'paid')Your support has been paid @else Your application was not approved @endif</h1><p>{{ $application->scheme->name }} · {{ $application->reference }}</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 18px;">Dear {{ $application->applicant->name }},</p>
    <table class="facts" role="presentation">
      <tr><td class="k">For</td><td>{{ $application->title }}</td></tr>
      <tr><td class="k">Requested</td><td>{{ number_format($application->amount_requested, 2) }}</td></tr>
      @if($application->amount_approved)<tr><td class="k">Approved</td><td><strong>{{ number_format($application->amount_approved, 2) }}</strong></td></tr>@endif
      @if($application->paid_on)<tr><td class="k">Paid on</td><td>{{ $application->paid_on->format('j F Y') }}</td></tr>@endif
    </table>
    @if($application->decision_note)<p class="note">{{ $application->decision_note }}</p>@endif
    <p style="text-align:center;margin:0;"><a class="btn" href="{{ $url }}">See your applications</a></p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
