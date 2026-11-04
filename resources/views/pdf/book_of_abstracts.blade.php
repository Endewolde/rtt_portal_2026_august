<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Book of Abstracts – {{ $conference->title }}</title>
@php
    $dates = $conference->start_date?->format('j F Y').($conference->end_date && ! $conference->end_date->isSameDay($conference->start_date) ? ' – '.$conference->end_date->format('j F Y') : '');
@endphp
<style>
@include('pdf.partials.fonts')
    @page { margin: 22mm 20mm 20mm; }
    * { box-sizing: border-box; }
    body { font-family: 'DejaVu Serif', Georgia, 'Noto Sans Ethiopic', serif; font-size: 10pt; color: #1f2937; line-height: 1.5; margin: 0; }
    .sans { font-family: 'DejaVu Sans', sans-serif; }
    .foot { position: fixed; bottom: -12mm; left: 0; right: 0; font-family: 'DejaVu Sans', sans-serif; font-size: 7.5pt; color: #9ca3af; border-top: 0.5pt solid #e5e7eb; padding-top: 4pt; }
    .foot .r { float: right; }
    .foot .pn:after { content: counter(page); }

    /* Cover */
    .cover { text-align: center; padding-top: 60mm; page-break-after: always; }
    .cover .org { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; letter-spacing: 2pt; text-transform: uppercase; color: #0b3a66; font-weight: bold; }
    .cover .kind { margin-top: 26mm; font-size: 11pt; letter-spacing: 4pt; text-transform: uppercase; color: #b8923a; font-weight: bold; }
    .cover h1 { font-size: 26pt; line-height: 1.2; color: #0b3a66; margin: 6mm 10mm 0; }
    .cover .rule { width: 40mm; border-top: 1.5pt solid #b8923a; margin: 8mm auto; }
    .cover .meta { font-family: 'DejaVu Sans', sans-serif; font-size: 10pt; color: #4b5563; }
    .cover .count { margin-top: 30mm; font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #6b7280; }

    /* Contents */
    h2.part { font-size: 15pt; color: #0b3a66; border-bottom: 1.5pt solid #0b3a66; padding-bottom: 3pt; margin: 0 0 10pt; }
    .toc { width: 100%; border-collapse: collapse; font-size: 9pt; }
    .toc td { padding: 2.5pt 0; vertical-align: top; }
    .toc td.n { width: 12mm; font-family: 'DejaVu Sans', sans-serif; color: #b8923a; font-weight: bold; }
    .toc td.who { width: 45mm; text-align: right; color: #6b7280; font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; }
    .toc tr.group td { padding-top: 9pt; font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; font-weight: bold; letter-spacing: 1pt; text-transform: uppercase; color: #0b3a66; }

    /* Abstracts */
    .track-head { page-break-before: always; font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; letter-spacing: 1.5pt; text-transform: uppercase; color: #b8923a; font-weight: bold; margin-bottom: 10pt; }
    .entry { margin-bottom: 16pt; padding-bottom: 12pt; border-bottom: 0.5pt solid #e5e7eb; }
    .entry .no { font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; font-weight: bold; color: #ffffff; background: #0b3a66; padding: 1.5pt 5pt; border-radius: 2pt; }
    .entry .fmt { font-family: 'DejaVu Sans', sans-serif; font-size: 7.5pt; color: #6b7280; text-transform: uppercase; letter-spacing: 0.8pt; margin-left: 5pt; }
    .entry h3 { font-size: 12.5pt; line-height: 1.3; color: #111827; margin: 6pt 0 4pt; }
    .entry .authors { font-family: 'DejaVu Sans', sans-serif; font-size: 9pt; color: #1f2937; }
    .entry .authors .presenting { text-decoration: underline; }
    .entry .affs { font-family: 'DejaVu Sans', sans-serif; font-size: 7.8pt; color: #6b7280; margin-top: 2pt; }
    .entry .body { margin-top: 7pt; text-align: justify; white-space: pre-line; }
    .entry .kw { margin-top: 6pt; font-family: 'DejaVu Sans', sans-serif; font-size: 8pt; color: #4b5563; }
    .entry .slot { margin-top: 4pt; font-family: 'DejaVu Sans', sans-serif; font-size: 7.8pt; color: #6b7280; }
    sup { font-size: 6pt; }

    /* Author index */
    .index { page-break-before: always; }
    .index-row { padding: 1pt 0; }
    .index-row .nums { font-family: 'DejaVu Sans', sans-serif; color: #b8923a; font-size: 8pt; }
    .empty { text-align: center; color: #6b7280; padding-top: 40mm; font-family: 'DejaVu Sans', sans-serif; }
</style>
</head>
<body>
<div class="foot"><span>{{ $conference->title }} — Book of Abstracts</span><span class="r">Page <span class="pn"></span></span></div>

<div class="cover">
    <div class="org">{{ $orgName }}</div>
    <div class="kind">Book of Abstracts</div>
    <h1>{{ $conference->title }}</h1>
    <div class="rule"></div>
    <div class="meta">{{ $dates }}@if($conference->location_address)<br>{{ $conference->location_address }}@endif</div>
    <div class="count">{{ $total }} accepted {{ $total === 1 ? 'contribution' : 'contributions' }}</div>
</div>

@if($total === 0)
    <p class="empty">No abstracts have been accepted yet.</p>
@else
    <h2 class="part">Contents</h2>
    <table class="toc">
        @foreach($entries as $group => $items)
            @if($group !== '')<tr class="group"><td colspan="3">{{ $group }}</td></tr>@endif
            @foreach($items as $e)
                <tr>
                    <td class="n">A{{ $e['number'] }}</td>
                    <td>{{ $e['abstract']->title }}</td>
                    <td class="who">{{ $e['authors']->first()['name'] }}{{ $e['authors']->count() > 1 ? ' et al.' : '' }}</td>
                </tr>
            @endforeach
        @endforeach
    </table>

    @foreach($entries as $group => $items)
        <div class="track-head">{{ $group !== '' ? $group : 'Abstracts' }}</div>
        @foreach($items as $e)
            @php($a = $e['abstract'])
            <div class="entry">
                <span class="no">A{{ $e['number'] }}</span><span class="fmt">{{ $e['type'] }}</span>
                <h3>{{ $a->title }}</h3>
                <div class="authors">
                    @foreach($e['authors'] as $i => $au)<span class="{{ $au['presenting'] ? 'presenting' : '' }}">{{ $au['name'] }}</span>@if($au['aff'])<sup>{{ $au['aff'] }}</sup>@endif{{ $i < $e['authors']->count() - 1 ? ', ' : '' }}@endforeach
                </div>
                @if($e['affiliations']->isNotEmpty())
                    <div class="affs">@foreach($e['affiliations'] as $i => $aff)<sup>{{ $i + 1 }}</sup>{{ $aff }}{{ $i < $e['affiliations']->count() - 1 ? '; ' : '' }}@endforeach</div>
                @endif
                <div class="body">{{ $a->body }}</div>
                @if(! empty($a->keywords))<div class="kw"><strong>Keywords:</strong> {{ implode(', ', $a->keywords) }}</div>@endif
                @if($a->session)<div class="slot">{{ $a->session->title }}@if($a->session->starts_at) · {{ $a->session->starts_at->format('l j F, H:i') }}@endif @if($a->session->room)· {{ $a->session->room }}@endif</div>@endif
            </div>
        @endforeach
    @endforeach

    <div class="index">
        <h2 class="part">Author index</h2>
        <p class="sans" style="font-size:8pt;color:#6b7280;margin:0 0 8pt;">Numbers refer to abstracts. The presenting author is underlined in each abstract.</p>
        {{-- dompdf has no CSS columns: two table cells, the list split in half. --}}
        <table style="width:100%;border-collapse:collapse;font-size:9pt;"><tr>
            @foreach($index->split(2) as $half)
                <td style="width:50%;vertical-align:top;padding-right:6mm;">
                    @foreach($half as $row)
                        <div class="index-row">{{ $row['name'] }} <span class="nums">{{ collect($row['numbers'])->map(fn ($n) => 'A'.$n)->join(', ') }}</span></div>
                    @endforeach
                </td>
            @endforeach
        </tr></table>
    </div>
@endif
</body>
</html>
