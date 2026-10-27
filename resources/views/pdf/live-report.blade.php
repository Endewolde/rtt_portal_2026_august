<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>{{ $title }}</title>
<style>
@include('pdf.partials.fonts')
@page { margin: 0 0 30px 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'DejaVu Sans', Arial, 'Noto Sans Ethiopic', sans-serif; font-size: 8pt; color: #1e293b; line-height: 1.4; }
.footer { position: fixed; bottom: 8px; left: 32px; right: 32px; height: 14px; font-size: 6.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
.footer .right { float: right; }
.cover { background: #0f172a; padding: 22px 32px 18px; }
.cover table { width: 100%; border-collapse: collapse; }
.cover .logo { width: 46px; vertical-align: middle; }
.cover .logo img { width: 40px; height: 40px; }
.tag { font-size: 6.5pt; font-weight: bold; color: #a5b4fc; letter-spacing: 0.16em; text-transform: uppercase; }
.title { font-size: 18pt; font-weight: bold; color: #fff; line-height: 1.2; }
.sub { font-size: 8pt; color: #94a3b8; margin-top: 2px; }
.content { padding: 18px 32px 0; }
table.list { width: 100%; border-collapse: collapse; }
table.list th { background: #f1f5f9; color: #475569; font-size: 6.5pt; text-transform: uppercase; letter-spacing: 0.06em; text-align: left; padding: 6px 7px; border-bottom: 1px solid #cbd5e1; }
table.list th.num, table.list td.num { text-align: right; }
table.list td { padding: 6px 7px; border-bottom: 1px solid #e2e8f0; }
table.list tr { page-break-inside: avoid; }
table.list td.first { font-weight: bold; color: #0f172a; }
table.list tr.total td { background: #f8fafc; font-weight: bold; border-top: 1.5px solid #94a3b8; }
.empty { padding: 40px; text-align: center; color: #94a3b8; font-size: 9pt; }
</style>
</head>
<body>
@php
    $fields = array_keys($columns);
    $isNum = fn ($field) => collect($rows)->every(fn ($r) => ($r[$field] ?? null) === null || is_numeric($r[$field]));
    $show = function ($value) {
        if ($value === null || $value === '') return '—';
        if (is_numeric($value)) return fmod((float) $value, 1) == 0 ? number_format((float) $value) : number_format((float) $value, 1);
        // Codes like "community_engagement" read as words; names stay as written.
        $value = (string) $value;
        return preg_match('/^[a-z0-9_]+$/', $value) ? ucwords(str_replace('_', ' ', $value)) : $value;
    };
@endphp

<div class="footer">
    {{ $orgName }} · {{ $systemName }} — {{ $title }}
    <span class="right">Generated {{ $generatedAt->format('j M Y, H:i') }}</span>
</div>

<div class="cover">
    <table><tr>
        @if ($logo)
            <td class="logo"><img src="{{ $logo }}" alt=""></td>
        @endif
        <td>
            <div class="tag">Scheduled report</div>
            <div class="title">{{ $title }}</div>
            <div class="sub">{{ $orgName }} · {{ $scope }}</div>
        </td>
    </tr></table>
</div>

<div class="content">
    @if (count($rows) === 0)
        <div class="empty">No data for these filters yet.</div>
    @else
        <table class="list">
            <thead>
                <tr>
                    @foreach ($columns as $field => $label)
                        <th class="{{ ! $loop->first && $isNum($field) ? 'num' : '' }}">{{ $label }}</th>
                    @endforeach
                </tr>
            </thead>
            <tbody>
                @foreach ($rows as $row)
                    <tr>
                        @foreach ($fields as $field)
                            <td class="{{ $loop->first ? 'first' : ($isNum($field) ? 'num' : '') }}">{{ $show($row[$field] ?? null) }}</td>
                        @endforeach
                    </tr>
                @endforeach
                @if ($totals)
                    <tr class="total">
                        @foreach ($fields as $field)
                            <td class="{{ $loop->first ? '' : 'num' }}">{{ $loop->first ? 'Total' : ($totals[$field] === null ? '' : $show($totals[$field])) }}</td>
                        @endforeach
                    </tr>
                @endif
            </tbody>
        </table>
    @endif
</div>
</body>
</html>
