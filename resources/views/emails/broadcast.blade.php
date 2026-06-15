<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{ $subject }}</title>
<style>
  body{margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;}
  .wrap{max-width:600px;margin:36px auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(15,23,42,.13);}
  .hero{background:linear-gradient(140deg,#0f172a 0%,#1e3a8a 55%,#2563eb 100%);padding:36px 36px 32px;}
  .hero-from{display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.20);border-radius:999px;padding:6px 16px 6px 12px;margin-bottom:18px;}
  .hero-from-icon{display:inline-block;width:18px;height:18px;background:rgba(255,255,255,.25);border-radius:50%;vertical-align:middle;margin-right:7px;line-height:18px;text-align:center;}
  .hero-from span{color:rgba(255,255,255,.90);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;vertical-align:middle;}
  .hero h1{color:#ffffff;font-size:26px;font-weight:800;line-height:1.25;margin:0;letter-spacing:-.02em;}
  .body{padding:36px;}
  /* Rich text body prose */
  .rte h1{font-size:1.45em;font-weight:700;color:#111827;margin:0 0 10px;line-height:1.25;}
  .rte h2{font-size:1.2em;font-weight:700;color:#111827;margin:0 0 8px;line-height:1.3;}
  .rte h3{font-size:1.05em;font-weight:600;color:#111827;margin:0 0 6px;}
  .rte p{margin:0 0 10px;color:#374151;}
  .rte p:last-child{margin-bottom:0;}
  .rte ul{padding-left:20px;margin:0 0 10px;list-style-type:disc;}
  .rte ol{padding-left:20px;margin:0 0 10px;list-style-type:decimal;}
  .rte li{margin:3px 0;color:#374151;}
  .rte a{color:#2563eb;text-decoration:underline;}
  .rte strong{font-weight:700;}
  .rte em{font-style:italic;}
  .rte s{text-decoration:line-through;}
  .rte u{text-decoration:underline;}
  .rte img{max-width:100%;height:auto;border-radius:6px;display:block;margin:10px 0;}
  .rte table{border-collapse:collapse;width:100%;margin:12px 0;}
  .rte th,.rte td{border:1px solid #d1d5db;padding:7px 12px;vertical-align:top;font-size:13px;}
  .rte th{background:#f1f5f9;font-weight:700;color:#1e293b;text-align:left;}
  .rte td{background:#ffffff;color:#374151;}
  .greeting{font-size:15px;color:#0f172a;font-weight:600;margin:0 0 14px;}
  .divider{border:none;border-top:1px solid #e2e8f0;margin:28px 0;}
</style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;">
  <tr>
    <td align="center" style="padding:36px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(15,23,42,.13);">
        <tr>
          <td>
            @include('emails.partials.logo_header')
          </td>
        </tr>
        <tr>
          <td bgcolor="#1e3a8a" style="background:linear-gradient(140deg,#0f172a 0%,#1e3a8a 55%,#2563eb 100%);padding:36px 36px 32px;">
            <div style="display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.20);border-radius:999px;padding:6px 16px;margin-bottom:18px;">
              <span style="color:rgba(255,255,255,.90);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">
                {{ $senderName ?? 'RTT Platform' }}
              </span>
            </div>
            <h1 style="color:#ffffff;font-size:26px;font-weight:800;line-height:1.25;margin:0;letter-spacing:-.02em;font-family:Arial,Helvetica,sans-serif;">{{ $subject }}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="font-size:15px;color:#0f172a;font-weight:600;margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;">Dear {{ $recipientName }},</p>
            <div class="rte" style="font-size:14px;line-height:1.85;font-family:Arial,Helvetica,sans-serif;">{!! $body !!}</div>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0;">
            <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;font-family:Arial,Helvetica,sans-serif;">
              This message was sent by the <strong style="color:#64748b;">{{ $senderName ?? 'RTT Platform' }}</strong> administration team.
              Please do not reply directly to this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;">
            <p style="font-size:12px;color:#94a3b8;margin:0;font-family:Arial,Helvetica,sans-serif;">
              &copy; {{ date('Y') }} <strong style="color:#64748b;">{{ $senderName ?? 'RTT Platform' }}</strong>
              &nbsp;&middot;&nbsp; Research &amp; Technology Transfer
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
