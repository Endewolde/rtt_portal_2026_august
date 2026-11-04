<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conference committee</title>
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}.wrap{max-width:600px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.08);}.hero{background:#0b3a66;padding:28px 32px;}.hero h1{color:#fff;margin:0 0 6px;font-size:20px;font-weight:700;}.hero p{color:rgba(255,255,255,.8);margin:0;font-size:13px;}.body{padding:28px 32px;}.btn{display:inline-block;background:#0b3a66;color:#fff !important;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:10px;}.role{background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin:0 0 20px;font-size:14px;color:#111827;font-weight:600;}.footer{background:#f8fafc;padding:18px 32px;text-align:center;border-top:1px solid #e5e7eb;}.footer p{font-size:12px;color:#9ca3af;margin:0;}</style></head><body>
<div class="wrap">
  @include('emails.partials.logo_header')
  <div class="hero"><h1>You're on the committee</h1><p>{{ $conference->title }}</p></div>
  <div class="body">
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 16px;">Dear {{ $name }}, you have been added to the organising committee of {{ $conference->title }} as:</p>
    <p class="role">{{ $role }}</p>
    <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 20px;">
      @if($roleKey === 'chair') You can manage the abstracts and decisions, the programme, attendance, certificates and feedback for this conference.
      @elseif($roleKey === 'track_chair') You can read the abstracts submitted to your track, follow their reviews and choose their reviewers. Decisions stay with the conference chairs.
      @else You can check attendees in at the registration desk by scanning their tickets.
      @endif
    </p>
    <p style="text-align:center;margin:0 0 8px;"><a class="btn" href="{{ $link }}">Open the conference</a></p>
  </div>
  <div class="footer"><p>&copy; {{ date('Y') }} <strong>{{ $senderName }}</strong> · Research &amp; Technology Transfer</p></div>
</div></body></html>
