<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Grant Award Notification – {{ $proposal->tracker_number }}</title>
<style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
        font-family: 'DejaVu Serif', Georgia, serif;
        font-size: 11.5pt;
        color: #1a1a1a;
        background: #fff;
    }

    .page {
        width: 100%;
        max-width: 720px;
        margin: 0 auto;
        padding: 48px 56px 56px;
    }

    /* ── Letterhead ─────────────────────────────────────────── */
    .letterhead {
        border-bottom: 3px double #1a3a6b;
        padding-bottom: 18px;
        margin-bottom: 28px;
    }

    .letterhead-top {
        display: flex;
        align-items: center;
        gap: 18px;
        margin-bottom: 8px;
    }

    .logo-placeholder {
        width: 64px;
        height: 64px;
        border: 2px solid #1a3a6b;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22pt;
        font-weight: bold;
        color: #1a3a6b;
        flex-shrink: 0;
    }

    .uni-name {
        font-size: 17pt;
        font-weight: bold;
        color: #1a3a6b;
        letter-spacing: 0.4px;
        line-height: 1.2;
    }

    .uni-sub {
        font-size: 9pt;
        color: #555;
        margin-top: 2px;
        font-style: italic;
    }

    .letterhead-contact {
        font-size: 8.5pt;
        color: #555;
        text-align: right;
        margin-top: 6px;
    }

    /* ── Meta (date / ref / to) ─────────────────────────────── */
    .meta-block {
        margin-bottom: 24px;
    }

    .meta-row {
        display: flex;
        gap: 8px;
        margin-bottom: 5px;
        font-size: 10.5pt;
    }

    .meta-label {
        font-weight: bold;
        min-width: 72px;
        color: #333;
    }

    /* ── Subject line ───────────────────────────────────────── */
    .subject-line {
        font-weight: bold;
        font-size: 11pt;
        margin-bottom: 20px;
        padding: 8px 12px;
        border-left: 4px solid #1a3a6b;
        background: #f0f4fb;
    }

    /* ── Body text ──────────────────────────────────────────── */
    .salutation {
        margin-bottom: 16px;
        font-size: 11.5pt;
    }

    .body-para {
        margin-bottom: 14px;
        line-height: 1.65;
        text-align: justify;
    }

    /* ── Award details box ──────────────────────────────────── */
    .award-box {
        border: 1px solid #c0cfe8;
        background: #f7f9fd;
        border-radius: 4px;
        padding: 14px 18px;
        margin: 18px 0;
    }

    .award-box table {
        width: 100%;
        border-collapse: collapse;
    }

    .award-box td {
        padding: 5px 8px;
        font-size: 10.5pt;
        vertical-align: top;
    }

    .award-box td.label {
        font-weight: bold;
        width: 38%;
        color: #1a3a6b;
        border-right: 1px solid #c0cfe8;
    }

    .award-box td.value {
        padding-left: 14px;
    }

    .award-box tr + tr td {
        border-top: 1px solid #e0e8f4;
    }

    /* ── Closing / signature ─────────────────────────────────── */
    .closing {
        margin-top: 28px;
        margin-bottom: 52px;   /* space for wet-ink signature */
        font-size: 11pt;
    }

    .sig-block {
        font-size: 10.5pt;
        line-height: 1.8;
        border-top: 1px solid #333;
        display: inline-block;
        padding-top: 6px;
        min-width: 240px;
        margin-top: 48px;
    }

    .sig-name  { font-weight: bold; }
    .sig-title { color: #555; }

    /* ── Footer ─────────────────────────────────────────────── */
    .footer {
        border-top: 1px solid #c0cfe8;
        margin-top: 36px;
        padding-top: 10px;
        text-align: center;
        font-size: 8pt;
        color: #888;
        font-style: italic;
    }

    /* ── Confidential stamp ──────────────────────────────────── */
    .confidential {
        text-align: right;
        font-size: 8pt;
        color: #b00;
        font-weight: bold;
        letter-spacing: 1px;
        margin-bottom: 8px;
    }
</style>
</head>
<body>
<div class="page">

    {{-- Confidential marker --}}
    <p class="confidential">CONFIDENTIAL</p>

    {{-- ── Letterhead ──────────────────────────────────── --}}
    <div class="letterhead">
        <div class="letterhead-top">
            <div class="logo-placeholder">{{ strtoupper(substr($universityName, 0, 2)) }}</div>
            <div>
                <div class="uni-name">{{ $universityName }}</div>
                <div class="uni-sub">Office of Research &amp; Technology Transfer</div>
            </div>
        </div>
        <div class="letterhead-contact">
            Ref. No.: {{ $award->grant_reference }}
        </div>
    </div>

    {{-- ── Date / Recipient block ──────────────────────── --}}
    <div class="meta-block">
        <div class="meta-row">
            <span class="meta-label">Date:</span>
            <span>{{ $letterDate }}</span>
        </div>
        <div class="meta-row">
            <span class="meta-label">To:</span>
            <span>
                <strong>{{ $pi->name }}</strong>{{ $department ? ', ' . $department : '' }}
            </span>
        </div>
    </div>

    {{-- ── Subject ──────────────────────────────────────── --}}
    <div class="subject-line">
        Subject: Grant Award Notification – Academic Year {{ $academicYear }}
    </div>

    {{-- ── Salutation ──────────────────────────────────── --}}
    <p class="salutation">Dear {{ $pi->name }},</p>

    {{-- ── Body ───────────────────────────────────────── --}}
    <p class="body-para">
        <strong>Congratulations!</strong> We are pleased to inform you that your research proposal,
        <em>"{{ $proposal->title }}"</em>, has been selected for funding under the
        <strong>{{ $callTitle }}</strong> for the academic year <strong>{{ $academicYear }}</strong>.
    </p>

    {{-- Award details box --}}
    <div class="award-box">
        <table>
            <tr>
                <td class="label">Grant Reference</td>
                <td class="value">{{ $award->grant_reference }}</td>
            </tr>
            <tr>
                <td class="label">Project Title</td>
                <td class="value"><em>{{ $proposal->title }}</em></td>
            </tr>
            <tr>
                <td class="label">Principal Investigator</td>
                <td class="value">{{ $pi->name }}</td>
            </tr>
            <tr>
                <td class="label">College / Department</td>
                <td class="value">{{ $department }}</td>
            </tr>
            <tr>
                <td class="label">Academic Year</td>
                <td class="value">{{ $academicYear }}</td>
            </tr>
            <tr>
                <td class="label">Total Funding Award</td>
                <td class="value"><strong>{{ $formattedAmount }}</strong></td>
            </tr>
            @if($award->approval_notes)
            <tr>
                <td class="label">Approval Notes</td>
                <td class="value">{{ $award->approval_notes }}</td>
            </tr>
            @endif
        </table>
    </div>

    <p class="body-para">
        The university has approved a total funding award of <strong>{{ $formattedAmount }}</strong>
        for your project. The funds will be disbursed upon receipt of the signed grant agreement.
    </p>

    <p class="body-para">
        To accept this award and release the funds, please sign the attached agreement form and
        return it to the Office of Research &amp; Technology Transfer by
        <strong>{{ $returnDeadline }}</strong>.
    </p>

    <p class="body-para">
        Please be advised that funds will only be released after the signed agreement is received
        and processed. Any delay in returning the agreement may affect the commencement of your
        project activities.
    </p>

    <p class="body-para">
        We congratulate you on this achievement and look forward to the successful execution
        of your project. Should you have any questions, do not hesitate to contact our office.
    </p>

    {{-- ── Closing ─────────────────────────────────────── --}}
    <p class="closing">Sincerely,</p>

    <div class="sig-block">
        <div class="sig-name">{{ $approvedBy->name }}</div>
        <div class="sig-title">Director of Research &amp; Technology Transfer</div>
        <div class="sig-title">{{ $universityName }}</div>
    </div>

    {{-- ── Footer ─────────────────────────────────────── --}}
    <div class="footer">
        This letter was generated by the {{ $universityName }} Research &amp; Technology Transfer Platform.
        &nbsp;|&nbsp; {{ $award->grant_reference }} &nbsp;|&nbsp; {{ $letterDate }}
    </div>

</div>
</body>
</html>
