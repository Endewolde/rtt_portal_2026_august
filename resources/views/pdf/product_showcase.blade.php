<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>RTT Platform — Product Showcase</title>
<style>
@include('pdf.partials.fonts')
@page { margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, 'Noto Sans Ethiopic', sans-serif; font-size: 9.5pt; color: #1e293b; background: #fff; line-height: 1.55; }
.pb  { page-break-after: always; }

/* ─── Layout helpers ──────────────────── */
.page-body  { padding: 18px 22mm 12px; }
.col2-l     { width: 49%; vertical-align: top; padding-right: 7px; }
.col2-r     { width: 49%; vertical-align: top; padding-left:  7px; }
.col2-gap   { width: 2%; }

/* ─── Running header ─────────────────── */
.rh { background: #0f172a; padding: 7px 22mm; }
.rh table { width: 100%; border-collapse: collapse; }
.rh .rh-label { color: #93c5fd; font-size: 7pt; letter-spacing: 2px; text-transform: uppercase; }
.rh .rh-title { color: #fff; font-size: 13pt; font-weight: bold; }
.rh .rh-accent { width: 5px; background: #2563eb; }
.rh .rh-body { padding-left: 12px; }

/* ─── Running footer ─────────────────── */
.rf { background: #0f172a; border-top: 3px solid #2563eb; padding: 6px 22mm; }
.rf table { width: 100%; border-collapse: collapse; }
.rf td { font-size: 7.5pt; color: #475569; }
.rf .rf-right { text-align: right; color: #60a5fa; font-weight: bold; }

/* ─── Typography ─────────────────────── */
.section-title {
    font-size: 13pt; font-weight: bold; color: #1e40af;
    border-bottom: 3px solid #1e40af; padding-bottom: 5px; margin: 10px 0 10px;
}
.section-sub   { font-size: 11pt; font-weight: bold; color: #0f172a; margin: 10px 0 5px; }
.section-sub2  { font-size: 10pt; font-weight: bold; color: #1e40af; margin: 8px 0 4px; }
p { margin-bottom: 7px; color: #334155; }

/* ─── STAT CARD ──────────────────────── */
.stat-card { text-align: center; padding: 16px 10px 14px; }
.stat-card .sc-num  { font-size: 30pt; font-weight: bold; line-height: 1; }
.stat-card .sc-unit { font-size: 9pt; font-weight: bold; letter-spacing: 1px; opacity: .85; margin-top: 2px; }
.stat-card .sc-lbl  { font-size: 7.5pt; letter-spacing: 1px; text-transform: uppercase; opacity: .75; margin-top: 4px; }

/* ─── FEATURE CARD ───────────────────── */
.feat-card { border-left: 4px solid #2563eb; background: #f0f6ff; padding: 9px 12px; margin-bottom: 7px; }
.feat-card .fc-title { font-size: 9.5pt; font-weight: bold; color: #1e40af; margin-bottom: 3px; }
.feat-card .fc-body  { font-size: 8.5pt; color: #475569; line-height: 1.55; }

/* ─── COMPARE BOX ────────────────────── */
.cmp-bad  { background: #fff1f2; border-left: 5px solid #e11d48; padding: 10px 14px; }
.cmp-good { background: #f0fdf4; border-left: 5px solid #16a34a; padding: 10px 14px; }
.cmp-head { font-size: 9pt; font-weight: bold; margin-bottom: 7px; }
.cmp-item { font-size: 8.5pt; color: #334155; margin-bottom: 4px; }

/* ─── DATA TABLE ─────────────────────── */
.dt { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
.dt th { background: #1e3a5f; color: #fff; padding: 7px 10px; text-align: left; font-size: 8.5pt; }
.dt td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
.dt tr:nth-child(even) td { background: #f8fafc; }

/* ─── CALLOUT ────────────────────────── */
.callout-blue  { background: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 14px; margin: 8px 0; }
.callout-green { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 10px 14px; margin: 8px 0; }
.callout-amber { background: #fffbeb; border: 1px solid #fde68a; padding: 10px 14px; margin: 8px 0; }

/* ─── TECH PANEL ─────────────────────── */
.tech-panel { background: #0f172a; padding: 14px 16px; }
.tech-panel .tp-head { font-size: 8pt; font-weight: bold; color: #7dd3fc; letter-spacing: 2px; text-transform: uppercase; border-bottom: 1px solid #1e3a5f; padding-bottom: 6px; margin-bottom: 8px; }
.tech-panel .tp-item { font-size: 8.5pt; line-height: 2; }
.tech-panel .tp-hi   { color: #4ade80; font-weight: bold; }
.tech-panel .tp-dim  { color: #64748b; }
</style>
</head>
<body>

{{-- PAGE 1  COVER --}}
<table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; height:842px;">
  <tr>
    <td width="62%" style="background:#0f172a; padding:0; vertical-align:top;">
      <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="background:#1e40af; height:6px;"></td>
          <td style="background:#10b981; height:6px; width:30%;"></td>
          <td style="background:#7c3aed; height:6px; width:15%;"></td>
        </tr>
      </table>
      <div style="padding:52px 42px 40px;">
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:30px;">
          <tr>
            <td style="width:70px; height:70px; border:3px solid #2563eb; text-align:center; vertical-align:middle; font-size:16pt; font-weight:bold; color:#2563eb;">RTT</td>
            <td style="padding-left:14px; vertical-align:middle;">
              <div style="font-size:9pt; color:#64748b; text-transform:uppercase; letter-spacing:2px; margin-bottom:3px;">Research &amp; Technology Transfer</div>
              <div style="font-size:8pt; color:#475569;">Management System</div>
            </td>
          </tr>
        </table>
        <div style="font-size:34pt; font-weight:bold; color:#fff; line-height:1.05; margin-bottom:6px;">RTT<br/>PLATFORM</div>
        <div style="width:50px; height:4px; background:#2563eb; margin:12px 0 16px;"></div>
        <div style="font-size:11pt; color:#94a3b8; margin-bottom:30px; line-height:1.7;">Empowering universities with a complete<br/>digital research management ecosystem —<br/>from proposal to publication.</div>
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="text-align:center; padding:10px 18px 10px 0; border-right:1px solid #1e3a5f;">
              <div style="font-size:22pt; font-weight:bold; color:#60a5fa;">{{ $stats['proposals'] ?: '100+' }}</div>
              <div style="font-size:7pt; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Proposals</div>
            </td>
            <td style="text-align:center; padding:10px 18px; border-right:1px solid #1e3a5f;">
              <div style="font-size:22pt; font-weight:bold; color:#34d399;">{{ $stats['funded'] ?: '50+' }}</div>
              <div style="font-size:7pt; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Funded</div>
            </td>
            <td style="text-align:center; padding:10px 18px; border-right:1px solid #1e3a5f;">
              <div style="font-size:22pt; font-weight:bold; color:#a78bfa;">{{ $stats['users'] ?: '200+' }}</div>
              <div style="font-size:7pt; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Users</div>
            </td>
            <td style="text-align:center; padding:10px 0 10px 18px;">
              <div style="font-size:22pt; font-weight:bold; color:#fbbf24;">{{ $stats['colleges'] ?: '10+' }}</div>
              <div style="font-size:7pt; color:#64748b; text-transform:uppercase; letter-spacing:1px;">Colleges</div>
            </td>
          </tr>
        </table>
        <div style="margin-top:32px; font-size:8pt; color:#475569;">{{ $orgName }}&nbsp;&nbsp;·&nbsp;&nbsp;Version 1.0&nbsp;&nbsp;·&nbsp;&nbsp;{{ $year }}&nbsp;&nbsp;·&nbsp;&nbsp;CONFIDENTIAL</div>
      </div>
    </td>
    <td width="38%" style="background:#111827; vertical-align:top; padding:0;">
      <div style="height:6px;"></div>
      <div style="padding:46px 22px 0;">
        <div style="font-size:8pt; color:#4b5563; text-transform:uppercase; letter-spacing:2px; margin-bottom:16px;">Platform Modules</div>
        @foreach([
          ['#1e40af','#1e3a5f','#2563eb','#93c5fd','Proposal Management','7-step wizard · Tracker · Multi-call'],
          ['#4c1d95','#2d1b69','#7c3aed','#c4b5fd','Review & Evaluation','Blind · Defence · Central eval'],
          ['#065f46','#064e3b','#10b981','#6ee7b7','Finance & Budget','Allocations · Requests · Settlement'],
          ['#78350f','#451a03','#f59e0b','#fcd34d','Analytics & Reports','Live charts · Export · KPIs'],
          ['#0f766e','#134e4a','#14b8a6','#5eead4','Monitoring','Midterm · Workshop · Outputs'],
          ['#9f1239','#4c0519','#f43f5e','#fda4af','Research Repository','Public outputs · Search · Archive'],
          ['#1e3a5f','#172554','#3b82f6','#93c5fd','External Funds','Grants · Awards · Milestones'],
          ['#3b1f1f','#2d1515','#f97316','#fed7aa','Similarity Detection','TF-IDF · Auto-flag · Review'],
          ['#1e1b4b','#1e1b4b','#818cf8','#a5b4fc','Conferences & Abstracts','Events · Abstract review · Tokens'],
        ] as $m)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:7px;">
          <tr>
            <td style="background:{{ $m[0] }}; padding:9px 12px; border-left:3px solid {{ $m[2] }}; vertical-align:middle;">
              <div style="font-size:8.5pt; font-weight:bold; color:#fff;">{{ $m[4] }}</div>
              <div style="font-size:7.5pt; color:{{ $m[3] }}; margin-top:2px;">{{ $m[5] }}</div>
            </td>
          </tr>
        </table>
        @endforeach
      </div>
    </td>
  </tr>
</table>

<div class="pb"></div>

{{-- PAGE 2  EXECUTIVE SUMMARY --}}
<div class="rh"><table><tr><td class="rh-accent"></td><td class="rh-body"><div class="rh-label">Section 01</div><div class="rh-title">Executive Summary</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">

  <div class="section-title">What is the RTT Platform?</div>
  <p>The <strong>RTT Platform</strong> is a comprehensive, enterprise-grade web application that digitizes the entire research lifecycle for universities and higher education institutions. It replaces paper-based, email-driven workflows with an intelligent digital system serving every stakeholder through a single unified interface.</p>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin:12px 0;">
    <tr>
      <td width="24%" style="padding-right:5px;"><div class="stat-card" style="background:#1e40af; color:#fff;"><div class="sc-num">{{ $stats['proposals'] ?: '100+' }}</div><div class="sc-unit">Proposals</div><div class="sc-lbl">Managed End-to-End</div></div></td>
      <td width="1%"></td>
      <td width="24%" style="padding:0 3px;"><div class="stat-card" style="background:#065f46; color:#fff;"><div class="sc-num">{{ $stats['funded'] ?: '50+' }}</div><div class="sc-unit">Funded</div><div class="sc-lbl">Research Projects</div></div></td>
      <td width="1%"></td>
      <td width="24%" style="padding:0 3px;"><div class="stat-card" style="background:#4c1d95; color:#fff;"><div class="sc-num">{{ $stats['users'] ?: '200+' }}</div><div class="sc-unit">Active Users</div><div class="sc-lbl">Across All Roles</div></div></td>
      <td width="1%"></td>
      <td width="25%" style="padding-left:5px;"><div class="stat-card" style="background:#78350f; color:#fff;"><div class="sc-num">{{ $stats['colleges'] ?: '10+' }}</div><div class="sc-unit">Colleges</div><div class="sc-lbl">Fully Served</div></div></td>
    </tr>
  </table>

  <div class="section-title">The Problem We Solve</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="col2-l">
        <div class="cmp-bad">
          <div class="cmp-head" style="color:#9f1239;">&#10008; Without RTT Platform</div>
          <div class="cmp-item">&#10008;&nbsp; Proposals submitted by email or on paper</div>
          <div class="cmp-item">&#10008;&nbsp; Review assignments tracked in spreadsheets</div>
          <div class="cmp-item">&#10008;&nbsp; Budget requests handled with printed forms</div>
          <div class="cmp-item">&#10008;&nbsp; No real-time visibility into proposal status</div>
          <div class="cmp-item">&#10008;&nbsp; Audit trail exists only as physical paper</div>
          <div class="cmp-item">&#10008;&nbsp; No duplicate / plagiarism detection</div>
          <div class="cmp-item">&#10008;&nbsp; Reports compiled manually every quarter</div>
          <div class="cmp-item">&#10008;&nbsp; Long delays, lost documents, frustrated PIs</div>
        </div>
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        <div class="cmp-good">
          <div class="cmp-head" style="color:#065f46;">&#10004; With RTT Platform</div>
          <div class="cmp-item">&#10004;&nbsp; Guided 7-step wizard online submission</div>
          <div class="cmp-item">&#10004;&nbsp; Automated reviewer assignment &amp; tracking</div>
          <div class="cmp-item">&#10004;&nbsp; Digital budget requests with e-signatures</div>
          <div class="cmp-item">&#10004;&nbsp; Real-time tracker number + status portal</div>
          <div class="cmp-item">&#10004;&nbsp; Immutable digital audit log, always on</div>
          <div class="cmp-item">&#10004;&nbsp; AI-powered TF-IDF similarity scoring</div>
          <div class="cmp-item">&#10004;&nbsp; One-click dashboards, charts &amp; PDF export</div>
          <div class="cmp-item">&#10004;&nbsp; Email, Telegram, and in-app notifications</div>
        </div>
      </td>
    </tr>
  </table>

  <div style="height:10px;"></div>
  <div class="section-title">Platform Highlights</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="col2-l">
        <div class="feat-card"><div class="fc-title">Enterprise Security</div><div class="fc-body">RBAC enforced at the API level. Immutable audit logs. Microsoft SSO, Telegram login, 2FA. Inactive users blocked instantly from all access.</div></div>
        <div class="feat-card"><div class="fc-title">Real-Time Analytics</div><div class="fc-body">Live dashboard — proposal pipeline, budget utilization, reviewer performance, college metrics — all in real time with one-click exportable reports.</div></div>
        <div class="feat-card"><div class="fc-title">Feature Toggle System</div><div class="fc-body">Every major module can be enabled or disabled instantly by Super Admin — no code changes or redeployment required. Scale at your own pace.</div></div>
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        <div class="feat-card" style="border-left-color:#10b981;"><div class="fc-title" style="color:#065f46;">Multi-Role Workflow</div><div class="fc-body">9 distinct roles each with scoped visibility. Category and college boundaries are enforced at the API level — officers see exactly what they need.</div></div>
        <div class="feat-card" style="border-left-color:#10b981;"><div class="fc-title" style="color:#065f46;">Multi-Channel Notifications</div><div class="fc-body">Every workflow transition triggers targeted notifications via in-app bell, email, and Telegram bot. Deadline reminders at 7, 3, and 1 day.</div></div>
        <div class="feat-card" style="border-left-color:#10b981;"><div class="fc-title" style="color:#065f46;">Proven in Production</div><div class="fc-body">Deployed and running at {{ $orgName }}, managing real proposals, budgets, and evaluations — continuously refined from real institutional feedback.</div></div>
      </td>
    </tr>
  </table>
  <div class="callout-amber"><strong>Target Customers:</strong> Universities · Research institutes · Polytechnics · Government research agencies · Any organization managing competitive grant processes at scale.</div>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Executive Summary &nbsp;&#183;&nbsp; Page 2</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 3  MODULE OVERVIEW --}}
<div class="rh"><table><tr><td class="rh-accent"></td><td class="rh-body"><div class="rh-label">Section 02</div><div class="rh-title">Complete Module Overview</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">
  <div class="section-title">9 Integrated Modules — One Unified Platform</div>
  <p>Every module is deeply integrated. Data flows automatically from one stage to the next, eliminating re-entry and ensuring consistency across your entire research management process.</p>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:10px;">
    <tr>
      <td class="col2-l">
        @foreach([
          ['#1e40af','#1e3a5f','#2563eb','01 Proposal Management','7-step guided wizard · Tracker number system · Multi-call support · Category routing (Research / Community / Technology) · Draft auto-save · Deadline enforcement · Archive & revision workflow'],
          ['#065f46','#064e3b','#10b981','03 Finance & Budget','Budget allocations per college · Digital budget requests · Multi-signatory e-signature workflow · Disbursement tracking · Settlement & expense verification · Milestone gating'],
          ['#0f766e','#134e4a','#14b8a6','05 Monitoring','Midterm evaluations (bulk scheduling) · Progress & financial report submission · Completion workshops · Final evidence collection · Officer scoring & recommendation'],
          ['#78350f','#451a03','#f59e0b','07 External Funds','Funding opportunity listings (public) · Internal review & approval workflow · Award tracking · Milestone & expenditure management · Multi-currency support'],
          ['#3b1f1f','#2d1515','#f97316','09 Similarity Detection','TF-IDF cosine similarity algorithm · Configurable threshold · Automatic flag on every submission · Officer review dashboard · No third-party API required'],
        ] as $m)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr><td style="background:{{ $m[0] }}; padding:9px 12px; border-left:4px solid {{ $m[2] }};"><div style="font-size:10pt; font-weight:bold; color:#fff;">{{ $m[3] }}</div></td></tr>
          <tr><td style="background:#f8fafc; border:1px solid #e2e8f0; border-top:none; padding:8px 12px; font-size:8.5pt; color:#475569; line-height:1.6;">{{ $m[4] }}</td></tr>
        </table>
        @endforeach
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        @foreach([
          ['#4c1d95','#2d1b69','#7c3aed','02 Review & Evaluation','4-stage pipeline · Blind peer review (anonymous) · Open defence scheduling · Central evaluation · Custom scoring rubrics · Reviewer workload balancing · Conflict-of-interest detection'],
          ['#78350f','#451a03','#f59e0b','04 Analytics & Reports','Live dashboard · Proposal pipeline charts · College performance · Budget utilization · Reviewer metrics · Annual reports · CSV / Excel / PDF export · Custom date ranges'],
          ['#1e1b4b','#1e1b4b','#818cf8','06 Conferences & Abstracts','Conference management with public page · Speaker & session management · Abstract submissions with token tracking · Peer review of abstracts · Acceptance notifications'],
          ['#9f1239','#4c0519','#f43f5e','08 Research Repository','Public-facing searchable repository · Browse & search by keyword, category, year · Officer publish/unpublish control · Linked to proposals & research outputs'],
          ['#b91c1c','#7f1d1d','#f87171','Complaints Module','Formal complaint filing · Category & stage classification · Officer assignment · Investigation tracking · Resolution & escalation · Full notification chain'],
        ] as $m)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr><td style="background:{{ $m[0] }}; padding:9px 12px; border-left:4px solid {{ $m[2] }};"><div style="font-size:10pt; font-weight:bold; color:#fff;">{{ $m[3] }}</div></td></tr>
          <tr><td style="background:#f8fafc; border:1px solid #e2e8f0; border-top:none; padding:8px 12px; font-size:8.5pt; color:#475569; line-height:1.6;">{{ $m[4] }}</td></tr>
        </table>
        @endforeach
      </td>
    </tr>
  </table>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Module Overview &nbsp;&#183;&nbsp; Page 3</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 4  LIFECYCLE --}}
<div class="rh"><table><tr><td class="rh-accent"></td><td class="rh-body"><div class="rh-label">Section 03</div><div class="rh-title">The Research Lifecycle</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">
  <div class="section-title">End-to-End Workflow — Fully Automated &amp; Enforced</div>
  <p>Every transition is logged, every stakeholder notified, and no step can be skipped. The platform enforces the workflow at the API level — not just the UI.</p>

  @foreach([
    ['#1e40af','#2563eb','Phase 1 — Submission','Draft','Submitted','Validated','Tracker Number issued & confirmation sent'],
    ['#4c1d95','#7c3aed','Phase 2 — Review','Blind Review','Open Defence','Central Eval.','Accepted (or Rejected at any stage)'],
    ['#065f46','#10b981','Phase 3 — Funding','Funded','Budget Request','Disbursed','Settled'],
    ['#0f766e','#14b8a6','Phase 4 — Completion','Midterm Eval.','Completion Workshop','Completed','Published to Repository'],
  ] as $phase)
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:10px;">
    <tr><td colspan="9" style="padding-bottom:4px;"><span style="background:{{ $phase[0] }}; color:#fff; padding:3px 10px; font-size:7.5pt; font-weight:bold; letter-spacing:1px; text-transform:uppercase;">{{ $phase[2] }}</span></td></tr>
    <tr>
      <td width="19%" style="background:{{ $phase[0] }}; border:2px solid {{ $phase[1] }}; text-align:center; padding:9px 4px; font-size:8.5pt; font-weight:bold; color:#fff;">{{ $phase[3] }}</td>
      <td width="4%" style="text-align:center; color:{{ $phase[1] }}; font-size:16pt; font-weight:bold; vertical-align:middle;">&#8594;</td>
      <td width="19%" style="background:{{ $phase[0] }}; border:2px solid {{ $phase[1] }}; text-align:center; padding:9px 4px; font-size:8.5pt; font-weight:bold; color:#fff;">{{ $phase[4] }}</td>
      <td width="4%" style="text-align:center; color:{{ $phase[1] }}; font-size:16pt; font-weight:bold; vertical-align:middle;">&#8594;</td>
      <td width="19%" style="background:{{ $phase[0] }}; border:2px solid {{ $phase[1] }}; text-align:center; padding:9px 4px; font-size:8.5pt; font-weight:bold; color:#fff;">{{ $phase[5] }}</td>
      <td width="4%" style="text-align:center; color:{{ $phase[1] }}; font-size:16pt; font-weight:bold; vertical-align:middle;">&#8594;</td>
      <td width="31%" style="background:#f8fafc; border:2px dashed {{ $phase[1] }}; text-align:center; padding:9px 4px; font-size:8pt; color:{{ $phase[0] }}; font-style:italic;">{{ $phase[6] }}</td>
    </tr>
  </table>
  @endforeach

  <div style="height:6px;"></div>
  <div class="section-title">Key Workflow Guarantees</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="col2-l">
        @foreach([
          ['#1e40af','Automatic Notifications','Every workflow transition triggers targeted notifications to the right stakeholders across email, in-app, and Telegram — no manual follow-up needed.'],
          ['#065f46','Role-Scoped Visibility','Officers see only proposals within their category/college. Data boundaries enforced at the API level — not just the UI.'],
          ['#4c1d95','Full Audit Trail','Every action is logged with timestamp, actor, and IP address. Immutable, queryable by admins, read-only at the database level.'],
        ] as $g)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td width="36px" style="background:{{ $g[0] }}; text-align:center; padding:10px 4px; vertical-align:top;"><div style="font-size:13pt; color:#fff;">&#10003;</div></td>
            <td style="border:1px solid #e2e8f0; border-left:none; padding:9px 11px; vertical-align:top;">
              <div style="font-size:9.5pt; font-weight:bold; color:#0f172a; margin-bottom:3px;">{{ $g[1] }}</div>
              <div style="font-size:8.5pt; color:#475569; line-height:1.55;">{{ $g[2] }}</div>
            </td>
          </tr>
        </table>
        @endforeach
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        @foreach([
          ['#78350f','Deadline Management','Automatic reminders at 7-day, 3-day, and 1-day intervals. Late submissions are automatically blocked after the call deadline passes.'],
          ['#0f766e','Rejection at Any Stage','Proposals can be rejected at validation, review, defence, or central evaluation. Every rejection requires a documented reason sent to the PI immediately.'],
          ['#9f1239','Feature Toggle System','Every major module can be enabled or disabled instantly. Flip a toggle in Feature Management — no code deployment or server restart required.'],
        ] as $g)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
          <tr>
            <td width="36px" style="background:{{ $g[0] }}; text-align:center; padding:10px 4px; vertical-align:top;"><div style="font-size:13pt; color:#fff;">&#10003;</div></td>
            <td style="border:1px solid #e2e8f0; border-left:none; padding:9px 11px; vertical-align:top;">
              <div style="font-size:9.5pt; font-weight:bold; color:#0f172a; margin-bottom:3px;">{{ $g[1] }}</div>
              <div style="font-size:8.5pt; color:#475569; line-height:1.55;">{{ $g[2] }}</div>
            </td>
          </tr>
        </table>
        @endforeach
      </td>
    </tr>
  </table>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Research Lifecycle &nbsp;&#183;&nbsp; Page 4</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 5  REVIEW ENGINE --}}
<div class="rh"><table><tr><td class="rh-accent" style="background:#7c3aed;"></td><td class="rh-body"><div class="rh-label">Section 04</div><div class="rh-title">Review &amp; Evaluation Engine</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">
  <div class="section-title">Four-Stage Peer Review — Rigorous, Fair &amp; Documented</div>

  @foreach([
    ['01','#1e40af','#dbeafe','Validation','Initial eligibility screening. Officer checks completeness, category correctness, and compliance with call criteria. Actions: Approve for Review, Return for Revision (with comments), or Reject (with documented reason sent to PI immediately).'],
    ['02','#4c1d95','#c7d2fe','Blind Peer Review','Officers assign 2–5 expert reviewers. PI identity fully hidden at the API level. Reviewers evaluate using custom scoring rubrics (Scientific Merit, Methodology, Budget, Impact, Feasibility). Automatic conflict-of-interest detection. Workload balancing dashboard included.'],
    ['03','#0f766e','#a7f3d0','Open Defence','Officer schedules a defence session (physical, virtual, or hybrid). PI presents to the panel. Session details automatically communicated to all participants. Panel records outcome: Accepted or Rejected with session notes.'],
    ['04','#78350f','#fde68a','Central Evaluation','Final approval by the Central Officer, who reviews all prior scores and defence notes before making a funding recommendation. Approved proposals enter the Finance module for budget allocation and grant letter generation.'],
  ] as $s)
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
    <tr>
      <td width="38px" style="background:{{ $s[1] }}; text-align:center; font-size:13pt; font-weight:bold; color:#fff; vertical-align:top; padding:12px 4px;">{{ $s[0] }}</td>
      <td style="border:1px solid {{ $s[2] }}; border-left:none; padding:10px 14px;">
        <div style="font-size:10pt; font-weight:bold; color:{{ $s[1] }}; margin-bottom:4px;">{{ $s[2] === '#dbeafe' ? 'Validation' : ($s[2] === '#c7d2fe' ? 'Blind Peer Review' : ($s[2] === '#a7f3d0' ? 'Open Defence' : 'Central Evaluation')) }}</div>
        <div style="font-size:8.5pt; color:#475569; line-height:1.6;">{{ $s[4] }}</div>
      </td>
    </tr>
  </table>
  @endforeach

  <div class="section-title">Reviewer Management Features</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="col2-l">
        <div class="feat-card" style="border-left-color:#7c3aed;"><div class="fc-title" style="color:#4c1d95;">Smart Reviewer Assignment</div><div class="fc-body">Search by expertise, department, college. View current workload before assigning. Automatic co-authorship conflict detection. Workload is shown before assignment so distribution stays fair.</div></div>
        <div class="feat-card" style="border-left-color:#7c3aed;"><div class="fc-title" style="color:#4c1d95;">Custom Scoring Rubrics</div><div class="fc-body">Administrators define evaluation types, categories, and questions. Each question has a configurable max score and evaluation method — numeric scale or descriptive levels (Poor / Fair / Good / Excellent).</div></div>
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        <div class="feat-card" style="border-left-color:#7c3aed;"><div class="fc-title" style="color:#4c1d95;">Due Date Management</div><div class="fc-body">Review deadlines enforced with automatic reminders. Officers can extend deadlines or reassign overdue reviews. Overdue assignments highlighted in red in the workload dashboard.</div></div>
        <div class="feat-card" style="border-left-color:#7c3aed;"><div class="fc-title" style="color:#4c1d95;">Workload Dashboard</div><div class="fc-body">Real-time view of all reviewer workloads: active assignments, completed reviews, average completion time, overdue highlights. Makes reviewer assignment data-driven and fair.</div></div>
      </td>
    </tr>
  </table>
  <div class="callout-blue"><strong>Blind Review Integrity Guarantee:</strong> During blind review, the PI's name, photo, college, and all identifying information are stripped at the API level — not just hidden in the UI. Reviewers cannot discover PI identity through any system channel.</div>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Review &amp; Evaluation &nbsp;&#183;&nbsp; Page 5</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 6  FINANCE --}}
<div class="rh"><table><tr><td class="rh-accent" style="background:#10b981;"></td><td class="rh-body"><div class="rh-label">Section 05</div><div class="rh-title">Finance &amp; Budget Management</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">
  <div class="section-title" style="color:#065f46; border-bottom-color:#065f46;">Full Budget Lifecycle — From Allocation to Settlement</div>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:14px;">
    <tr>
      @foreach(['Budget Allocation','Budget Request','E-Signatures','College Review','Disbursement','Settlement'] as $i => $step)
      @if($i > 0)<td style="text-align:center; font-size:14pt; color:#10b981; width:16px;">&#8594;</td>@endif
      <td style="background:{{ $i % 2 === 0 ? '#065f46' : '#064e3b' }}; color:#fff; text-align:center; padding:9px 5px; font-size:8pt; font-weight:bold;">{{ $step }}</td>
      @endforeach
    </tr>
  </table>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="col2-l">
        @foreach([
          ['Budget Allocations','Finance Officers define total funding per college per fiscal year. Allocations can be pending or approved; the system tracks utilization in real-time. Bulk approval supported.'],
          ['E-Signature Workflow','Budget requests require digital signatures from designated approvers (Dept Head, Dean) before submission. Each signatory is notified in sequence and signs within the platform. No printing required.'],
          ['Settlements','Research teams submit expense reports to justify disbursed funds. Finance Officer verifies then finalizes. Discrepancies can be flagged for return and revision before settlement is approved.'],
        ] as $f)
        <div style="border-left:4px solid #10b981; background:#f0fdf4; padding:9px 12px; margin-bottom:8px;">
          <div style="font-size:9.5pt; font-weight:bold; color:#065f46; margin-bottom:3px;">{{ $f[0] }}</div>
          <div style="font-size:8.5pt; color:#064e3b; line-height:1.55;">{{ $f[1] }}</div>
        </div>
        @endforeach
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        @foreach([
          ['Budget Requests','PIs create detailed requests with categorized line items each requiring amount and justification. A configurable form template governs required sections and signatory chains.'],
          ['Disbursements','After college and finance approval, Finance Officer records the actual fund transfer: date, amount, payment reference, and proof of payment upload. PI notified immediately.'],
          ['Budget Milestones','Budget requests for Round 2 are unlocked only after the PI completes a midterm evaluation — ensuring full accountability and progress verification at each project phase.'],
        ] as $f)
        <div style="border-left:4px solid #10b981; background:#f0fdf4; padding:9px 12px; margin-bottom:8px;">
          <div style="font-size:9.5pt; font-weight:bold; color:#065f46; margin-bottom:3px;">{{ $f[0] }}</div>
          <div style="font-size:8.5pt; color:#064e3b; line-height:1.55;">{{ $f[1] }}</div>
        </div>
        @endforeach
      </td>
    </tr>
  </table>

  <div class="section-title" style="color:#065f46; border-bottom-color:#065f46; margin-top:6px;">Budget Categories Supported</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      @foreach(['Personnel','Equipment','Materials','Travel','Training','Software','Publication','Overhead','Other'] as $i => $cat)
      <td style="background:{{ $i % 2 === 0 ? '#065f46' : '#064e3b' }}; color:#fff; text-align:center; padding:8px 4px; font-size:8pt; font-weight:bold; border:1px solid #053a2b;">{{ $cat }}</td>
      @endforeach
    </tr>
  </table>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Finance &amp; Budget &nbsp;&#183;&nbsp; Page 6</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 7  SECURITY & ROLES --}}
<div class="rh"><table><tr><td class="rh-accent" style="background:#7c3aed;"></td><td class="rh-body"><div class="rh-label">Section 06</div><div class="rh-title">Security, Roles &amp; Administration</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">
  <div class="section-title">Role-Based Access Control</div>
  <table class="dt" style="margin-bottom:12px;">
    <tr><th width="28%">Role</th><th>Scope &amp; Capabilities</th></tr>
    <tr><td style="background:#eff6ff; color:#1e40af; font-weight:bold;">Super Admin</td><td style="background:#eff6ff;">Full access to all features, settings, permissions, roles, impersonation, and system configuration</td></tr>
    <tr><td style="font-weight:bold; color:#334155;">Central Officer</td><td>Oversees all proposals across all categories; performs central evaluation; system-wide monitoring</td></tr>
    <tr><td style="font-weight:bold; color:#334155; background:#f8fafc;">Research / Community / Technology Officer</td><td style="background:#f8fafc;">Validates and manages proposals within their assigned category scope only</td></tr>
    <tr><td style="font-weight:bold; color:#334155;">College Officer</td><td>Manages all proposals, users, and budget requests within their assigned college only</td></tr>
    <tr><td style="font-weight:bold; color:#065f46; background:#f0fdf4;">Finance Officer</td><td style="background:#f0fdf4;">Budget allocations, disbursements, settlements, proposal funding decisions; cross-college visibility</td></tr>
    <tr><td style="font-weight:bold; color:#334155;">Staff / Researcher</td><td>Submits and tracks own proposals; acts as reviewer when assigned; receives all relevant notifications</td></tr>
    <tr><td style="font-weight:bold; color:#64748b;">Guest</td><td>Read-only access to public pages: proposal calls, repository, conferences, funding opportunities</td></tr>
  </table>

  <div class="section-title">Security Features</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="col2-l">
        @foreach([
          ['Authentication Options','Email/password · Microsoft Azure AD SSO · Telegram login · Two-Factor Authentication (2FA) via email OTP — all configurable per deployment. Mix and match as needed.'],
          ['Immutable Audit Log','Every significant action is logged with actor, timestamp, IP address, affected record, and before/after values. Read-only at the database level. Cannot be edited or deleted — ever.'],
          ['Secure File Storage','All uploaded documents stored in a private disk with time-limited, signed download URLs. Unauthorized access is impossible even if someone obtains the file path directly.'],
        ] as $sf)
        <div class="feat-card" style="border-left-color:#7c3aed;"><div class="fc-title" style="color:#4c1d95;">{{ $sf[0] }}</div><div class="fc-body">{{ $sf[1] }}</div></div>
        @endforeach
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        @foreach([
          ['Inactive User Blocking','Deactivated users are blocked from all system activity immediately — API calls, file access, and login. No partial access possible after deactivation.'],
          ['Session Security','Configurable session timeout with inactivity warning + auto-logout. Configurable max concurrent sessions per user. Sanctum Bearer token auth for all API calls.'],
          ['Administration','User management (create, edit, bulk CSV import, role assignment) · College/dept structure · Feature toggles · System settings · Public site content · Login notices'],
        ] as $sf)
        <div class="feat-card" style="border-left-color:#7c3aed;"><div class="fc-title" style="color:#4c1d95;">{{ $sf[0] }}</div><div class="fc-body">{{ $sf[1] }}</div></div>
        @endforeach
      </td>
    </tr>
  </table>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Security &amp; Roles &nbsp;&#183;&nbsp; Page 7</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 8  TECH SPECS --}}
<div class="rh"><table><tr><td class="rh-accent" style="background:#f59e0b;"></td><td class="rh-body"><div class="rh-label">Section 07</div><div class="rh-title">Technical Specifications</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">
  <div class="section-title">Enterprise-Grade Modern Technology Stack</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:12px;">
    <tr>
      <td class="col2-l">
        <div class="tech-panel" style="margin-bottom:8px;">
          <div class="tp-head">Backend</div>
          <div class="tp-item"><span class="tp-hi">PHP 8.4</span> &nbsp;&#183;&nbsp; <span class="tp-hi">Laravel 13</span></div>
          <div class="tp-item tp-dim">RESTful API with Sanctum Bearer Auth</div>
          <div class="tp-item"><span class="tp-hi">Sanctum v4</span> &nbsp;&#183;&nbsp; <span class="tp-hi">Spatie Permissions</span></div>
          <div class="tp-item"><span class="tp-hi">DomPDF</span> &nbsp;&#183;&nbsp; <span class="tp-hi">Maatwebsite Excel</span></div>
          <div class="tp-item"><span class="tp-hi">Laravel Socialite v5</span> <span class="tp-dim">(OAuth / SSO)</span></div>
          <div class="tp-item tp-dim">Queue system · Email + Telegram notifications</div>
          <div class="tp-item"><span class="tp-hi">TF-IDF Similarity Engine</span> <span class="tp-dim">(custom PHP)</span></div>
        </div>
        <div class="tech-panel">
          <div class="tp-head">Database</div>
          <div class="tp-item"><span class="tp-hi">MySQL 8</span> <span class="tp-dim">(primary · recommended)</span></div>
          <div class="tp-item"><span class="tp-hi">PostgreSQL 15+</span> <span class="tp-dim">(fully supported)</span></div>
          <div class="tp-item tp-dim">UUID primary keys across all tables</div>
          <div class="tp-item tp-dim">Full Eloquent ORM with eager loading</div>
          <div class="tp-item"><span class="tp-hi">Migrations</span> &nbsp;&#183;&nbsp; <span class="tp-hi">Seeders</span> &nbsp;&#183;&nbsp; Scheduler backups</div>
        </div>
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        <div class="tech-panel" style="margin-bottom:8px;">
          <div class="tp-head">Frontend</div>
          <div class="tp-item"><span class="tp-hi">React 19</span> &nbsp;&#183;&nbsp; <span class="tp-hi">Inertia.js v3</span></div>
          <div class="tp-item tp-dim">SPA without build complexity</div>
          <div class="tp-item"><span class="tp-hi">Tailwind CSS v4</span> &nbsp;&#183;&nbsp; <span class="tp-hi">Vite</span></div>
          <div class="tp-item"><span class="tp-hi">Recharts</span> <span class="tp-dim">(analytics dashboards)</span></div>
          <div class="tp-item"><span class="tp-hi">Lucide React</span> <span class="tp-dim">(icon library)</span></div>
          <div class="tp-item tp-dim">Deferred/prefetched data loading</div>
          <div class="tp-item tp-dim">Responsive design · Optimistic UI updates</div>
        </div>
        <div class="tech-panel">
          <div class="tp-head">Infrastructure &amp; Testing</div>
          <div class="tp-item"><span class="tp-hi">Laravel Cloud</span> <span class="tp-dim">(recommended)</span></div>
          <div class="tp-item tp-dim">Standard Linux VPS (self-hosted option)</div>
          <div class="tp-item tp-dim">Nginx / Apache compatible</div>
          <div class="tp-item tp-dim">Private &amp; public file storage disks</div>
          <div class="tp-item"><span class="tp-hi">Pest v4</span> &nbsp;&#183;&nbsp; <span class="tp-hi">PHPUnit v12</span></div>
          <div class="tp-item tp-dim">CI/CD ready · Docker compatible</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="section-title">System Requirements</div>
  <table class="dt">
    <tr><th width="22%">Component</th><th>Minimum</th><th>Recommended</th></tr>
    <tr><td><strong>PHP</strong></td><td>8.2+</td><td>8.4</td></tr>
    <tr><td><strong>Database</strong></td><td>MySQL 8.0 or PostgreSQL 15</td><td>MySQL 8.0+ with dedicated server</td></tr>
    <tr><td><strong>Web Server</strong></td><td>Nginx 1.20+ or Apache 2.4+</td><td>Nginx with SSL termination</td></tr>
    <tr><td><strong>RAM</strong></td><td>2 GB</td><td>4 GB+ for large institutions</td></tr>
    <tr><td><strong>Storage</strong></td><td>20 GB</td><td>100 GB+ with document uploads</td></tr>
    <tr><td><strong>Browser</strong></td><td>Any modern browser</td><td>Chrome 110+ / Edge 110+ / Firefox 110+</td></tr>
  </table>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Technical Specifications &nbsp;&#183;&nbsp; Page 8</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 9  WHY RTT --}}
<div class="rh"><table><tr><td class="rh-accent"></td><td class="rh-body"><div class="rh-label">Section 08</div><div class="rh-title">Why RTT Platform &amp; Getting Started</div></td><td style="text-align:right;"><span style="color:#60a5fa; font-size:8pt;">RTT PLATFORM</span></td></tr></table></div>
<div class="page-body">
  <div class="section-title">10 Compelling Reasons to Choose RTT Platform</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:14px;">
    <tr>
      <td class="col2-l">
        @foreach([
          ['01','#1e40af','Purpose-built for universities','Every feature — from category-scoped officers to blind review integrity — was designed specifically for higher education research management.'],
          ['02','#1e40af','End-to-end in one system','No separate tools for proposals, reviews, budgets, and reports. One login, one system, one source of truth for all research data.'],
          ['03','#1e40af','Feature toggle flexibility','Enable only the modules your institution needs today. Scale up as your program grows — no redeployment required.'],
          ['04','#065f46','Modern, fast user experience','React 19 + Inertia.js — fast, responsive, intuitive. No page reloads. Real-time updates. Clean professional design.'],
          ['05','#065f46','Compliance & transparency','Immutable audit logs, role-enforced data access, and documented decision trails satisfy accreditation and governance requirements.'],
        ] as $r)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:7px;">
          <tr>
            <td width="36px" style="background:{{ $r[1] }}; text-align:center; font-size:11pt; font-weight:bold; color:#fff; padding:10px 4px; vertical-align:top;">{{ $r[0] }}</td>
            <td style="border:1px solid #e2e8f0; border-left:none; padding:9px 11px; vertical-align:top;">
              <div style="font-size:9.5pt; font-weight:bold; color:#0f172a; margin-bottom:3px;">{{ $r[2] }}</div>
              <div style="font-size:8.5pt; color:#475569; line-height:1.55;">{{ $r[3] }}</div>
            </td>
          </tr>
        </table>
        @endforeach
      </td>
      <td class="col2-gap"></td>
      <td class="col2-r">
        @foreach([
          ['06','#065f46','Microsoft SSO & Telegram','Seamless institutional Microsoft login. Telegram notifications keep researchers updated without email overload.'],
          ['07','#4c1d95','Similarity detection built-in','Automated TF-IDF cosine similarity flags potential duplicates at submission — protecting research integrity without third-party APIs.'],
          ['08','#4c1d95','Comprehensive test coverage','Built with Pest v4 / PHPUnit v12. A full feature test suite verifies every critical workflow before each deployment.'],
          ['09','#4c1d95','Data ownership & self-hosting','Deploy on your own server. Your research data stays within your institution. Full database access and backups under your control.'],
          ['10','#78350f','Proven in production','Deployed at {{ $orgName }} managing real proposals, budgets, and evaluations — continuously improved from real-world feedback.'],
        ] as $r)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:7px;">
          <tr>
            <td width="36px" style="background:{{ $r[1] }}; text-align:center; font-size:11pt; font-weight:bold; color:#fff; padding:10px 4px; vertical-align:top;">{{ $r[0] }}</td>
            <td style="border:1px solid #e2e8f0; border-left:none; padding:9px 11px; vertical-align:top;">
              <div style="font-size:9.5pt; font-weight:bold; color:#0f172a; margin-bottom:3px;">{{ $r[2] }}</div>
              <div style="font-size:8.5pt; color:#475569; line-height:1.55;">{{ $r[3] }}</div>
            </td>
          </tr>
        </table>
        @endforeach
      </td>
    </tr>
  </table>

  <div class="section-title">Implementation Timeline</div>
  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      @foreach([
        ['#1e3a5f','#2563eb','#60a5fa','Week 1–2','Server setup · Database config · Initial data import (colleges, departments, users)'],
        ['#065f46','#10b981','#6ee7b7','Week 3–4','Admin & officer training · System settings · Proposal calls · Evaluation criteria setup'],
        ['#78350f','#f59e0b','#fcd34d','Week 5–6','Researcher onboarding · Pilot proposal call · Support & feedback collection'],
        ['#4c1d95','#7c3aed','#c4b5fd','Week 7+','Full go-live · Ongoing support · Feature rollout per roadmap'],
      ] as $i => $t)
      @if($i > 0)<td width="6px" style="background:#0f172a;"></td>@endif
      <td style="background:{{ $t[0] }}; border-top:4px solid {{ $t[1] }}; padding:12px 10px; text-align:center; vertical-align:top;">
        <div style="font-size:7.5pt; color:{{ $t[2] }}; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px;">{{ $t[3] }}</div>
        <div style="font-size:8.5pt; color:#e2e8f0; line-height:1.6;">{{ $t[4] }}</div>
      </td>
      @endforeach
    </tr>
  </table>
</div>
<div class="rf"><table><tr><td>RTT Platform — Product Showcase &nbsp;|&nbsp; {{ $orgName }}</td><td class="rf-right">Why RTT Platform &nbsp;&#183;&nbsp; Page 9</td></tr></table></div>

<div class="pb"></div>

{{-- PAGE 10  BACK COVER --}}
<table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; height:842px;">
  <tr>
    <td style="background:#0f172a; padding:0; vertical-align:top; height:842px;">
      <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="background:#2563eb; height:5px;"></td>
          <td style="background:#10b981; height:5px; width:28%;"></td>
          <td style="background:#7c3aed; height:5px; width:14%;"></td>
        </tr>
      </table>
      <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; height:800px;">
        <tr><td style="text-align:center; vertical-align:middle; padding:50px 60px;">
          <div style="font-size:22pt; font-weight:bold; color:#fff; margin-bottom:8px;">Ready to Transform Your</div>
          <div style="font-size:22pt; font-weight:bold; color:#60a5fa; margin-bottom:18px;">Research Management?</div>
          <div style="font-size:10.5pt; color:#94a3b8; margin-bottom:40px; line-height:1.7;">Let us walk you through a live demonstration<br/>tailored to your institution's specific needs and workflows.</div>
          <table cellpadding="0" cellspacing="0" style="width:55%; margin:0 auto; border-collapse:collapse; margin-bottom:36px;">
            <tr><td style="background:#1e3a5f; border:1px solid #2563eb; padding:18px 24px; text-align:left;">
              <div style="font-size:9pt; font-weight:bold; color:#60a5fa; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px; border-bottom:1px solid #334155; padding-bottom:8px;">Contact Us</div>
              <div style="font-size:9.5pt; color:#cbd5e1; line-height:2.2;">
                <strong style="color:#fff;">{{ $orgName }}</strong><br/>
                @if($address)<span style="color:#94a3b8;">{{ $address }}</span><br/>@endif
                @if($phone)<span style="color:#94a3b8;">{{ $phone }}</span><br/>@endif
                @if($email)<span style="color:#94a3b8;">{{ $email }}</span><br/>@endif
                @if($website)<span style="color:#60a5fa;">{{ $website }}</span><br/>@endif
              </div>
            </td></tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="width:80%; margin:0 auto; border-collapse:collapse; margin-bottom:30px;">
            <tr>
              @foreach([['#1e3a5f','#334155','#93c5fd','Proposals'],['#064e3b','#065f46','#6ee7b7','Finance'],['#2d1b69','#4c1d95','#c4b5fd','Review'],['#134e4a','#0f766e','#5eead4','Monitoring'],['#451a03','#78350f','#fcd34d','Analytics']] as $i => $m)
              @if($i > 0)<td width="3px"></td>@endif
              <td style="padding:7px 8px; background:{{ $m[0] }}; border:1px solid {{ $m[1] }}; text-align:center; font-size:7.5pt; color:{{ $m[2] }}; font-weight:bold;">{{ $m[3] }}</td>
              @endforeach
            </tr>
          </table>
          <div style="font-size:8pt; color:#475569; margin-bottom:5px;">This document is confidential and intended for prospective partner institutions only.</div>
          <div style="font-size:8pt; color:#475569;">RTT Platform &nbsp;&#183;&nbsp; Version 1.0 &nbsp;&#183;&nbsp; {{ $year }} &nbsp;&#183;&nbsp; All rights reserved &nbsp;&#183;&nbsp; {{ $orgName }}</div>
        </td></tr>
      </table>
    </td>
  </tr>
</table>

</body>
</html>
