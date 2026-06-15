@php
  $_s        = \App\Models\AppSetting::whereIn('key', ['organization_name','system_name','system_logo'])->pluck('value','key');
  $_platform = $_s->get('system_name', 'RTT Platform');
  $_org      = $_s->get('organization_name', 'Research Office');
  $_logoPath = $_s->get('system_logo');
  $_logoSrc  = null;

  if ($_logoPath) {
    $_absPath = public_path(ltrim($_logoPath, '/'));
    if (file_exists($_absPath)) {
      $_cacheKey = 'email_logo_b64_' . md5($_absPath . filemtime($_absPath));
      $_logoSrc  = \Illuminate\Support\Facades\Cache::remember($_cacheKey, 86400, function () use ($_absPath) {
        $ext  = strtolower(pathinfo($_absPath, PATHINFO_EXTENSION));
        $mime = match ($ext) { 'jpg','jpeg' => 'image/jpeg', 'gif' => 'image/gif', 'svg' => 'image/svg+xml', default => 'image/png' };

        if (in_array($ext, ['png','jpg','jpeg']) && extension_loaded('gd')) {
          $src = match ($ext) {
            'jpg','jpeg' => @imagecreatefromjpeg($_absPath),
            default      => @imagecreatefrompng($_absPath),
          };
          if ($src) {
            $w = imagesx($src);
            $h = imagesy($src);
            $nw = min($w, 200);
            $nh = (int) ($h * $nw / $w);
            $thumb = imagecreatetruecolor($nw, $nh);
            imagealphablending($thumb, false);
            imagesavealpha($thumb, true);
            imagefill($thumb, 0, 0, imagecolorallocatealpha($thumb, 255, 255, 255, 127));
            imagecopyresampled($thumb, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
            imagedestroy($src);
            // Use a temp file to avoid output-buffer conflicts during Blade rendering
            $tmp = tempnam(sys_get_temp_dir(), 'rtt_logo_');
            imagepng($thumb, $tmp);
            imagedestroy($thumb);
            $bytes = file_get_contents($tmp);
            @unlink($tmp);
            if ($bytes) {
              return 'data:' . $mime . ';base64,' . base64_encode($bytes);
            }
          }
        }
        // SVG or fallback: embed raw
        return 'data:' . $mime . ';base64,' . base64_encode(file_get_contents($_absPath));
      });
    }
  }
@endphp
<div style="background:#ffffff;padding:24px 36px 16px;text-align:center;border-bottom:2px solid #e8ecf0;">
  @if($_logoSrc)
    <img src="{{ $_logoSrc }}"
         alt="{{ $_org }}"
         width="160"
         style="max-width:160px;max-height:64px;width:auto;height:auto;display:block;margin:0 auto 10px;border:0;">
    <p style="margin:0;font-size:10px;color:#94a3b8;letter-spacing:.12em;text-transform:uppercase;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
      {{ $_org }} &nbsp;&bull;&nbsp; Research &amp; Technology Transfer
    </p>
  @else
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center">
          <div style="display:inline-block;background:linear-gradient(135deg,#1a365d,#1e40af);border-radius:12px;padding:10px 24px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-.01em;font-family:Arial,Helvetica,sans-serif;">{{ $_platform }}</span>
          </div>
          <p style="margin:8px 0 0;font-size:10px;color:#94a3b8;letter-spacing:.12em;text-transform:uppercase;font-weight:700;font-family:Arial,Helvetica,sans-serif;">
            {{ $_org }} &nbsp;&bull;&nbsp; Research &amp; Technology Transfer
          </p>
        </td>
      </tr>
    </table>
  @endif
</div>
