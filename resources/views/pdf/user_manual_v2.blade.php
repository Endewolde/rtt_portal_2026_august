<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>RTT Platform — User Manual</title>
<style>
@page { margin: 0; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #1e293b; background: #fff; line-height: 1.6; }
.pb { page-break-after: always; }

/* ─── Chapter header ─────────────────── */
.ch { padding: 0; }
.ch-bar { height: 5px; }
.ch-head { padding: 10px 22mm 9px; }
.ch-head-inner { border-left: 5px solid; padding-left: 12px; }
.ch-label { font-size: 7pt; letter-spacing: 2.5px; text-transform: uppercase; margin-bottom: 2px; }
.ch-title { font-size: 14pt; font-weight: bold; color: #fff; }

/* ─── Page body ──────────────────────── */
.cb { padding: 14px 22mm 10px; }

/* ─── Footer ─────────────────────────── */
.cf { border-top: 2px solid; padding: 5px 22mm; }
.cf table { width: 100%; border-collapse: collapse; }
.cf td { font-size: 7.5pt; color: #64748b; }
.cf .cfr { text-align: right; font-weight: bold; }

/* ─── Typography ─────────────────────── */
.sec  { font-size: 12pt; font-weight: bold; border-bottom: 2px solid; padding-bottom: 4px; margin: 12px 0 8px; }
.sub  { font-size: 10.5pt; font-weight: bold; color: #0f172a; margin: 10px 0 4px; }
.sub2 { font-size: 9.5pt; font-weight: bold; color: #334155; margin: 7px 0 3px; border-left: 3px solid #cbd5e1; padding-left: 7px; }
p { margin-bottom: 7px; color: #334155; }

/* ─── Step list ──────────────────────── */
.steps { list-style: none; padding: 0; margin-bottom: 8px; }
.steps li { padding: 4px 0 4px 38px; position: relative; color: #334155; font-size: 9pt; margin-bottom: 2px; }
.steps li .sn { position: absolute; left: 0; top: 3px; width: 24px; height: 24px; text-align: center; line-height: 24px; font-size: 8.5pt; font-weight: bold; color: #fff; }

.bullets { padding-left: 18px; margin-bottom: 8px; color: #334155; font-size: 9pt; }
.bullets li { margin-bottom: 3px; }

/* ─── Callout boxes ──────────────────── */
.note   { background: #eff6ff; border-left: 4px solid #2563eb; padding: 8px 12px; margin: 8px 0; font-size: 9pt; color: #1e3a5f; }
.tip    { background: #f0fdf4; border-left: 4px solid #10b981; padding: 8px 12px; margin: 8px 0; font-size: 9pt; color: #064e3b; }
.warn   { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 8px 12px; margin: 8px 0; font-size: 9pt; color: #78350f; }
.danger { background: #fff1f2; border-left: 4px solid #e11d48; padding: 8px 12px; margin: 8px 0; font-size: 9pt; color: #9f1239; }

/* ─── Tables ─────────────────────────── */
.dt      { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 8px; }
.dt th   { background: #1e3a5f; color: #fff; padding: 7px 10px; text-align: left; font-size: 8.5pt; }
.dt td   { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #334155; }
.dt tr:nth-child(even) td { background: #f8fafc; }

.ft      { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 6px 0 8px; }
.ft th   { background: #334155; color: #fff; padding: 6px 9px; text-align: left; font-size: 8.5pt; }
.ft td   { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
.ft td.req { color: #dc2626; font-weight: bold; text-align: center; }
.ft tr:nth-child(even) td { background: #f8fafc; }

/* ─── Path box ───────────────────────── */
.path { background: #0f172a; color: #7dd3fc; padding: 4px 10px; font-size: 8pt; margin: 4px 0 8px; font-family: "Courier New", monospace; }

/* ─── Workflow flow ──────────────────── */
.flow { font-size: 8pt; background: #f1f5f9; border: 1px solid #e2e8f0; padding: 8px 12px; margin: 6px 0; color: #475569; font-family: "Courier New", monospace; line-height: 1.8; }

/* ─── Feature highlight ──────────────── */
.fh { border-left: 4px solid #2563eb; background: #f0f6ff; padding: 8px 12px; margin-bottom: 7px; font-size: 9pt; }
.fh strong { color: #1e40af; }

/* ─── Layout ─────────────────────────── */
.col2-l { width: 49%; vertical-align: top; padding-right: 7px; }
.col2-r { width: 49%; vertical-align: top; padding-left: 7px; }
.col2-g { width: 2%; }

/* ─── TOC entry ──────────────────────── */
.toc-major { font-size: 9.5pt; font-weight: bold; color: #0f172a; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
.toc-minor { font-size: 8.5pt; color: #64748b; padding: 2px 0 2px 14px; border-bottom: 1px dotted #f1f5f9; }
.toc-pg { text-align: right; color: #94a3b8; font-size: 8.5pt; }
</style>
</head>
<body>

{{-- COVER --}}
<table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; height:842px;">
  <tr>
    <td style="background:#0f172a; vertical-align:top; height:842px; padding:0;">
      {{-- Top accent bar --}}
      <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="background:#2563eb; height:6px;"></td>
          <td style="background:#10b981; height:6px; width:25%;"></td>
          <td style="background:#7c3aed; height:6px; width:12%;"></td>
          <td style="background:#f59e0b; height:6px; width:8%;"></td>
        </tr>
      </table>

      <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; height:790px;">
        <tr>
          {{-- Left content --}}
          <td width="58%" style="padding:50px 40px; vertical-align:middle;">
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:28px;">
              <tr>
                <td style="width:65px; height:65px; border:3px solid #2563eb; text-align:center; vertical-align:middle; font-size:14pt; font-weight:bold; color:#2563eb;">RTT</td>
                <td style="padding-left:14px; vertical-align:middle;">
                  <div style="font-size:8.5pt; color:#64748b; text-transform:uppercase; letter-spacing:2px; margin-bottom:2px;">{{ $orgName }}</div>
                  <div style="font-size:8pt; color:#475569;">Office of Research &amp; Technology Transfer</div>
                </td>
              </tr>
            </table>

            <div style="font-size:9pt; color:#60a5fa; text-transform:uppercase; letter-spacing:3px; margin-bottom:8px;">User Manual</div>
            <div style="font-size:30pt; font-weight:bold; color:#fff; line-height:1.05; margin-bottom:10px;">RTT<br/>PLATFORM</div>
            <div style="width:44px; height:4px; background:#2563eb; margin-bottom:16px;"></div>
            <div style="font-size:10pt; color:#94a3b8; line-height:1.75; margin-bottom:26px;">A complete guide for researchers, officers,<br/>finance staff, and administrators.</div>

            {{-- Role badges --}}
            <div style="font-size:7.5pt; color:#64748b; text-transform:uppercase; letter-spacing:1px; margin-bottom:8px;">Covers all roles</div>
            <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:5px 11px; background:#1e40af; color:#dbeafe; font-size:8pt; font-weight:bold; border:1px solid #2563eb;">Researchers</td>
                <td width="4px"></td>
                <td style="padding:5px 11px; background:#4c1d95; color:#ede9fe; font-size:8pt; font-weight:bold; border:1px solid #7c3aed;">Officers</td>
                <td width="4px"></td>
                <td style="padding:5px 11px; background:#065f46; color:#d1fae5; font-size:8pt; font-weight:bold; border:1px solid #10b981;">Finance</td>
                <td width="4px"></td>
                <td style="padding:5px 11px; background:#78350f; color:#fef3c7; font-size:8pt; font-weight:bold; border:1px solid #f59e0b;">Admins</td>
              </tr>
            </table>

            <div style="margin-top:32px; font-size:8pt; color:#475569;">Version 1.0 &nbsp;&#183;&nbsp; {{ $year }} &nbsp;&#183;&nbsp; Internal Use Only</div>
          </td>

          {{-- Right sidebar --}}
          <td width="42%" style="background:#111827; vertical-align:top; padding:36px 24px 0 20px; border-left:1px solid #1e3a5f;">
            <div style="font-size:8pt; color:#4b5563; text-transform:uppercase; letter-spacing:2px; margin-bottom:14px;">23 Sections Covered</div>

            @foreach([
              ['#1e40af','#2563eb','1–3','Introduction, Overview &amp; Roles'],
              ['#1e3a5f','#3b82f6','4–6','Getting Started, Dashboard, Research Hub'],
              ['#1e40af','#2563eb','7','Proposal Management (7-step wizard)'],
              ['#4c1d95','#7c3aed','8','Review &amp; Evaluation (4 stages)'],
              ['#065f46','#10b981','9','Finance &amp; Budget Module'],
              ['#0f766e','#14b8a6','10–11','Monitoring &amp; Awarded Proposals'],
              ['#9f1239','#f43f5e','12','Complaints Module'],
              ['#3b1f1f','#f97316','13','Similarity Flags'],
              ['#78350f','#f59e0b','14','External Funds'],
              ['#1e1b4b','#818cf8','15','Conferences &amp; Abstracts'],
              ['#334155','#64748b','16–18','Reports, Notifications &amp; Public Pages'],
              ['#1e3a5f','#3b82f6','19','User Management'],
              ['#0f172a','#475569','20–21','Administration &amp; Settings'],
              ['#064e3b','#10b981','22–23','Troubleshooting &amp; FAQ'],
            ] as $s)
            <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:5px;">
              <tr>
                <td width="32px" style="background:{{ $s[0] }}; border-left:3px solid {{ $s[1] }}; text-align:center; padding:6px 0; font-size:7.5pt; font-weight:bold; color:#fff; vertical-align:middle;">{{ $s[2] }}</td>
                <td style="background:#1a2233; padding:6px 10px; font-size:8pt; color:#cbd5e1;">{{ $s[3] }}</td>
              </tr>
            </table>
            @endforeach
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>

<div class="pb"></div>

{{-- SECTIONS 1–3 --}}
<div class="ch">
  <div style="background:#1e3a5f;"><div class="ch-bar" style="background:#2563eb;"></div>
  <div class="ch-head" style="background:#1e3a5f;"><div class="ch-head-inner" style="border-left-color:#2563eb;"><div class="ch-label" style="color:#93c5fd;">Sections 1 – 3</div><div class="ch-title">Introduction, System Overview &amp; User Roles</div></div></div></div>
</div>
<div class="cb">

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">1. Introduction</div>
  <p>Welcome to the <strong>RTT Platform</strong> — the Research and Technology Transfer Management System for <strong>{{ $orgName }}</strong>. This platform supports the complete lifecycle of research proposals: from initial submission through peer review, funding, monitoring, and final completion. It also manages conferences, external grants, budget requests, and research output publications.</p>
  <div class="note"><strong>How to use this manual:</strong> Use the section numbers as reference. Sections marked <em>(Admin)</em> require officer or administrative access. Sections marked <em>(Feature-gated)</em> may not be visible if your administrator has disabled that module.</div>

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">2. System Overview</div>
  <table class="dt" style="margin-bottom:8px;">
    <tr><th width="26%">Module</th><th>Purpose</th></tr>
    @foreach([
      ['Proposals','Submit, track, and manage research proposals through a multi-stage review workflow'],
      ['Review & Evaluation','Multi-stage peer review: validation, blind review, open defence, central evaluation'],
      ['Finance','Budget allocations, budget requests, disbursements, and settlements'],
      ['Monitoring','Midterm evaluations, completion workshops, research outputs'],
      ['Reports','Analytics, performance metrics, and exportable reports'],
      ['External Funds','Manage applications for external grants and donor funding'],
      ['Conferences','Conference management and abstract submission'],
      ['Repository','Public listing of completed research outputs'],
      ['Complaints','File and resolve complaints about the review process'],
      ['Administration','User management, roles, colleges, departments, system settings'],
    ] as $m)
    <tr><td><strong>{{ $m[0] }}</strong></td><td>{{ $m[1] }}</td></tr>
    @endforeach
  </table>

  <div class="sub">Proposal Lifecycle</div>
  <div class="flow">Draft → Submitted → Validated → Under Blind Review → Open Defence → Accepted
     → Funded → Midterm Evaluation → Completion Workshop → Completed → Repository
                                              ↘ At any stage: → Rejected</div>

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">3. User Roles &amp; Permissions</div>
  <table class="dt">
    <tr><th width="28%">Role</th><th>Scope &amp; Capabilities</th></tr>
    <tr><td style="background:#eff6ff; font-weight:bold; color:#1e40af;">Super Admin</td><td style="background:#eff6ff;">Full access to all features, settings, roles, permissions, and system configuration</td></tr>
    @foreach([
      ['Central Officer','Oversees all proposals across categories; performs central evaluation; monitors the system'],
      ['Research / Community / Technology Officer','Validates and reviews proposals in their assigned category only (category-scoped)'],
      ['College Officer','Manages proposals, users, and budget requests within their assigned college only'],
      ['Finance Officer','Manages all budget-related processes: allocations, requests, disbursements, settlements'],
      ['Staff / Researcher','Submits and tracks own proposals; receives notifications; participates as reviewer when assigned'],
      ['Guest','Read-only access to public pages: proposals, calls, repository, conferences'],
    ] as $r)
    <tr><td><strong>{{ $r[0] }}</strong></td><td>{{ $r[1] }}</td></tr>
    @endforeach
  </table>
  <div class="note"><strong>Scope restrictions:</strong> Category-scoped officers see only their category. College Officers see only their college data. These boundaries are enforced at the API level — not just the UI.</div>

</div>
<div class="cf" style="border-top-color:#2563eb;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#2563eb;">Sections 1–3 &nbsp;&#183;&nbsp; Page 2</td></tr></table></div>

<div class="pb"></div>

{{-- SECTIONS 4–6 --}}
<div class="ch">
  <div style="background:#1e3a5f;"><div class="ch-bar" style="background:#3b82f6;"></div>
  <div class="ch-head" style="background:#1e3a5f;"><div class="ch-head-inner" style="border-left-color:#3b82f6;"><div class="ch-label" style="color:#93c5fd;">Sections 4 – 6</div><div class="ch-title">Getting Started, Dashboard &amp; Research Hub</div></div></div></div>
</div>
<div class="cb">

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">4. Getting Started</div>

  <div class="sub">4.1 Logging In</div>
  <p>Open your web browser and navigate to the RTT Platform URL provided by your institution. Three login methods are supported:</p>
  <table class="dt" style="margin-bottom:8px;">
    <tr><th width="30%">Method</th><th>Steps</th></tr>
    <tr><td><strong>Email &amp; Password</strong></td><td>Enter your email and password → click Sign In → enter 2FA code if prompted</td></tr>
    <tr><td><strong>Microsoft / Azure AD</strong></td><td>Click "Sign in with Microsoft" → complete institutional login → auto-redirected back</td></tr>
    <tr><td><strong>Telegram</strong></td><td>Click "Sign in with Telegram" → follow the bot prompts to link your account</td></tr>
  </table>
  <table class="dt">
    <tr><th width="38%">Error</th><th>Solution</th></tr>
    <tr><td>"Invalid credentials"</td><td>Check email and password. Use "Forgot Password" if needed.</td></tr>
    <tr><td>"Account is inactive"</td><td>Contact your administrator to reactivate.</td></tr>
    <tr><td>"Email not verified"</td><td>Check your inbox and click the verification link.</td></tr>
    <tr><td>"Too many login attempts"</td><td>Wait a few minutes before retrying.</td></tr>
  </table>

  <div class="sub">4.2 Two-Factor Authentication (2FA)</div>
  <p>If 2FA is enabled, after entering credentials you will see a 2FA verification screen. A 6-digit code is sent to your email. Enter the code and click <strong>Verify</strong>. Codes expire after a few minutes — click <strong>Resend Code</strong> if needed.</p>

  <div class="sub">4.3 Password Reset</div>
  <ol class="steps">
    <li><div class="sn" style="background:#1e40af;">1</div>On the login page, click <strong>Forgot Password?</strong></li>
    <li><div class="sn" style="background:#1e40af;">2</div>Enter your registered email and click <strong>Send Reset Link</strong>.</li>
    <li><div class="sn" style="background:#1e40af;">3</div>Open the email and click the reset link (valid for a limited time).</li>
    <li><div class="sn" style="background:#1e40af;">4</div>Enter and confirm your new password → click <strong>Reset Password</strong>.</li>
  </ol>

  <div class="sub">4.4 Your Profile</div>
  <p>Click your <strong>avatar or name</strong> in the top-right corner → select <strong>Profile</strong>. Editable: Full Name, Phone, Gender, Title/Position, Avatar, Notification preferences (email, Telegram). Administrator-managed: email, college/department, employee ID, role assignments.</p>

  <div class="sub">4.5 Session Timeout</div>
  <p>Sessions expire after a period of inactivity (typically 30–60 minutes, configured by your admin). A <strong>warning dialog</strong> appears before expiry — click <strong>Stay Logged In</strong> to continue. Previously completed wizard steps are always preserved; only unsaved data within the current step may be lost.</p>

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">5. Dashboard</div>
  <p>Your home page after login. Widgets shown depend on your role:</p>
  <table class="dt">
    <tr><th>Widget</th><th width="38%">Visible To</th></tr>
    <tr><td>Active Proposal Calls</td><td>All users</td></tr>
    <tr><td>My Proposals (Draft)</td><td>Staff / Researchers</td></tr>
    <tr><td>Validation / Blind Review / Defence Queues</td><td>Officers (within scope)</td></tr>
    <tr><td>Central Evaluation Queue</td><td>Central Officer</td></tr>
    <tr><td>Assigned Reviews</td><td>Any assigned reviewer</td></tr>
    <tr><td>Budget &amp; Finance Queues</td><td>Finance Officer, College Officer</td></tr>
    <tr><td>Similarity Flags, Complaints</td><td>Officers</td></tr>
  </table>
  <div class="tip"><strong>Tip:</strong> Click any widget number to navigate directly to the relevant list. Dashboard charts (Proposal Pipeline, Budget Utilization, Reviewer Performance) update in real-time.</div>

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">6. My Research Hub</div>
  <div class="path">Main Menu → My Research Hub</div>
  <p>A personal overview of all your research activities: submitted proposals and their current status, assigned peer review tasks and deadlines, upcoming milestone dates, recent notifications, and quick-links to start new applications or track existing ones.</p>

</div>
<div class="cf" style="border-top-color:#2563eb;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#2563eb;">Sections 4–6 &nbsp;&#183;&nbsp; Page 3</td></tr></table></div>

<div class="pb"></div>

{{-- SECTION 7 --}}
<div class="ch">
  <div style="background:#0f766e;"><div class="ch-bar" style="background:#14b8a6;"></div>
  <div class="ch-head" style="background:#0f766e;"><div class="ch-head-inner" style="border-left-color:#14b8a6;"><div class="ch-label" style="color:#5eead4;">Section 7</div><div class="ch-title">Proposal Management</div></div></div></div>
</div>
<div class="cb">

  <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">7.1 Browsing Proposal Calls</div>
  <div class="path">Proposals → Proposal Calls</div>
  <p>Proposal calls are announcements inviting researchers to submit. Only <strong>active</strong> calls are open. Each call shows: title, category, deadline with countdown, status badge (Active/Expired/Closed), and a link to download the guidelines document. Filter by Category, Academic Year, or search by keyword.</p>

  <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">7.2 Creating a Proposal — The 7-Step Wizard</div>
  <div class="path">Proposals → New Application &nbsp;(or "Apply Now" from a proposal call)</div>
  <p>The wizard saves your progress at each step automatically. You can leave and return at any time. All 7 steps must be completed before submission.</p>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:10px;">
    <tr>
      <td class="col2-l">
        @foreach([
          ['01','Step 1 — Basic Information','Proposal Title (required) · Abstract (200–500 words, required) · Keywords (3–10) · Focus Area · Research Type · Duration in months'],
          ['02','Step 2 — PI Information','Full name, email, phone, college, department, employee ID, qualification, specialization. Pre-filled from your profile if you are the PI.'],
          ['03','Step 3 — Research Team','Add co-investigators by searching registered system users. Statuses: Pending (awaiting acceptance), Accepted, Refused. At least 1 co-investigator required.'],
          ['04','Step 4 — Budget Plan','Add line items by category (Personnel, Equipment, Materials, Travel, Training, Software, Publication, Overhead, Other). Each needs description, amount, and justification.'],
        ] as $s)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:7px;">
          <tr>
            <td width="34px" style="background:#0f766e; text-align:center; font-size:11pt; font-weight:bold; color:#fff; padding:10px 4px; vertical-align:top;">{{ $s[0] }}</td>
            <td style="border:1px solid #a7f3d0; border-left:3px solid #0f766e; padding:9px 11px; vertical-align:top; border-left-width:0;">
              <div style="font-size:9.5pt; font-weight:bold; color:#0f766e; margin-bottom:3px;">{{ $s[1] }}</div>
              <div style="font-size:8.5pt; color:#475569; line-height:1.55;">{{ $s[2] }}</div>
            </td>
          </tr>
        </table>
        @endforeach
      </td>
      <td class="col2-g"></td>
      <td class="col2-r">
        @foreach([
          ['05','Step 5 — Documents','Upload supporting files: Full Proposal PDF, Budget Justification, CVs, Ethical Clearance, Letters of Support. Formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG. At least 1 document required.'],
          ['06','Step 6 — Preview','Review all entered information across all steps. Click Edit next to any section to correct issues before submitting.'],
          ['07','Step 7 — Submit','Read the submission declaration, check the confirmation box, and click Submit Proposal. A Tracker Number (e.g., RTT-2026-00123) is generated instantly.'],
        ] as $s)
        <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:7px;">
          <tr>
            <td width="34px" style="background:#0f766e; text-align:center; font-size:11pt; font-weight:bold; color:#fff; padding:10px 4px; vertical-align:top;">{{ $s[0] }}</td>
            <td style="border:1px solid #a7f3d0; border-left:none; padding:9px 11px; vertical-align:top;">
              <div style="font-size:9.5pt; font-weight:bold; color:#0f766e; margin-bottom:3px;">{{ $s[1] }}</div>
              <div style="font-size:8.5pt; color:#475569; line-height:1.55;">{{ $s[2] }}</div>
            </td>
          </tr>
        </table>
        @endforeach
        <div class="warn">Co-investigators who have not accepted their invitation will block submission when the Workflow feature is enabled. Resolve all pending/declined co-PI statuses before submitting.</div>
      </td>
    </tr>
  </table>

  <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">7.3 – 7.7 Managing, Tracking &amp; Viewing</div>
  <table class="dt">
    <tr><th>Feature</th><th>Path</th><th>Notes</th></tr>
    <tr><td><strong>Draft Management</strong></td><td>My Proposals → filter Draft</td><td>Continue, delete, or preview any draft. Drafts only visible to you.</td></tr>
    <tr><td><strong>Track Proposal</strong></td><td>/tracker (public, no login)</td><td>Enter any Tracker Number to view current status and workflow history.</td></tr>
    <tr><td><strong>My Proposals</strong></td><td>Proposals → My Proposals</td><td>Filter by status/year/category. Actions: View, Edit (drafts only), Withdraw, Download documents.</td></tr>
    <tr><td><strong>All Proposals</strong></td><td>Proposals → All Proposals</td><td>Officers only. Full-text search, column sort, workflow actions per proposal.</td></tr>
  </table>
</div>
<div class="cf" style="border-top-color:#0f766e;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#0f766e;">Proposal Management &nbsp;&#183;&nbsp; Page 4</td></tr></table></div>

<div class="pb"></div>

{{-- SECTION 8 --}}
<div class="ch">
  <div style="background:#4c1d95;"><div class="ch-bar" style="background:#7c3aed;"></div>
  <div class="ch-head" style="background:#4c1d95;"><div class="ch-head-inner" style="border-left-color:#7c3aed;"><div class="ch-label" style="color:#c4b5fd;">Section 8</div><div class="ch-title">Review &amp; Evaluation</div></div></div></div>
</div>
<div class="cb">

  <div class="sec" style="color:#4c1d95; border-bottom-color:#4c1d95;">8.1 Validation Queue</div>
  <div class="path">Review &amp; Evaluation → Validation Queue &nbsp;|&nbsp; Access: Category Officers, Central Officer</div>
  <p>Shows all Submitted proposals awaiting initial screening before peer review.</p>
  <ol class="steps">
    <li><div class="sn" style="background:#4c1d95;">1</div>Click <strong>Review</strong> on a proposal in the queue.</li>
    <li><div class="sn" style="background:#4c1d95;">2</div>Read the proposal summary, PI information, and uploaded documents.</li>
    <li><div class="sn" style="background:#4c1d95;">3</div>Choose an action: <strong>Approve for Review</strong> (enters Blind Review queue) · <strong>Return for Revision</strong> (returned to PI with comments) · <strong>Reject</strong> (must provide documented reason).</li>
    <li><div class="sn" style="background:#4c1d95;">4</div>Enter your comments (required for Return and Reject) and click <strong>Confirm</strong>.</li>
  </ol>

  <div class="sec" style="color:#4c1d95; border-bottom-color:#4c1d95;">8.2 Blind Review</div>
  <div class="path">Review &amp; Evaluation → Blind Review &nbsp;|&nbsp; Access: Category Officers</div>
  <div class="danger"><strong>Blind Review Integrity:</strong> The PI's name, photo, college, and all identifying information are stripped at the API level during blind review — not just hidden in the UI.</div>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:8px;">
    <tr>
      <td class="col2-l">
        <div class="sub2">Assigning Reviewers</div>
        <ol class="steps">
          <li><div class="sn" style="background:#4c1d95;">1</div>Click <strong>Manage Reviews</strong> on a proposal.</li>
          <li><div class="sn" style="background:#4c1d95;">2</div>Search reviewers by name, expertise, department, college, or current workload.</li>
          <li><div class="sn" style="background:#4c1d95;">3</div>The system automatically flags co-authorship conflicts.</li>
          <li><div class="sn" style="background:#4c1d95;">4</div>Select reviewers, set a <strong>Review Due Date</strong>, click <strong>Assign Reviewers</strong>.</li>
        </ol>
        <p style="font-size:9pt;">Officers can extend due dates, reassign, or view progress per assignment. Once reviews are complete: <em>Pass to Open Defence</em> or <em>Reject</em>.</p>
      </td>
      <td class="col2-g"></td>
      <td class="col2-r">
        <div class="sub2">Submitting a Review (Reviewer)</div>
        <div class="path">Review &amp; Evaluation → Assigned Reviews</div>
        <ol class="steps">
          <li><div class="sn" style="background:#4c1d95;">1</div>Click <strong>Review</strong> on an assignment (PI name is hidden).</li>
          <li><div class="sn" style="background:#4c1d95;">2</div>Answer each evaluation question across all categories.</li>
          <li><div class="sn" style="background:#4c1d95;">3</div>Add general comments.</li>
          <li><div class="sn" style="background:#4c1d95;">4</div>Click <strong>Submit Review</strong>.</li>
        </ol>
        <div class="warn">Once submitted, reviews cannot be edited. Overdue assignments are highlighted in red.</div>
      </td>
    </tr>
  </table>

  <div class="sec" style="color:#4c1d95; border-bottom-color:#4c1d95;">8.3 Open Defence</div>
  <div class="path">Review &amp; Evaluation → Open Defence &nbsp;|&nbsp; Access: Category Officers</div>
  <p><strong>Scheduling:</strong> Click <strong>Schedule Defence</strong> → enter Date &amp; Time, Venue, Online Meeting Link, Panel Members → click <strong>Schedule</strong>. PI and all panel members receive an email invitation automatically.</p>
  <p><strong>Recording the result:</strong> After the session, click <strong>Process Result</strong> → select <strong>Accepted</strong> or <strong>Rejected</strong> (must provide reason for rejection) → add session notes → click <strong>Submit Result</strong>.</p>

  <div class="sec" style="color:#4c1d95; border-bottom-color:#4c1d95;">8.4 – 8.7 Central Evaluation, Criteria &amp; Workload</div>
  <table class="dt">
    <tr><th>Feature</th><th>Who</th><th>Description</th></tr>
    <tr><td><strong>Central Evaluation</strong></td><td>Central Officer</td><td>Final approval step after Open Defence. Review all scores and defence notes, then Approve or Reject. Approved proposals move to Proposal Funding.</td></tr>
    <tr><td><strong>Evaluation Criteria</strong></td><td>Officers, Super Admin</td><td>Configure evaluation types, categories, and questions with custom scoring rubrics (numeric scale or descriptive levels).</td></tr>
    <tr><td><strong>Reviewer Workload</strong></td><td>Officers</td><td>Dashboard: active assignments per reviewer, completed vs. pending, average completion time, overdue highlights.</td></tr>
  </table>

</div>
<div class="cf" style="border-top-color:#4c1d95;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#7c3aed;">Review &amp; Evaluation &nbsp;&#183;&nbsp; Page 5</td></tr></table></div>

<div class="pb"></div>

{{-- SECTION 9 --}}
<div class="ch">
  <div style="background:#065f46;"><div class="ch-bar" style="background:#10b981;"></div>
  <div class="ch-head" style="background:#065f46;"><div class="ch-head-inner" style="border-left-color:#10b981;"><div class="ch-label" style="color:#6ee7b7;">Section 9</div><div class="ch-title">Finance Module</div></div></div></div>
</div>
<div class="cb">

  <div class="note"><strong>Feature-gated:</strong> The Finance module may be disabled by your administrator. Contact your Super Admin if Finance menus are not visible.</div>

  <div class="flow">Draft → Pending Signatures → Submitted → Under College Review → Approved → Disbursed → Settled</div>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:8px;">
    <tr>
      <td class="col2-l">

        <div class="sec" style="color:#065f46; border-bottom-color:#065f46;">9.1 Budget Allocations</div>
        <div class="path">Budget → Budget Allocations &nbsp;|&nbsp; Finance Officer, Super Admin</div>
        <p>Define total funding available per college per fiscal year. Statuses: <em>Pending</em> (not yet approved) / <em>Approved</em> (active, available for requests). Bulk approval supported.</p>
        <p><strong>Create:</strong> New Allocation → select College &amp; Fiscal Year → enter amount → Save.</p>

        <div class="sec" style="color:#065f46; border-bottom-color:#065f46;">9.2 Budget Requests</div>
        <div class="path">Budget → Budget Requests</div>
        <ol class="steps">
          <li><div class="sn" style="background:#065f46;">1</div>Click <strong>New Budget Request</strong>.</li>
          <li><div class="sn" style="background:#065f46;">2</div>Select the funded Proposal and a Form Template.</li>
          <li><div class="sn" style="background:#065f46;">3</div>Add budget line items: Category, Description, Amount, Justification.</li>
          <li><div class="sn" style="background:#065f46;">4</div>Click <strong>Submit for Signatures</strong>.</li>
          <li><div class="sn" style="background:#065f46;">5</div>Each signatory receives a notification and signs in sequence.</li>
          <li><div class="sn" style="background:#065f46;">6</div>Once all signatures are collected, the request auto-submits for College Review.</li>
        </ol>
        <div class="tip"><strong>College Review:</strong> College Officer approves (proceeds to Finance) or rejects (returned with comments for revision).</div>

      </td>
      <td class="col2-g"></td>
      <td class="col2-r">

        <div class="sec" style="color:#065f46; border-bottom-color:#065f46;">9.3 Proposal Funding</div>
        <div class="path">Budget → Proposal Funding &nbsp;|&nbsp; Finance Officer</div>
        <p>Shows Accepted proposals awaiting a funding decision. Click <strong>Fund</strong> → review details → confirm amount → click <strong>Confirm Funding</strong>.</p>
        <p><strong>Result:</strong> Proposal status → Funded. Award Letter generated (downloadable PDF). PI notified immediately.</p>

        <div class="sec" style="color:#065f46; border-bottom-color:#065f46;">9.4 Disbursements</div>
        <div class="path">Budget → Disbursements &nbsp;|&nbsp; Finance Officer</div>
        <p>Record the actual fund transfer after a budget request is approved. Click <strong>New Disbursement</strong> → enter Date, Amount, Payment Reference → upload Proof of Payment → click <strong>Record Disbursement</strong>. Status → Disbursed, PI notified.</p>

        <div class="sec" style="color:#065f46; border-bottom-color:#065f46;">9.5 Settlements</div>
        <div class="path">Budget → Settlements</div>
        <div class="sub2">Submitting (PI)</div>
        <p>New Settlement → attach Expense Report → enter Total Amount Spent → add notes → Submit Settlement.</p>
        <div class="sub2">Verifying (Finance Officer)</div>
        <p><strong>Verify</strong> → confirm expenses are valid → <strong>Finalize</strong> to complete the budget lifecycle. <strong>Reject</strong> returns with comments for revision.</p>

      </td>
    </tr>
  </table>

</div>
<div class="cf" style="border-top-color:#065f46;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#10b981;">Finance Module &nbsp;&#183;&nbsp; Page 6</td></tr></table></div>

<div class="pb"></div>

{{-- SECTIONS 10–11 --}}
<div class="ch">
  <div style="background:#0f766e;"><div class="ch-bar" style="background:#14b8a6;"></div>
  <div class="ch-head" style="background:#0f766e;"><div class="ch-head-inner" style="border-left-color:#14b8a6;"><div class="ch-label" style="color:#5eead4;">Sections 10 – 11</div><div class="ch-title">Monitoring Module &amp; Awarded Proposals</div></div></div></div>
</div>
<div class="cb">

  <div class="note"><strong>Feature-gated:</strong> The Monitoring module may be disabled. Contact your administrator if Monitoring menus are not visible.</div>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:8px;">
    <tr>
      <td class="col2-l">
        <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">10.1 Midterm Evaluations</div>
        <div class="path">Monitoring → Midterm Evaluations &nbsp;|&nbsp; Officers, Finance Officer</div>

        <div class="sub2">Scheduling (Officer)</div>
        <ol class="steps">
          <li><div class="sn" style="background:#0f766e;">1</div>Click <strong>Schedule Evaluation</strong> on a funded proposal (bulk scheduling supported).</li>
          <li><div class="sn" style="background:#0f766e;">2</div>Enter Date, Time, Venue, Evaluators → click <strong>Schedule</strong>.</li>
        </ol>

        <div class="sub2">Submitting a Progress Report (PI)</div>
        <ol class="steps">
          <li><div class="sn" style="background:#0f766e;">1</div>Go to My Proposals → select funded proposal → click <strong>Submit Progress Report</strong>.</li>
          <li><div class="sn" style="background:#0f766e;">2</div>Fill in: Progress Summary, Financial Utilization %, Publications count, Challenges, Milestones Achieved.</li>
          <li><div class="sn" style="background:#0f766e;">3</div>Upload Progress Report file and Financial Report file.</li>
          <li><div class="sn" style="background:#0f766e;">4</div>Click <strong>Submit</strong>.</li>
        </ol>
        <div class="tip">PIs can edit and resubmit their report until an officer scores the evaluation. Once scored, the report is locked.</div>

        <div class="sub2">Recording Results (Officer)</div>
        <p>Click <strong>Record Result</strong> → enter Score, Recommendation (Continue / Hold), Notes → click <strong>Save Result</strong>. If <em>Hold</em>, the PI and Central Officer are notified automatically.</p>

        <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">10.3 Research Outputs</div>
        <div class="path">Monitoring → Research Outputs</div>
        <p>Track intellectual products: Publication · Patent · Presentation · Technology prototype · Community impact report.</p>
        <p><strong>To add:</strong> Add Output → select Output Type → enter Title and Description → toggle <em>Ready for Repository</em> to publish publicly → Save.</p>
      </td>
      <td class="col2-g"></td>
      <td class="col2-r">
        <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">10.2 Completion Workshops</div>
        <div class="path">Monitoring → Completion Workshops &nbsp;|&nbsp; Officers</div>

        <div class="sub2">Scheduling (Officer)</div>
        <p>Schedule Workshop → enter Date, Time, Venue, Online Link, Evaluators → click <strong>Schedule</strong>. All participants notified.</p>

        <div class="sub2">Submitting Final Evidence (PI)</div>
        <p>Upload: Final Report, Presentation Slides, Project Photos, Video links, Research Outputs summary.</p>

        <div class="sub2">Recording Results (Officer)</div>
        <p>Record outcome: <strong>Completed</strong> or <strong>Needs Revision</strong> → add evaluation notes → click <strong>Finalize Workshop</strong>. When finalized as Completed, proposal status transitions to <strong>Completed</strong>.</p>

        <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">10.4 Research Repository</div>
        <div class="path">Public: /repository &nbsp;|&nbsp; Admin: Monitoring → Manage Repository</div>
        <p>A public-facing, searchable repository of completed research outputs. Searchable by keyword, category, and year. Officers control what is published.</p>
        <p><strong>To publish:</strong> Go to Manage Repository → find the completed proposal → click <strong>Publish to Repository</strong>.</p>

        <div class="sec" style="color:#0f766e; border-bottom-color:#0f766e;">11. Awarded Proposals</div>
        <div class="path">Proposals → Awarded Proposals</div>
        <p>Lists all funded proposals with: Tracker Number, Title, PI, College, Award Date, Funded Amount, Status.</p>
        <p><strong>Actions:</strong> View details · Download Award Letter (PDF) · Track Budget · Export list as CSV/Excel.</p>
      </td>
    </tr>
  </table>

</div>
<div class="cf" style="border-top-color:#0f766e;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#14b8a6;">Monitoring &amp; Awarded Proposals &nbsp;&#183;&nbsp; Page 7</td></tr></table></div>

<div class="pb"></div>

{{-- SECTIONS 12–15 --}}
<div class="ch">
  <div style="background:#1e3a5f;"><div class="ch-bar" style="background:#3b82f6;"></div>
  <div class="ch-head" style="background:#1e3a5f;"><div class="ch-head-inner" style="border-left-color:#3b82f6;"><div class="ch-label" style="color:#93c5fd;">Sections 12 – 15</div><div class="ch-title">Complaints, Similarity, External Funds &amp; Conferences</div></div></div></div>
</div>
<div class="cb">

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
    <tr>
      <td class="col2-l">

        <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">12. Complaints</div>
        <div class="path">Review &amp; Evaluation → Complaints &nbsp;|&nbsp; Feature-gated</div>
        <div class="sub2">Filing (Staff / Researcher)</div>
        <ol class="steps">
          <li><div class="sn" style="background:#9f1239;">1</div>Click <strong>New Complaint</strong>.</li>
          <li><div class="sn" style="background:#9f1239;">2</div>Select Proposal, Category (Fairness/Bias/Process/Technical/Other), Stage, Level, and Description.</li>
          <li><div class="sn" style="background:#9f1239;">3</div>Click <strong>Submit Complaint</strong>.</li>
        </ol>
        <div class="note">One complaint per proposal per stage. Duplicate complaints are rejected.</div>
        <table class="dt" style="margin-top:6px;">
          <tr><th>Status</th><th>Meaning</th></tr>
          <tr><td>Open</td><td>Submitted, not yet assigned</td></tr>
          <tr><td>Assigned</td><td>Under investigation</td></tr>
          <tr><td>Resolved</td><td>Addressed and closed</td></tr>
          <tr><td>Escalated</td><td>Referred to higher authority</td></tr>
        </table>
        <div class="sub2">Responding (Officer)</div>
        <p>Assign to yourself → investigate → click <strong>Respond</strong> → enter response and outcome → Mark as Resolved or Escalate.</p>

        <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">13. Similarity Flags</div>
        <div class="path">Review &amp; Evaluation → Similarity Flags &nbsp;|&nbsp; Officers &nbsp;|&nbsp; Feature-gated</div>
        <p>Automated TF-IDF cosine similarity analysis flags proposals that may share significant content with existing submissions. Every submission is analyzed automatically.</p>
        <ol class="steps">
          <li><div class="sn" style="background:#3b1f1f;">1</div>Click <strong>Review</strong> on a flagged proposal.</li>
          <li><div class="sn" style="background:#3b1f1f;">2</div>View the similarity report showing matched sections and percentage.</li>
          <li><div class="sn" style="background:#3b1f1f;">3</div>Choose: <strong>Clear Flag</strong> (coincidental) or <strong>Take Action</strong> (return/reject).</li>
          <li><div class="sn" style="background:#3b1f1f;">4</div>Add notes explaining your decision → click <strong>Save Decision</strong>.</li>
        </ol>

      </td>
      <td class="col2-g"></td>
      <td class="col2-r">

        <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">14. External Funds</div>
        <div class="note"><strong>Feature-gated:</strong> May be disabled by your administrator.</div>

        <div class="sub2">14.1 Funding Opportunities</div>
        <div class="path">/funding-opportunities (public)</div>
        <p>Browse external funding from donors and agencies. Each listing shows: donor name, title, description, eligible categories, deadline, and funding amount range.</p>

        <div class="sub2">14.2 Applications</div>
        <div class="flow" style="font-size:7.5pt;">Draft → Internal Review → Approved → Submitted → Under Review → Awarded/Rejected</div>
        <p><strong>Create:</strong> New Application → fill in Title, Opportunity, Category, Abstract, PI, College, Budget, Dates → upload documents → Submit for Internal Review.</p>
        <p><strong>Internal Review:</strong> Officer approves (cleared for external submission) or rejects with comments.</p>

        <div class="sub2">14.3 External Fund Awards</div>
        <p>Track awarded funding: award amount, currency, milestones (key deliverables with dates), expenditures, and document uploads (award agreement, progress reports).</p>

        <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">15. Conferences &amp; Abstracts</div>
        <div class="sub2">15.1 Browsing (Public)</div>
        <div class="path">/conferences (no login required)</div>
        <p>Browse upcoming and past conferences: name, banner, dates, location, registration link, and featured speakers.</p>

        <div class="sub2">15.2 Submitting an Abstract</div>
        <ol class="steps">
          <li><div class="sn" style="background:#1e1b4b;">1</div>Go to a conference detail page → click <strong>Submit Abstract</strong>.</li>
          <li><div class="sn" style="background:#1e1b4b;">2</div>Fill in Title, Authors &amp; affiliations, Abstract text (250–500 words), Keywords, Presentation preference.</li>
          <li><div class="sn" style="background:#1e1b4b;">3</div>Click <strong>Submit</strong>. Save the <strong>Tracking Token</strong> you receive — use it at /my-abstracts to check your status.</li>
        </ol>

        <div class="sub2">15.3 – 15.4 Admin Conference &amp; Abstract Management</div>
        <p>Events → Conferences: create conferences (title, slug, dates, location, speakers, sessions, status). Events → Abstracts: assign reviewer, score, set Accepted/Rejected status. Submitter is notified by email.</p>

      </td>
    </tr>
  </table>
</div>
<div class="cf" style="border-top-color:#1e40af;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#3b82f6;">Sections 12–15 &nbsp;&#183;&nbsp; Page 8</td></tr></table></div>

<div class="pb"></div>

{{-- SECTIONS 16–18 --}}
<div class="ch">
  <div style="background:#78350f;"><div class="ch-bar" style="background:#f59e0b;"></div>
  <div class="ch-head" style="background:#78350f;"><div class="ch-head-inner" style="border-left-color:#f59e0b;"><div class="ch-label" style="color:#fcd34d;">Sections 16 – 18</div><div class="ch-title">Reports, Notifications &amp; Public Pages</div></div></div></div>
</div>
<div class="cb">

  <div class="sec" style="color:#78350f; border-bottom-color:#f59e0b;">16. Reports &amp; Analytics</div>
  <div class="note"><strong>Feature-gated:</strong> The Reports module may be disabled. Contact your administrator if Report menus are not visible.</div>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-top:6px;">
    <tr>
      <td class="col2-l">
        <div class="sub">16.1 Generate Report</div>
        <div class="path">Reports → Generate Report &nbsp;|&nbsp; Officers, Admin, Super Admin</div>
        <p>Available report types: Proposal Count by Category/College · Proposals by Status · College Performance · Budget Utilization · Custom Filtered Report.</p>
        <ol class="steps">
          <li><div class="sn" style="background:#78350f;">1</div>Select Report Type.</li>
          <li><div class="sn" style="background:#78350f;">2</div>Set filters: Date Range, Category, College, Status, Academic Year.</li>
          <li><div class="sn" style="background:#78350f;">3</div>Click <strong>Generate</strong>.</li>
          <li><div class="sn" style="background:#78350f;">4</div>Click <strong>Export</strong> → download as CSV, Excel, or PDF.</li>
        </ol>

        <div class="sub">16.2 Proposal Statistics</div>
        <p>Visual summary: total by status (bar chart), by category (pie), by college (table), submission trend over time (line).</p>

        <div class="sub">16.3 College Performance</div>
        <div class="path">Admin, Central Officer, Super Admin</div>
        <p>Per-college metrics: proposals submitted, acceptance rate, funded count, average review score, budget utilization rate. Export as CSV or PDF.</p>
      </td>
      <td class="col2-g"></td>
      <td class="col2-r">
        <div class="sub">16.4 Budget Utilization</div>
        <div class="path">Finance Officer, Admin, Super Admin</div>
        <p>Allocated vs. disbursed per college · Settlement completion rate · Budget requests by status · Overspend/underspend alerts.</p>

        <div class="sub">16.5 Analytics Dashboard</div>
        <div class="path">Admin, Super Admin</div>
        <p>Comprehensive live dashboard: proposal pipeline, review completion rates, reviewer performance, year-over-year comparisons, and KPI summary cards.</p>

        <div class="sec" style="color:#78350f; border-bottom-color:#f59e0b; margin-top:8px;">17. Notifications</div>
        <div class="path">User Menu → Bell icon (top navigation bar)</div>
        <p>Click the bell to open the notification panel. Click any notification to navigate to the related page. Click <strong>Mark All Read</strong> to clear the count.</p>
        <p><strong>Channels:</strong> In-app (always active) · Email (toggle in Profile) · Telegram (link in Profile).</p>
        <p>Key triggers: proposal submission, validation, review assignment, defence, funding, budget signatures, disbursement, complaint, deadline reminders (7/3/1 day).</p>

        <div class="sec" style="color:#78350f; border-bottom-color:#f59e0b;">18. Public Pages</div>
        <table class="dt" style="font-size:8.5pt;">
          <tr><th>Page</th><th>URL</th></tr>
          <tr><td>Home</td><td>/</td></tr>
          <tr><td>Proposal Calls</td><td>/proposal-calls/public</td></tr>
          <tr><td>Repository</td><td>/repository</td></tr>
          <tr><td>Track Proposal</td><td>/tracker</td></tr>
          <tr><td>Conferences</td><td>/conferences</td></tr>
          <tr><td>Submit Abstract</td><td>/conferences/{slug}/submit-abstract</td></tr>
          <tr><td>My Abstracts</td><td>/my-abstracts</td></tr>
          <tr><td>Downloads</td><td>/download</td></tr>
        </table>
      </td>
    </tr>
  </table>
</div>
<div class="cf" style="border-top-color:#f59e0b;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#f59e0b;">Reports, Notifications &amp; Public Pages &nbsp;&#183;&nbsp; Page 9</td></tr></table></div>

<div class="pb"></div>

{{-- SECTIONS 19–21 --}}
<div class="ch">
  <div style="background:#1e3a5f;"><div class="ch-bar" style="background:#2563eb;"></div>
  <div class="ch-head" style="background:#1e3a5f;"><div class="ch-head-inner" style="border-left-color:#2563eb;"><div class="ch-label" style="color:#93c5fd;">Sections 19 – 21</div><div class="ch-title">User Management, Administration &amp; Settings</div></div></div></div>
</div>
<div class="cb">

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">19. User Management</div>
  <div class="path">Administration → Users &nbsp;|&nbsp; Admin, Super Admin, College Officer (own college)</div>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:8px;">
    <tr>
      <td class="col2-l">
        <div class="sub2">Creating a New User</div>
        <ol class="steps">
          <li><div class="sn" style="background:#1e40af;">1</div>Click <strong>New User</strong>.</li>
          <li><div class="sn" style="background:#1e40af;">2</div>Fill in: Full Name, Email (unique), Employee ID, College &amp; Department, Title/Position, Phone, Gender, Expertise, Role(s), Status.</li>
          <li><div class="sn" style="background:#1e40af;">3</div>System sends a <strong>welcome email</strong> with login instructions.</li>
          <li><div class="sn" style="background:#1e40af;">4</div>Click <strong>Save</strong>.</li>
        </ol>
        <div class="sub2">Other Actions</div>
        <table class="dt">
          <tr><th>Action</th><th>How</th></tr>
          <tr><td>Edit user</td><td>Click name → update → Save</td></tr>
          <tr><td>Change role</td><td>Profile → Roles section → add/remove → Save</td></tr>
          <tr><td>Deactivate</td><td>Profile → Status = Inactive → Save</td></tr>
          <tr><td>Bulk actions</td><td>Select users → Assign Role / Change Status / Export CSV</td></tr>
          <tr><td>Import CSV</td><td>Import Users → download template → fill → upload → Confirm Import</td></tr>
        </table>
      </td>
      <td class="col2-g"></td>
      <td class="col2-r">
        <div class="sub2">Impersonating a User (Super Admin Only)</div>
        <p>Find user in list → click <strong>Impersonate</strong> icon → you are now logged in as that user. Click <strong>Stop Impersonating</strong> in the top bar to return to your admin account.</p>
        <div class="danger"><strong>Warning:</strong> All actions taken while impersonating are performed as the impersonated user and are permanently logged in the audit trail.</div>

        <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af; margin-top:10px;">20. Administration</div>
        <table class="dt">
          <tr><th>Feature</th><th>Path</th></tr>
          <tr><td><strong>Colleges &amp; Departments</strong></td><td>Administration → Colleges / Departments. Create college (name + code), add departments under each college.</td></tr>
          <tr><td><strong>Thematic Areas</strong></td><td>Administration → Thematic Areas (Super Admin). Create, edit, or deactivate research priority areas.</td></tr>
          <tr><td><strong>Resources</strong></td><td>Administration → Resources. Manage downloadable files on the public Downloads page.</td></tr>
          <tr><td><strong>Audit Logs</strong></td><td>Administration → Audit Logs (Super Admin). Read-only, immutable. Filter by date, actor, action, record type.</td></tr>
          <tr><td><strong>System Monitor</strong></td><td>Administration → System Monitor. CPU, memory, disk, request stats, failed jobs. Acknowledge alerts.</td></tr>
        </table>

        <div class="sub">20.6 Feature Management</div>
        <div class="path">Administration → Feature Management &nbsp;|&nbsp; Super Admin only</div>
        <p>Enable or disable major modules with a single toggle. Takes effect immediately — no code changes or restarts required. Modules: Finance · Monitoring · Reports · Complaints · Similarity · External Funds · Conferences · Repository · Self-Registration.</p>
      </td>
    </tr>
  </table>

  <div class="sec" style="color:#1e40af; border-bottom-color:#1e40af;">21. Settings</div>
  <table class="dt">
    <tr><th width="30%">Setting</th><th>Description</th></tr>
    <tr><td><strong>System Name / Tagline</strong></td><td>Displayed in the header, emails, and login page</td></tr>
    <tr><td><strong>Logo</strong></td><td>Upload institution logo (PNG/SVG recommended)</td></tr>
    <tr><td><strong>Sidebar Color</strong></td><td>Customize the navigation sidebar background color</td></tr>
    <tr><td><strong>Announcement Banner</strong></td><td>Toggle on/off with custom message text</td></tr>
    <tr><td><strong>Session Timeout</strong></td><td>Inactivity timeout in minutes before auto-logout</td></tr>
    <tr><td><strong>Allow Self-Registration</strong></td><td>Whether new users can register themselves</td></tr>
    <tr><td><strong>Max Concurrent Sessions</strong></td><td>Maximum active sessions per user account</td></tr>
    <tr><td><strong>Maintenance Mode</strong></td><td>Take the system offline for maintenance</td></tr>
    <tr><td><strong>Public Site / Login Notices</strong></td><td>Configure public page content and login announcements</td></tr>
  </table>
</div>
<div class="cf" style="border-top-color:#2563eb;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#2563eb;">User Management, Administration &amp; Settings &nbsp;&#183;&nbsp; Page 10</td></tr></table></div>

<div class="pb"></div>

{{-- SECTIONS 22–23 --}}
<div class="ch">
  <div style="background:#334155;"><div class="ch-bar" style="background:#64748b;"></div>
  <div class="ch-head" style="background:#334155;"><div class="ch-head-inner" style="border-left-color:#64748b;"><div class="ch-label" style="color:#94a3b8;">Sections 22 – 23</div><div class="ch-title">Troubleshooting &amp; Frequently Asked Questions</div></div></div></div>
</div>
<div class="cb">

  <div class="sec" style="color:#334155; border-bottom-color:#64748b;">22. Troubleshooting</div>

  <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; margin-bottom:10px;">
    <tr>
      <td class="col2-l">
        <div class="sub">Cannot Log In</div>
        <table class="dt">
          <tr><th>Symptom</th><th>Solution</th></tr>
          <tr><td>"Invalid credentials"</td><td>Check email/password. Use Forgot Password.</td></tr>
          <tr><td>"Account is inactive"</td><td>Contact your administrator.</td></tr>
          <tr><td>"Email not verified"</td><td>Click the verification link in your inbox.</td></tr>
          <tr><td>SSO / Microsoft login fails</td><td>Contact IT support — Azure AD configuration issue.</td></tr>
          <tr><td>2FA code not received</td><td>Check spam folder. Click Resend Code after 2 minutes.</td></tr>
        </table>

        <div class="sub">Cannot Submit a Proposal</div>
        <table class="dt">
          <tr><th>Symptom</th><th>Solution</th></tr>
          <tr><td>"No active calls"</td><td>Check the deadline hasn't passed. Contact an officer.</td></tr>
          <tr><td>Wizard validation errors</td><td>Read each error and fill in the missing fields.</td></tr>
          <tr><td>File upload fails</td><td>Check file size and type (PDF, DOC, DOCX, etc.).</td></tr>
          <tr><td>Cannot find co-investigator</td><td>They must be a registered user. Ask them to register first.</td></tr>
          <tr><td>Maximum proposals reached</td><td>You've hit the per-PI limit for this call. Contact the officer.</td></tr>
        </table>
      </td>
      <td class="col2-g"></td>
      <td class="col2-r">
        <div class="sub">Other Common Issues</div>
        <table class="dt">
          <tr><th>Symptom</th><th>Solution</th></tr>
          <tr><td>Proposal not in queue (officer)</td><td>Check category/college scope filters.</td></tr>
          <tr><td>No email notification</td><td>Check spam folder. Verify email preferences in Profile.</td></tr>
          <tr><td>Telegram not working</td><td>Ensure Telegram account is linked in Profile.</td></tr>
          <tr><td>Download link fails</td><td>Link may have expired. Refresh and try again.</td></tr>
          <tr><td>Report shows no data</td><td>Adjust date range and filters.</td></tr>
          <tr><td>"Feature is disabled"</td><td>Ask your Super Admin to enable the module.</td></tr>
        </table>

        <div class="sub">22. Frequently Asked Questions</div>
        <div class="fh"><strong>Q: How do I know which call to apply to?</strong><br/>Go to Proposals → Proposal Calls. Read the guidelines document for each active call before applying.</div>
        <div class="fh"><strong>Q: Can I edit a submitted proposal?</strong><br/>No — not unless an officer returns it for revision. Check your notifications for revision requests.</div>
        <div class="fh"><strong>Q: What is a Tracker Number?</strong><br/>A unique ID (e.g., RTT-2026-00123) assigned on submission. Use it at /tracker to check status without logging in.</div>
        <div class="fh"><strong>Q: Is my draft saved after session timeout?</strong><br/>Yes — the wizard saves after each "Save &amp; Next". Only unsaved changes within the current step may be lost.</div>
        <div class="fh"><strong>Q: How do I link Telegram for notifications?</strong><br/>Profile → Notification Settings → Link Telegram Account → follow the bot instructions.</div>
        <div class="fh"><strong>Q: Why can't I see Finance/Monitoring/Reports?</strong><br/>The module may be disabled by your administrator or your role may lack permission. Contact your Super Admin.</div>
        <div class="fh"><strong>Q: I have a conflict of interest as a reviewer. What do I do?</strong><br/>Do NOT review the proposal. Contact the assigning officer immediately to be reassigned.</div>
        <div class="fh"><strong>Q: Who do I contact for technical support?</strong><br/>Your institution's RTT Platform administrator or IT support team. Use the Feedback link at the bottom of any page if enabled.</div>
      </td>
    </tr>
  </table>

</div>
<div class="cf" style="border-top-color:#64748b;"><table><tr><td>RTT Platform User Manual &nbsp;|&nbsp; {{ $orgName }}</td><td class="cfr" style="color:#64748b;">Troubleshooting &amp; FAQ &nbsp;&#183;&nbsp; Page 11</td></tr></table></div>

<div class="pb"></div>

{{-- BACK COVER --}}
<table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse; height:842px;">
  <tr>
    <td style="background:#0f172a; vertical-align:middle; height:842px; text-align:center; padding:50px 60px;">
      <table cellpadding="0" cellspacing="0" style="width:100%; border-collapse:collapse;">
        <tr>
          <td style="background:#2563eb; height:5px;"></td>
          <td style="background:#10b981; height:5px; width:25%;"></td>
          <td style="background:#7c3aed; height:5px; width:12%;"></td>
          <td style="background:#f59e0b; height:5px; width:8%;"></td>
        </tr>
      </table>
      <div style="height:55px;"></div>
      <div style="font-size:9pt; color:#64748b; text-transform:uppercase; letter-spacing:3px; margin-bottom:10px;">End of Manual</div>
      <div style="font-size:24pt; font-weight:bold; color:#fff; margin-bottom:6px;">RTT PLATFORM</div>
      <div style="font-size:10pt; color:#60a5fa; margin-bottom:24px;">User Manual &nbsp;&#183;&nbsp; Version 1.0 &nbsp;&#183;&nbsp; {{ $year }}</div>
      <div style="width:50px; height:3px; background:#2563eb; margin:0 auto 24px;"></div>
      <div style="font-size:9.5pt; color:#94a3b8; margin-bottom:36px; line-height:1.8;">For technical support, contact your institution's<br/>RTT Platform administrator or IT support team.<br/>Use the Feedback link within the system to submit requests.</div>
      @if($address || $phone || $email)
      <table cellpadding="0" cellspacing="0" style="width:45%; margin:0 auto; border-collapse:collapse; margin-bottom:30px;">
        <tr><td style="background:#1e3a5f; border:1px solid #334155; padding:16px 20px; text-align:left;">
          <div style="font-size:8.5pt; color:#60a5fa; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin-bottom:9px;">Contact</div>
          <div style="font-size:9pt; color:#cbd5e1; line-height:2;">
            <strong style="color:#fff;">{{ $orgName }}</strong><br/>
            @if($address)<span style="color:#94a3b8;">{{ $address }}</span><br/>@endif
            @if($phone)<span style="color:#94a3b8;">{{ $phone }}</span><br/>@endif
            @if($email)<span style="color:#94a3b8;">{{ $email }}</span><br/>@endif
          </div>
        </td></tr>
      </table>
      @endif
      <div style="font-size:8pt; color:#475569;">This document is for internal use only. Do not distribute outside {{ $orgName }}.</div>
    </td>
  </tr>
</table>

</body>
</html>
