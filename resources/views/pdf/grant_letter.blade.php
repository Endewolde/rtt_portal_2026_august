<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Award Letter</title>
<style>
@page {
    margin-top: 14mm;
    margin-right: 20mm;
    margin-bottom: 28mm;
    margin-left: 20mm;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 11pt;
    color: #000;
    line-height: 1.5;
    background: #fff;
}

/* ── Header (3-col table) ── */
.header { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
.header td { vertical-align: middle; }
.header .col-left  { width: 33%; text-align: center; }
.header .col-mid   { width: 34%; text-align: center; }
.header .col-right { width: 33%; text-align: right; }
.org-amharic { font-size: 12pt; font-weight: bold; }
.org-sub-amharic { font-size: 9pt; font-weight: normal; }
.logo { width: 80px; height: 80px; }
.logo-placeholder {
    display: inline-block;
    width: 80px; height: 80px;
    border-radius: 50%;
    border: 3px double #555;
    font-size: 7pt; color: #777;
    text-align: center; line-height: 80px;
}
.org-name    { font-size: 12pt; font-weight: bold; }
.org-address { font-size: 9pt; }
.divider { border-top: 2px solid #000; margin-bottom: 10px; }

/* ── Ref / Date table ── */
.ref-table { border-collapse: collapse; font-size: 10pt; margin-bottom: 14px; float: right; }
.ref-table td { padding: 2px 6px; }
.ref-table .val { border-bottom: 1px solid #000; min-width: 80px; }
.clearfix { clear: both; }

/* ── Members table ── */
.members-table { border-collapse: collapse; font-size: 10pt; margin-bottom: 16px; }
.members-table td { padding: 1px 8px 1px 0; vertical-align: top; }

/* ── Subject ── */
.subject { font-size: 11pt; font-weight: bold; text-decoration: underline; margin-bottom: 16px; }

/* ── Body ── */
.body-text { font-size: 11pt; line-height: 1.7; text-align: justify; margin-bottom: 24px; }
.body-text p { margin-bottom: 12px; }

/* ── Signature ── */
.sig-wrap { margin: 20px 0 16px; }
.sig-line { border-top: 1px solid #000; padding-top: 6px; display: inline-block; min-width: 200px; }
.sig-name  { font-weight: bold; }
.sig-title { font-size: 10pt; }

/* ── CC ── */
.cc { font-size: 10pt; margin-top: 8px; }

/* ── Footer ── */
.footer { border-top: 2px solid #000; padding-top: 5px; font-size: 8.5pt;
          width: 100%; border-collapse: collapse; margin-top: 20px; }
.footer td { width: 33%; }
.footer .f-right { text-align: right; }
</style>
</head>
<body>

{{-- 3-column header --}}
<table class="header">
    <tr>
        <td class="col-left">
            <div class="org-amharic">{{ $orgNameAmharic }}</div>
            @if($orgSubAmharic)
            <div class="org-sub-amharic">{{ $orgSubAmharic }}</div>
            @endif
        </td>
        <td class="col-mid">
            @if($logoUrl)
                <img src="{{ $logoUrl }}" class="logo" alt="Logo"/>
            @else
                <div class="logo-placeholder">LOGO</div>
            @endif
        </td>
        <td class="col-right">
            <div class="org-name">{{ $orgName }}</div>
            @if($address)<div class="org-address">{{ $address }}</div>@endif
        </td>
    </tr>
</table>

<div class="divider"></div>

{{-- Ref / File No / Date — floated right --}}
<table class="ref-table">
    <tr>
        <td>Ref/No:</td>
        <td class="val">{{ $refNo }}</td>
        <td style="padding-left:12px;">File No:</td>
        <td class="val">{{ $fileNo }}</td>
    </tr>
    <tr>
        <td style="padding-top:6px;">Date:</td>
        <td class="val" colspan="3" style="padding-top:6px;">{{ $letterDate }}</td>
    </tr>
</table>
<div class="clearfix"></div>

{{-- To: members in 3 columns --}}
@php
    $colSize = max(1, (int) ceil(count($members) / 3));
    $col1 = array_slice($members, 0, $colSize);
    $col2 = array_slice($members, $colSize, $colSize);
    $col3 = array_slice($members, $colSize * 2);
    $rows = max(count($col1), 1);
@endphp
<table class="members-table">
    @for($i = 0; $i < $rows; $i++)
    <tr>
        <td style="white-space:nowrap; width:36px;">{{ $i === 0 ? 'To:' : '' }}</td>
        @if(isset($col1[$i]))
            <td>{{ $col1[$i]['name'] }}</td>
            <td style="white-space:nowrap; padding-right:20px;">{{ $col1[$i]['role'] }}</td>
        @else
            <td colspan="2"></td>
        @endif
        @if(isset($col2[$i]))
            <td>{{ $col2[$i]['name'] }}</td>
            <td style="white-space:nowrap; padding-right:20px;">{{ $col2[$i]['role'] }}</td>
        @else
            <td colspan="2"></td>
        @endif
        @if(isset($col3[$i]))
            <td>{{ $col3[$i]['name'] }}</td>
            <td style="white-space:nowrap;">{{ $col3[$i]['role'] }}</td>
        @else
            <td colspan="2"></td>
        @endif
    </tr>
    @endfor
</table>

{{-- Subject --}}
<div class="subject">Subject:&nbsp;Decision to award grant to {{ $category }} project proposal</div>

{{-- Body --}}
<div class="body-text">
    @foreach(explode("\n\n", $body) as $para)
        @if(trim($para) !== '')
            <p>{!! nl2br(e(trim($para))) !!}</p>
        @endif
    @endforeach
</div>

<div style="font-size:11pt; margin-bottom:4px;">Sincerely,</div>

{{-- Signatory --}}
<div class="sig-wrap">
    <div style="height:48px;"></div>
    <div class="sig-line">
        <div class="sig-name">{{ $signatoryName }}</div>
        <div class="sig-title">{{ $signatoryTitle }}</div>
    </div>
</div>

{{-- CC --}}
@if(count($cc))
<div class="cc">
    <strong>CC:</strong>
    @foreach($cc as $line)
    <div style="padding-left:8px;">• {{ $line }}</div>
    @endforeach
</div>
@endif

{{-- Footer --}}
<table class="footer">
    <tr>
        <td>Fax No:&nbsp;{{ $fax }}</td>
        <td style="text-align:center;">E-mail:&nbsp;{{ $email }}</td>
        <td class="f-right">{{ $orgNameAmharic }}</td>
    </tr>
</table>

</body>
</html>
