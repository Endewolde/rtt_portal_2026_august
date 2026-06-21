# RTT Platform — User Manual

**Research & Technology Transfer Management System**
Version 1.0 | June 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [System Overview](#2-system-overview)
3. [User Roles and Permissions](#3-user-roles-and-permissions)
4. [Getting Started](#4-getting-started)
   - 4.1 [Accessing the System](#41-accessing-the-system)
   - 4.2 [Logging In](#42-logging-in)
   - 4.3 [Two-Factor Authentication](#43-two-factor-authentication)
   - 4.4 [Resetting Your Password](#44-resetting-your-password)
   - 4.5 [Your Profile](#45-your-profile)
   - 4.6 [Session Timeout](#46-session-timeout)
5. [Dashboard](#5-dashboard)
6. [My Research Hub](#6-my-research-hub)
7. [Proposal Management](#7-proposal-management)
   - 7.1 [Browsing Proposal Calls](#71-browsing-proposal-calls)
   - 7.2 [Creating a New Proposal (Wizard)](#72-creating-a-new-proposal-wizard)
   - 7.3 [Managing Draft Proposals](#73-managing-draft-proposals)
   - 7.4 [Submitting a Proposal](#74-submitting-a-proposal)
   - 7.5 [Tracking Your Proposal](#75-tracking-your-proposal)
   - 7.6 [My Proposals](#76-my-proposals)
   - 7.7 [All Proposals (Officers)](#77-all-proposals-officers)
8. [Review and Evaluation](#8-review-and-evaluation)
   - 8.1 [Validation Queue](#81-validation-queue)
   - 8.2 [Blind Review](#82-blind-review)
   - 8.3 [Open Defence](#83-open-defence)
   - 8.4 [Central Evaluation](#84-central-evaluation)
   - 8.5 [Assigned Reviews (Reviewer View)](#85-assigned-reviews-reviewer-view)
   - 8.6 [Evaluation Criteria Management](#86-evaluation-criteria-management)
   - 8.7 [Reviewer Workload](#87-reviewer-workload)
9. [Finance Module](#9-finance-module)
   - 9.1 [Budget Allocations](#91-budget-allocations)
   - 9.2 [Budget Requests](#92-budget-requests)
   - 9.3 [Proposal Funding](#93-proposal-funding)
   - 9.4 [Disbursements](#94-disbursements)
   - 9.5 [Settlements](#95-settlements)
10. [Monitoring Module](#10-monitoring-module)
    - 10.1 [Midterm Evaluations](#101-midterm-evaluations)
    - 10.2 [Completion Workshops](#102-completion-workshops)
    - 10.3 [Research Outputs](#103-research-outputs)
    - 10.4 [Research Repository](#104-research-repository)
11. [Awarded Proposals](#11-awarded-proposals)
12. [Complaints](#12-complaints)
13. [Similarity Flags](#13-similarity-flags)
14. [External Funds](#14-external-funds)
    - 14.1 [Funding Opportunities](#141-funding-opportunities)
    - 14.2 [External Fund Applications](#142-external-fund-applications)
    - 14.3 [External Fund Awards](#143-external-fund-awards)
15. [Conferences and Abstracts](#15-conferences-and-abstracts)
    - 15.1 [Browsing Conferences](#151-browsing-conferences)
    - 15.2 [Submitting an Abstract](#152-submitting-an-abstract)
    - 15.3 [Managing Conferences (Admin)](#153-managing-conferences-admin)
    - 15.4 [Abstract Review (Admin)](#154-abstract-review-admin)
16. [Reports](#16-reports)
    - 16.1 [Generate Report](#161-generate-report)
    - 16.2 [Proposal Statistics](#162-proposal-statistics)
    - 16.3 [College Performance](#163-college-performance)
    - 16.4 [Budget Utilization](#164-budget-utilization)
    - 16.5 [Analytics Dashboard](#165-analytics-dashboard)
17. [Notifications](#17-notifications)
18. [Public Pages](#18-public-pages)
19. [User Management (Admin)](#19-user-management-admin)
20. [Administration](#20-administration)
    - 20.1 [Colleges and Departments](#201-colleges-and-departments)
    - 20.2 [Thematic Areas](#202-thematic-areas)
    - 20.3 [Resources](#203-resources)
    - 20.4 [Audit Logs](#204-audit-logs)
    - 20.5 [System Monitor](#205-system-monitor)
    - 20.6 [Feature Management](#206-feature-management)
21. [Settings](#21-settings)
    - 21.1 [System Settings](#211-system-settings)
    - 21.2 [Public Site Settings](#212-public-site-settings)
    - 21.3 [Login Notices](#213-login-notices)
22. [Troubleshooting](#22-troubleshooting)
23. [Frequently Asked Questions](#23-frequently-asked-questions)

---

## 1. Introduction

Welcome to the **RTT Platform** — the Research and Technology Transfer Management System. This platform supports the complete lifecycle of research proposals, from initial submission through peer review, funding, monitoring, and final completion. It also manages conferences, external grants, budget requests, and research output publications.

This manual is written for end users of all roles. Whether you are a researcher submitting a proposal, an officer reviewing submissions, a finance officer processing budgets, or an administrator managing the system, this guide covers every feature available to you.

### How to Use This Manual

- Use the **Table of Contents** to jump directly to the section you need.
- Sections marked **(Admin)** require administrative or officer-level access.
- Sections marked **(Feature-gated)** may not be visible if the feature has been disabled by your system administrator.
- **[Screenshot: Feature Name]** placeholders indicate where screenshots would appear in the printed or PDF version of this manual.

---

## 2. System Overview

The RTT Platform is organized into the following major modules:

| Module | Purpose |
|--------|---------|
| **Proposals** | Submit, track, and manage research proposals through a multi-stage review workflow |
| **Review & Evaluation** | Multi-stage peer review: validation, blind review, open defence, central evaluation |
| **Finance** | Budget allocations, budget requests, disbursements, and settlements |
| **Monitoring** | Midterm evaluations, completion workshops, research outputs |
| **Reports** | Analytics, performance metrics, and exportable reports |
| **External Funds** | Manage applications for external grants and donor funding |
| **Conferences** | Conference management and abstract submission |
| **Repository** | Public listing of completed research outputs |
| **Complaints** | File and resolve complaints about the review process |
| **Administration** | User management, roles, colleges, departments, settings |

### Proposal Lifecycle

Every proposal follows a defined workflow:

```
Draft → Submitted → Validated → Under Blind Review → Blind Review Passed
     → Under Open Defence → Accepted → Funded → Midterm Evaluation
     → Completed → (Archived)

At any stage: → Rejected
```

---

## 3. User Roles and Permissions

The system uses role-based access control. Each user is assigned one or more roles that determine what they can see and do.

### Role Summary

| Role | Description |
|------|-------------|
| **Super Admin** | Full access to all features, settings, roles, permissions, and system configuration |
| **Admin** | Manages settings, public site, login notices, and feedback; cannot change roles or permissions |
| **Central Officer** | Oversees all proposals across categories; performs central evaluation; monitors the system |
| **Research Officer** | Validates and reviews proposals in the Research category only |
| **Community Officer** | Validates and reviews proposals in the Community Engagement category only |
| **Technology Officer** | Validates and reviews proposals in the Technology Transfer category only |
| **College Officer** | Manages proposals, users, and departments within a specific college |
| **Finance Officer** | Manages all budget-related processes: allocations, requests, disbursements, settlements |
| **Staff / Researcher** | Submits and tracks own proposals; receives notifications; participates as reviewer when assigned |
| **Guest** | Read-only access to public pages: proposals, calls, repository, conferences |

> **Note:** Your system administrator may create custom roles with specific permission combinations.

### Scope Restrictions

Some roles are **scoped**, meaning their access is automatically filtered:

- **Category-scoped officers** (Research, Community, Technology) only see proposals in their assigned category.
- **College-scoped officers** (College Officer) only see data belonging to their assigned college.

---

## 4. Getting Started

### 4.1 Accessing the System

Open your web browser and navigate to the RTT Platform URL provided by your institution. The system works best on modern browsers: Chrome, Firefox, Edge, or Safari (latest versions).

[Screenshot: Login Page]

### 4.2 Logging In

The system supports three login methods depending on what your administrator has enabled:

#### Email and Password Login

1. On the login page, enter your **Email Address** and **Password**.
2. Click **Sign In**.
3. If Two-Factor Authentication is enabled on your account, you will be prompted to enter a verification code (see Section 4.3).

#### Microsoft / Azure AD (SSO)

1. On the login page, click **Sign in with Microsoft**.
2. You will be redirected to the Microsoft login page.
3. Enter your institutional Microsoft credentials.
4. On first login, you may be asked to authorize the RTT Platform application.
5. You will be redirected back to the RTT Platform dashboard.

#### Telegram Login

1. On the login page, click **Sign in with Telegram**.
2. Follow the Telegram bot prompts to link your account.
3. Once authorized, you will be logged in.

**Common Login Errors:**

| Error | Solution |
|-------|---------|
| "Invalid credentials" | Check your email and password; use "Forgot Password" if needed |
| "Account is inactive" | Contact your administrator to reactivate your account |
| "Email not verified" | Check your inbox for a verification email and click the link |
| "Too many login attempts" | Wait a few minutes before trying again (rate limit: 30 attempts per minute) |

### 4.3 Two-Factor Authentication

If 2FA is enabled on your account:

1. After entering your credentials, you will see a **2FA Verification** screen.
2. A 6-digit code will be sent to your registered email address.
3. Enter the code in the verification field.
4. Click **Verify**.
5. If you did not receive the code, click **Resend Code** (available after a short delay).

> **Note:** 2FA codes expire after a few minutes. If the code expires, request a new one.

[Screenshot: Two-Factor Authentication Screen]

### 4.4 Resetting Your Password

1. On the login page, click **Forgot Password?**
2. Enter your registered email address and click **Send Reset Link**.
3. Check your email inbox for a password reset message.
4. Click the link in the email. The link is valid for a limited time.
5. Enter and confirm your new password.
6. Click **Reset Password**.
7. You will be redirected to the login page. Log in with your new password.

### 4.5 Your Profile

To view or edit your profile:

1. Click your **avatar or name** in the top-right corner of any page.
2. Select **Profile** from the dropdown menu.

**Profile fields you can update:**
- Full Name
- Phone Number
- Gender
- Title / Position
- Avatar (profile photo)
- Notification preferences (email alerts, Telegram)

**Fields managed by administrators:**
- Email address
- College and Department affiliation
- Employee ID
- Role assignments
- Account status

[Screenshot: User Profile Page]

### 4.6 Session Timeout

For security, your session will automatically expire after a period of inactivity (configured by your administrator, typically 30–60 minutes).

- A **warning dialog** will appear a few minutes before your session expires.
- Click **Stay Logged In** to continue your session.
- If you do not respond, you will be automatically logged out.
- Any unsaved work (such as an in-progress proposal draft) may be preserved in draft state but unsaved form data may be lost.

---

## 5. Dashboard

The Dashboard is your home page after logging in. It displays a real-time summary of items that require your attention.

[Screenshot: Main Dashboard]

### Dashboard Widgets

The widgets shown on your dashboard depend on your role. Common widgets include:

| Widget | Description | Visible To |
|--------|-------------|-----------|
| Active Proposal Calls | Number of currently open proposal calls | All |
| My Proposals (Draft) | Your proposals still in draft state | Staff / Researchers |
| Validation Queue | Proposals waiting to be validated | Officers |
| Blind Review Queue | Proposals in blind review stage | Officers |
| Open Defence Queue | Proposals scheduled for open defence | Officers |
| Central Evaluation Queue | Proposals awaiting central decision | Central Officer |
| Assigned Reviews | Peer reviews assigned to you | Any reviewer |
| Awarded (Unfunded) | Accepted proposals not yet funded | Finance Officer |
| Midterm Evaluations Pending | Funded proposals due for midterm review | Officers |
| Completion Workshops Pending | Proposals due for completion assessment | Officers |
| Budget Requests Pending | Budget requests awaiting your action | Finance Officer / College Officer |
| Proposal Funding Queue | Proposals ready for funding decision | Finance Officer |
| Pending Disbursements | Approved budgets awaiting payment | Finance Officer |
| Pending Settlements | Disbursed funds awaiting settlement | Finance Officer |
| Open Complaints | Unresolved complaints | Officers |
| Similarity Flags | Proposals flagged for similarity | Officers |
| Unread Notifications | Your unread notification count | All |

### Dashboard Charts

Below the widgets, charts give a visual overview of the proposal pipeline:

- **Proposal Pipeline** — count of proposals at each status
- **Proposals by Category** — breakdown by Research / Community / Technology / Innovation
- **Proposals by College** — distribution across colleges
- **Proposal Trend** — submissions over time
- **Budget Utilization** — allocated vs. utilized budget by college
- **Reviewer Performance** — reviewer workload and completion metrics

> **Tip:** Click on any widget number to navigate directly to the relevant list.

---

## 6. My Research Hub

**Path:** Main Menu → My Research Hub

The Research Hub provides a personal overview of all your research activities in one place.

[Screenshot: Research Hub]

**What you can see here:**

- Summary of all your submitted proposals and their current status
- Your assigned peer review tasks and deadlines
- Upcoming milestone dates (midterm evaluations, completion workshops)
- Recent activity and notifications related to your proposals
- Quick links to start a new application or track an existing one

---

## 7. Proposal Management

### 7.1 Browsing Proposal Calls

**Path:** Proposals → Proposal Calls

Proposal calls are announcements inviting researchers to submit proposals. Only **active** calls are open for submissions.

[Screenshot: Proposal Calls List]

**Call Information displayed:**
- Call title and category (Research, Community, Technology, Innovation)
- Academic year
- Submission deadline with countdown timer
- Status badge (Active, Expired, Closed)
- Download link for guidelines document

**Filtering calls:**
- Filter by **Category**
- Filter by **Academic Year**
- Search by **title keyword**

**To view full call details:**
1. Click the call title or the **View** button.
2. The detail page shows: eligibility criteria, guidelines, deadline, and a button to start a new application.

> **Note:** The "New Application" button only appears if the call is currently active and you have not exceeded the maximum allowed proposals for that call.

### 7.2 Creating a New Proposal (Wizard)

**Path:** Proposals → New Application (or click "Apply Now" from a proposal call)

**Who can access:** Staff, Researchers, and any authenticated user with proposal creation permission.

The proposal is created through a **7-step wizard**. Your progress is saved at each step so you can return and continue later.

---

#### Step 1 — Basic Information

[Screenshot: Proposal Wizard Step 1]

| Field | Required | Notes |
|-------|----------|-------|
| Proposal Title | Yes | Descriptive title; max 255 characters |
| Abstract | Yes | 200–500 words summarizing the proposal |
| Keywords | Yes | 3–10 keywords separated by commas |
| Proposal Category | Yes | Research / Community Engagement / Technology Transfer / Innovation |
| Focus Area | Yes | Selected from the list for your chosen category |
| Research Type | Yes | Basic, Applied, Experimental, Clinical, Action, Review/Meta-analysis |
| Duration (months) | Yes | Expected project duration in months |
| Academic Year | Yes | The call's academic year (pre-filled if applying from a call) |
| Proposal Call | Yes | The specific call you are applying to |

**Validation:** All fields are required. The abstract must meet the minimum word count.

**To proceed:** Click **Save & Next** to save Step 1 and move to Step 2.

---

#### Step 2 — Principal Investigator (PI) Information

[Screenshot: Proposal Wizard Step 2]

This step captures the details of the Principal Investigator — the person responsible for the proposal.

| Field | Required | Notes |
|-------|----------|-------|
| PI Name | Yes | Full legal name |
| PI Email | Yes | Institutional email |
| PI Phone | No | Contact phone number |
| College | Yes | PI's affiliated college |
| Department | Yes | PI's department within the college |
| Employee ID | No | Institutional employee ID |
| Qualification | No | Highest academic qualification |
| Specialization | No | Area of expertise |

> **Note:** If you are the PI, this information may be pre-filled from your profile.

---

#### Step 3 — Research Team

[Screenshot: Proposal Wizard Step 3]

Add co-investigators who will participate in the research.

**To add a team member:**
1. Click **Add Co-Investigator**.
2. Search for the person by name or email (must be a registered system user).
3. Select their role on the team (Co-PI, Research Assistant, Collaborator, etc.).
4. Click **Add**.

**Team member statuses:**
- **Pending** — invitation sent, awaiting acceptance
- **Accepted** — member confirmed participation
- **Refused** — member declined; you can remove them or invite someone else

> **Important:** Co-investigators who have not accepted will still be listed on the proposal. Officers can see acceptance status.

---

#### Step 4 — Budget Plan

[Screenshot: Proposal Wizard Step 4]

Create a detailed budget for your proposal. Budget items are organized by category.

**Budget Categories:**
- Personnel
- Equipment
- Materials & Supplies
- Travel & Fieldwork
- Workshop & Training
- Software & Licenses
- Publication
- Overhead / Indirect Costs
- Other

**To add a budget line item:**
1. Select a **Budget Category** from the dropdown.
2. Enter a **Description** of the expense.
3. Enter the **Amount** (in local currency).
4. Add a **Justification** explaining why this expense is necessary.
5. Click **Add Item**.

**Budget summary:** The total budget is calculated automatically as you add items.

**Validation:**
- At least one budget item is required.
- Amounts must be positive numbers.
- Budget must not exceed any maximum set by the call.

---

#### Step 5 — Documents

[Screenshot: Proposal Wizard Step 5]

Upload supporting documents for your proposal.

**Document types you may upload:**
- Full Proposal Document (PDF)
- Budget Justification
- CVs of Team Members
- Ethical Clearance / IRB Approval
- Letters of Support
- Other Supporting Documents

**To upload a document:**
1. Click **Upload Document** or drag and drop a file.
2. Select the **Document Type** from the dropdown.
3. Enter an optional **Description**.
4. Click **Upload**.

**File requirements:**
- Accepted formats: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG
- Maximum file size: as configured by your administrator (typically 10 MB per file)

> **Tip:** Upload the full proposal document as a PDF for best compatibility with the review system.

---

#### Step 6 — Preview

[Screenshot: Proposal Wizard Step 6]

Review all the information you have entered across all steps before submitting.

This page shows:
- Complete proposal details (title, abstract, keywords, category, focus area)
- PI information
- Team members and their acceptance status
- Full budget breakdown with totals
- Uploaded documents list

**If you need to make changes:**
- Click **Edit** next to any section, or
- Use the step navigation at the top to go back to a specific step.

> **Important:** Once you submit (Step 7), most fields cannot be edited unless the proposal is returned for revision.

---

#### Step 7 — Submit

[Screenshot: Proposal Wizard Step 7]

This is the final step before your proposal enters the review process.

**Before submitting, confirm:**
- All required fields are complete
- Budget is finalized
- All required documents are uploaded
- Co-investigators have been notified

**To submit:**
1. Read the submission declaration.
2. Check the confirmation checkbox.
3. Click **Submit Proposal**.

**What happens next:**
- Your proposal status changes from **Draft** to **Submitted**.
- A unique **Tracker Number** is generated (e.g., RTT-2026-00123).
- You receive a confirmation email and in-app notification.
- The proposal enters the **Validation Queue** for officer review.

**Validation errors:** If any required information is missing, you will see a list of errors. Correct the issues in the relevant steps and try again.

---

### 7.3 Managing Draft Proposals

**Path:** Proposals → My Proposals (filter by "Draft")

You can have multiple draft proposals in progress simultaneously.

**Draft proposal actions:**
- **Continue** — resume editing where you left off
- **Delete** — permanently delete the draft (you will be asked to confirm)
- **Preview** — view the proposal as it currently stands

> **Note:** Draft proposals are only visible to you. They do not appear in the validation queue or officer views.

### 7.4 Submitting a Proposal

See **Section 7.2 Step 7** for submission instructions. Key points:

- Submissions are only accepted during **active proposal calls**.
- Each call may limit the maximum number of proposals per PI.
- Once submitted, you cannot edit the proposal unless an officer returns it to you for revision.
- You will receive a **Tracker Number** upon successful submission.

### 7.5 Tracking Your Proposal

**Path:** Proposals → Track Proposal, or public URL: `/tracker`

You can track the status of any proposal using its Tracker Number without logging in.

**To track a proposal:**
1. Go to the Tracker page.
2. Enter the **Tracker Number** (e.g., RTT-2026-00123).
3. Click **Track**.

**Information displayed:**
- Current status
- Submission date
- Category and focus area
- Current stage in the workflow
- Workflow history (public summary)

[Screenshot: Proposal Tracker Page]

### 7.6 My Proposals

**Path:** Proposals → My Proposals

This page lists all proposals where you are the PI or a co-investigator.

**Filtering options:**
- Status (Draft, Submitted, Under Review, Funded, etc.)
- Academic year
- Category
- Keyword search

**Actions available per proposal:**
- **View** — full proposal details
- **Edit** — only available for drafts or proposals returned for revision
- **Withdraw** — cancel a submitted proposal (only before validation)
- **Track** — view workflow history
- **Download** — download uploaded documents

[Screenshot: My Proposals List]

### 7.7 All Proposals (Officers)

**Path:** Proposals → All Proposals

Available to officers and administrators. Shows all proposals in the system (filtered by your category or college scope if applicable).

**Columns displayed:**
- Tracker Number
- Title
- Category
- College
- PI Name
- Submission Date
- Current Status
- Actions

**Filtering and search:**
- Full-text search (title, abstract, keywords)
- Filter by status, category, college, academic year
- Sort by any column

**Actions available per proposal (depending on role and status):**
- View details
- Download documents
- View workflow history
- Take workflow action (validate, assign reviewer, schedule defence, etc.)

[Screenshot: All Proposals List - Officer View]

---

## 8. Review and Evaluation

The RTT Platform uses a multi-stage evaluation process to ensure rigorous and fair assessment of all proposals.

### 8.1 Validation Queue

**Path:** Review & Evaluation → Validation Queue

**Who can access:** Research Officer, Community Officer, Technology Officer, Central Officer (within their category scope)

The validation queue shows all **Submitted** proposals that require an initial screening before entering peer review.

[Screenshot: Validation Queue]

**Purpose of Validation:**
Validation is a pre-screening step to confirm the proposal meets basic eligibility requirements (correct category, complete documentation, meets call criteria) before it enters the full peer review process.

**To validate a proposal:**
1. Click **Review** on a proposal in the queue.
2. Read the proposal summary, PI information, and uploaded documents.
3. Choose one of three actions:

   - **Approve for Review** — proposal passes validation; status moves to "Validated" and enters the Blind Review queue.
   - **Return for Revision** — proposal has issues; it is returned to the PI with your comments.
   - **Reject** — proposal is ineligible; status moves to "Rejected" (you must provide a reason).

4. Enter your **comments or reason** (required for Return and Reject actions).
5. Click **Confirm**.

**Outcome notifications:**
- PI receives an email and in-app notification with the validation result and any comments.

### 8.2 Blind Review

**Path:** Review & Evaluation → Blind Review

**Who can access:** Officers (within their category scope)

After validation, proposals enter **Blind Review** — a peer review process where reviewer identities are kept anonymous.

[Screenshot: Blind Review Queue]

#### Assigning Reviewers

1. Click **Manage Reviews** on a proposal in the blind review queue.
2. The reviewer assignment panel opens showing available reviewers.
3. **Search and filter** reviewers by:
   - Name or email
   - Expertise area
   - Department or college
   - Current workload (to balance assignments)
4. Check for **conflict of interest**: the system automatically flags reviewers who are members of the proposal team.
5. Select the reviewers you want to assign.
6. Set a **Review Due Date**.
7. Click **Assign Reviewers**.

**Reviewer notification:** Each assigned reviewer receives an email and in-app notification with the proposal ID, deadline, and a link to the review form.

#### Managing Assignments

For each assignment, officers can:
- **Extend Due Date** — grant a reviewer more time
- **Reassign** — replace a reviewer who cannot complete the review
- **View Progress** — check if reviews have been submitted

#### Moving to Next Stage

Once all reviews are submitted (or the due date has passed), the officer can:
- **Pass to Open Defence** — if the proposal has sufficient positive reviews
- **Reject** — if reviews indicate the proposal does not merit further review

### 8.3 Open Defence

**Path:** Review & Evaluation → Open Defence

**Who can access:** Officers (within their category scope)

Proposals that pass blind review enter **Open Defence**, where the PI presents their proposal to a panel.

[Screenshot: Open Defence Queue]

#### Scheduling a Defence Session

1. Click **Schedule Defence** on a proposal in the Open Defence queue.
2. Fill in the session details:
   - **Date and Time**
   - **Venue** (physical location)
   - **Online Meeting Link** (for hybrid/virtual sessions)
   - **Panel Members** (select reviewers/officers to attend)
3. Click **Schedule**.

**Notification:** The PI and all panel members receive an email invitation with the session details.

#### Conducting and Recording a Defence

After the defence session takes place:
1. Return to the Open Defence queue and click **Process Result**.
2. Select the outcome:
   - **Accepted** — proposal is approved; status moves to "Accepted"
   - **Rejected** — proposal is declined (must provide reason)
3. Add session notes or recommendations.
4. Click **Submit Result**.

### 8.4 Central Evaluation

**Path:** Review & Evaluation → Central Evaluation

**Who can access:** Central Officer

After open defence, proposals that are accepted require a final approval from the Central Officer before being marked as **Accepted** and eligible for funding.

[Screenshot: Central Evaluation Queue]

**To complete central evaluation:**
1. Review the proposal, all review scores, and defence session notes.
2. Select **Approve** or **Reject**.
3. Add comments if needed.
4. Click **Submit Decision**.

### 8.5 Assigned Reviews (Reviewer View)

**Path:** Review & Evaluation → Assigned Reviews

**Who can access:** Any user assigned as a reviewer

This section shows all peer review assignments given to you.

[Screenshot: Assigned Reviews List]

**To submit a review:**
1. Click **Review** on an assigned proposal.
2. The proposal details are shown (PI name is hidden to preserve anonymity).
3. Answer each **evaluation question** across all categories.
   - Questions may be scored on a numerical scale or rated with descriptive levels.
   - Each question belongs to an evaluation category (Scientific Merit, Methodology, Budget, Impact, etc.).
4. Add any **general comments**.
5. Click **Submit Review**.

> **Important:** Once submitted, a review cannot be edited. Review your responses carefully before submitting.

**Due dates:** Your assignment list shows the due date for each review. Overdue reviews are highlighted in red.

### 8.6 Evaluation Criteria Management

**Path:** Review & Evaluation → Evaluation Criteria

**Who can access:** Officers and Super Admin

The evaluation criteria define the questions and scoring rubrics used in blind review.

**Structure:**
- **Evaluation Types** — a named set of criteria (e.g., "Standard Research Review")
- **Categories** — groupings of related questions within an evaluation type (e.g., "Scientific Merit", "Methodology")
- **Questions** — individual evaluation questions within each category

**To create new evaluation criteria:**
1. Create an **Evaluation Type** by clicking **New Evaluation Type**.
2. Under the type, add **Categories**.
3. Under each category, add **Questions** with their scoring method and maximum score.

### 8.7 Reviewer Workload

**Path:** Review & Evaluation → Reviewer Workload

**Who can access:** Officers, Central Officer

This dashboard shows the review workload across all assigned reviewers to help distribute assignments fairly.

[Screenshot: Reviewer Workload Dashboard]

**Displays:**
- Number of active assignments per reviewer
- Completed vs. pending reviews
- Average review completion time
- Overdue assignments highlighted

---

## 9. Finance Module

> **Note:** The Finance module is a configurable feature. If you do not see these menu items, the feature may not be enabled for your institution.

### 9.1 Budget Allocations

**Path:** Budget → Budget Allocations

**Who can access:** Finance Officer, Super Admin

Budget allocations define the total funding available per college per fiscal year.

[Screenshot: Budget Allocations Page]

**To create a budget allocation:**
1. Click **New Allocation**.
2. Select the **College** and **Fiscal Year**.
3. Enter the **Total Allocated Amount**.
4. Click **Save**.

**Allocation statuses:**
- **Pending** — entered but not yet approved
- **Approved** — active allocation available for budget requests

**Bulk approval:** Select multiple pending allocations and click **Approve Selected**.

### 9.2 Budget Requests

**Path:** Budget → Budget Requests

**Who can access:** Finance Officer, College Officer, Staff (for own proposals)

Budget Requests are formal requests for project funds submitted by PIs after their proposals are funded.

[Screenshot: Budget Requests List]

#### Budget Request Workflow

```
Draft → Pending Signatures → Submitted → Under College Review → Approved / Rejected → Disbursed → Settled
```

#### Creating a Budget Request

1. Click **New Budget Request**.
2. Select the **Proposal** this request is for.
3. Select the **Form Template** (if multiple templates are configured).
4. Add **Budget Line Items**:
   - Category (Personnel, Equipment, etc.)
   - Description
   - Amount
   - Justification
5. Click **Save as Draft** or **Submit for Signatures**.

#### Signature Workflow

Budget requests require signatures from designated approvers before final submission.

1. Once all line items are added, click **Submit for Signatures**.
2. The system identifies required signatories from the form template.
3. Each signatory receives a notification to sign.
4. Signatories log in and click **Sign** on the budget request.
5. Once all signatures are collected, the request is automatically submitted.

#### College Review

After submission, the College Officer reviews the request:
- **Approve** — request proceeds to Finance Officer for disbursement
- **Reject** — request is returned with comments (must revise and resubmit)

### 9.3 Proposal Funding

**Path:** Budget → Proposal Funding

**Who can access:** Finance Officer

This queue shows all proposals that have been **Accepted** through the evaluation process and are waiting for a funding decision.

[Screenshot: Proposal Funding Queue]

**To fund a proposal:**
1. Click **Fund** on a proposal.
2. Review the proposal details and budget request.
3. Confirm the funding amount (or adjust if partial funding).
4. Click **Confirm Funding**.

**What happens:**
- Proposal status changes to **Funded**.
- An **Award Letter** is generated (available for download as PDF).
- The PI receives a funding notification.

**To generate and download the Award Letter:**
1. Go to **Awarded Proposals** (see Section 11).
2. Click **Download Award Letter** on the funded proposal.

### 9.4 Disbursements

**Path:** Budget → Disbursements

**Who can access:** Finance Officer

Disbursements track the actual transfer of funds to research teams after a budget request is approved.

[Screenshot: Disbursements Page]

**To record a disbursement:**
1. Click **New Disbursement** on an approved budget request.
2. Enter:
   - **Disbursement Date**
   - **Amount Disbursed**
   - **Payment Reference / Proof of Payment** (file upload)
3. Click **Record Disbursement**.

The budget request status changes to **Disbursed**, and the PI receives a notification.

### 9.5 Settlements

**Path:** Budget → Settlements

**Who can access:** Finance Officer, Staff (for own projects)

Settlements are the expense reports submitted by research teams after using disbursed funds.

[Screenshot: Settlements Page]

#### Submitting a Settlement (PI/Staff)

1. Go to **Budget → Settlements** and click **New Settlement** on a disbursed budget request.
2. Attach the **Expense Report** document.
3. Enter the **Total Amount Spent**.
4. Add notes or explanations.
5. Click **Submit Settlement**.

#### Verifying a Settlement (Finance Officer)

1. Review the submitted expense report.
2. **Verify** — confirm the expenses are valid and amounts match.
3. **Finalize** — mark the settlement as complete.
4. **Reject** — return with comments if discrepancies are found.

**Budget request lifecycle completes** when the settlement is finalized.

---

## 10. Monitoring Module

> **Note:** The Monitoring module is a configurable feature. Contact your administrator if it is not visible.

### 10.1 Midterm Evaluations

**Path:** Monitoring → Midterm Evaluations

**Who can access:** Officers, Finance Officer

Funded proposals undergo a **Midterm Evaluation** to assess progress before the project is completed.

[Screenshot: Midterm Evaluations List]

#### Scheduling a Midterm Evaluation (Officer)

1. Click **Schedule Evaluation** on an eligible funded proposal.
2. Enter:
   - **Evaluation Date, Time, and Venue**
   - **Evaluators** to attend
3. Click **Schedule**.

**Bulk scheduling:** Select multiple proposals and click **Schedule Selected** to set up evaluations simultaneously.

#### Submitting a Progress Report (PI)

Before the midterm evaluation, the PI submits a progress report:

1. Go to **My Proposals** → select the funded proposal.
2. Click **Submit Progress Report**.
3. Fill in:
   - **Progress Summary**
   - **Financial Utilization %** (how much of the budget has been used)
   - **Number of Publications** to date
   - **Challenges Encountered**
   - **Milestones Achieved**
   - Upload the **Progress Report** file
   - Upload the **Financial Report** file
4. Click **Submit**.

#### Recording Evaluation Results (Officer)

After the evaluation session:
1. Click **Record Result** on the scheduled evaluation.
2. Enter:
   - **Score** (numeric)
   - **Recommendations**
   - **Notes**
3. Click **Save Result**.

Depending on the outcome, the proposal may continue to completion or require additional action.

### 10.2 Completion Workshops

**Path:** Monitoring → Completion Workshops

**Who can access:** Officers

When a funded project is nearing completion, a **Completion Workshop** is scheduled to assess final outcomes.

[Screenshot: Completion Workshops List]

#### Scheduling a Completion Workshop (Officer)

1. Click **Schedule Workshop** on an eligible proposal.
2. Enter:
   - **Workshop Date, Time, Venue**
   - **Online Meeting Link** (if hybrid/virtual)
   - **Evaluators** to attend
3. Click **Schedule**.

#### Submitting Final Evidence (PI)

1. Upload the **Final Report** document.
2. Upload **Presentation Slides**.
3. Add **Photos** from the project.
4. Add **Video** links or uploads.
5. Submit a **Research Outputs** summary.

#### Recording Workshop Results (Officer)

After the workshop:
1. Record the **status outcome** (Completed / Needs Revision).
2. Add evaluation notes.
3. Click **Finalize Workshop**.

When finalized with a Completed outcome, the proposal status transitions to **Completed**.

### 10.3 Research Outputs

**Path:** Monitoring → Research Outputs

**Who can access:** Officers, Staff (for own proposals)

Research Outputs track the intellectual products generated by funded projects.

[Screenshot: Research Outputs Page]

**Output types:**
- Publication (journal article, conference paper, book chapter)
- Patent
- Presentation
- Technology product/prototype
- Community impact report

**To add a research output:**
1. Click **Add Output** on a funded or completed proposal.
2. Select the **Output Type**.
3. Enter the **Title** and **Description**.
4. Toggle **Ready for Repository** if the output should be published publicly.
5. Click **Save**.

### 10.4 Research Repository

**Path:** Monitoring → Repository (public)
**Admin Path:** Monitoring → Manage Repository

The Research Repository is a public listing of completed research outputs.

[Screenshot: Research Repository - Public View]

**Public users can:**
- Browse all published research outputs
- Search by keyword, category, or year
- View output details

**Administrators/Officers can:**
- Mark eligible proposals as publishable
- Publish to the repository
- Unpublish if needed

**To publish a proposal's outputs:**
1. Go to **Manage Repository**.
2. Find the completed proposal.
3. Click **Publish to Repository**.
4. The proposal and its outputs appear on the public repository.

---

## 11. Awarded Proposals

**Path:** Proposals → Awarded Proposals

This page shows all proposals that have been funded.

[Screenshot: Awarded Proposals Page]

**Information displayed:**
- Tracker Number and Title
- PI Name and College
- Award Date
- Funded Amount
- Award Status (Funded, Disbursed, Completed)

**Available actions:**
- **View** — full proposal and award details
- **Download Award Letter** — PDF award notification
- **Track Budget** — link to the associated budget request
- **Export** — download the awarded proposals list as a CSV/Excel file

---

## 12. Complaints

**Path:** Review & Evaluation → Complaints

> **Note:** The Complaints module is a configurable feature.

The complaints module allows researchers and stakeholders to formally raise concerns about the review or funding process.

[Screenshot: Complaints Page]

### Filing a Complaint (Staff / Researcher)

1. Go to **Review & Evaluation → Complaints**.
2. Click **New Complaint**.
3. Fill in:
   - **Proposal** related to the complaint
   - **Complaint Category**: Fairness / Bias / Process / Technical / Other
   - **Stage**: Which stage the issue occurred (validation, review, defence, funding, etc.)
   - **Complaint Level**
   - **Description**: Detailed account of the complaint
4. Click **Submit Complaint**.

> **Note:** You can only file one complaint per proposal per stage. Duplicate complaints will be rejected.

### Complaint Statuses

| Status | Meaning |
|--------|---------|
| Open | Complaint submitted, not yet assigned |
| Assigned | An officer has been assigned to investigate |
| Resolved | Complaint has been addressed |
| Escalated | Complaint has been referred to higher authority |

### Responding to a Complaint (Officer)

1. Go to the complaint from the Complaints list.
2. Click **Assign to Me** or assign to another officer.
3. Investigate the complaint.
4. Click **Respond**:
   - Enter your response text.
   - Select the resolution outcome.
5. Click **Mark as Resolved** or **Escalate** if needed.

### Escalation

If a complaint cannot be resolved at the current level, it can be escalated to a higher authority. The complainant and the new assignee both receive notifications.

---

## 13. Similarity Flags

**Path:** Review & Evaluation → Similarity Flags

> **Note:** The Similarity module must be enabled by your administrator.

**Who can access:** Officers

The similarity detection module uses automated analysis to identify proposals that may share significant content with existing proposals.

[Screenshot: Similarity Flags Page]

**What is displayed:**
- Proposal title and tracker number
- Similarity score (percentage)
- Matched proposal(s)
- Flag status (Pending Review / Reviewed / Cleared)

**To review a similarity flag:**
1. Click **Review** on a flagged proposal.
2. View the similarity report showing matched sections.
3. Compare the flagged proposal with the matched proposal(s).
4. Choose:
   - **Clear Flag** — similarity is coincidental or acceptable (e.g., standard methodology descriptions)
   - **Take Action** — proceed with further review, return proposal, or reject
5. Add notes explaining your decision.
6. Click **Save Decision**.

---

## 14. External Funds

**Path:** External Funds

> **Note:** The External Funds module is a configurable feature.

The External Funds module helps researchers identify and apply for funding from external donors and agencies.

### 14.1 Funding Opportunities

**Path:** External Funds → Funding Opportunities

[Screenshot: Funding Opportunities Page]

Browse available funding opportunities from external agencies. This page is also accessible to the public at `/funding-opportunities`.

**Each opportunity shows:**
- Donor/agency name
- Opportunity title and description
- Eligible categories
- Application deadline
- Funding amount range

### 14.2 External Fund Applications

**Path:** External Funds → External Fund Applications

**Who can access:** Staff, Officers

Manage applications for external funding opportunities.

[Screenshot: External Fund Applications List]

#### Application Statuses

```
Draft → Under Internal Review → Approved for Submission → Submitted →
Under Review → Awarded / Rejected / Withdrawn
```

#### Creating an External Fund Application

1. Click **New Application**.
2. Fill in:
   - **Application Title**
   - **Funding Opportunity** (select from registered opportunities)
   - **Category**: Research / Community / Technology / Innovation / Other
   - **Abstract and Goals**
   - **Principal Investigator**
   - **College and Department**
   - **Partner Institutions** (if applicable)
   - **Amount Requested** and **Currency**
   - **Project Start and End Dates**
   - **Keywords and Theme**
3. Add **Team Members**.
4. Add **Budget Details**.
5. Upload **Supporting Documents**.
6. Click **Save as Draft** or **Submit for Internal Review**.

#### Internal Review

A designated officer reviews the application internally before it is submitted to the external agency.
- **Approve for Submission** — the application is cleared for external submission
- **Reject** — the application is returned with comments

### 14.3 External Fund Awards

**Path:** External Funds → Awards

Tracks external funding that has been formally awarded.

**Award features:**
- Award amount and currency tracking
- **Milestones**: Key project deliverables with dates
- **Expenditures**: Track spending against the award
- **Document management**: Upload award agreement, progress reports

---

## 15. Conferences and Abstracts

### 15.1 Browsing Conferences

**Path:** Events → Conferences (public: `/conferences`)

Browse upcoming and past conferences organized by the institution.

[Screenshot: Conferences Public Page]

**Each conference listing shows:**
- Conference name and banner
- Date range and location (physical/virtual/hybrid)
- Brief description
- Registration link (if available)
- Featured speakers

**To view a conference:**
Click on the conference name to see the full detail page including the schedule, speakers, sessions, and abstract submission instructions.

### 15.2 Submitting an Abstract

**Path:** Public → Conferences → [Conference Name] → Submit Abstract

Anyone (including non-logged-in users) can submit an abstract to an open conference.

[Screenshot: Abstract Submission Form]

**To submit an abstract:**
1. Navigate to the conference detail page.
2. Click **Submit Abstract**.
3. Fill in:
   - **Title** of your abstract
   - **Authors** and affiliations
   - **Abstract text** (typically 250–500 words)
   - **Keywords**
   - **Presentation preference** (oral / poster / either)
4. Click **Submit**.
5. You will receive a **Tracking Token** — save this to check the status of your abstract.

**To track your abstract:**
1. Go to `/my-abstracts` or click **My Abstracts** in the menu.
2. Enter your tracking token.
3. View the current status (Submitted, Under Review, Accepted, Rejected).

**To withdraw your abstract:**
1. Go to My Abstracts.
2. Click **Withdraw** on the abstract you wish to withdraw.
3. Confirm the withdrawal.

### 15.3 Managing Conferences (Admin)

**Path:** Events → Conferences (Admin)

**Who can access:** Admin, Super Admin

[Screenshot: Conference Management - Admin]

#### Creating a Conference

1. Click **New Conference**.
2. Fill in:
   - **Title** and **Slug** (URL-friendly name)
   - **Description**
   - **Banner Image** (upload)
   - **Start and End Dates** (with timezone)
   - **Location Type**: Physical / Virtual / Hybrid
   - **Physical Address** (for in-person or hybrid)
   - **Online Meeting Link** (for virtual or hybrid)
   - **Max Capacity**
   - **Registration Link** (external registration system URL if applicable)
   - **Tags**
   - **Featured** toggle (highlights the conference on the public page)
3. Add **Speakers**:
   - Speaker name, title, bio, and photo
   - Set sort order
4. Add **Sessions**:
   - Session title, date, time, presenter
5. Set **Status** (Draft / Published)
6. Click **Save**.

#### Managing Abstracts

See **Section 15.4** below.

### 15.4 Abstract Review (Admin)

**Path:** Events → Abstracts

**Who can access:** Admin, Officers assigned as abstract reviewers

[Screenshot: Abstract Reviews - Admin View]

**To review an abstract:**
1. Click **Review** on a submitted abstract.
2. Read the abstract content.
3. Assign a **Reviewer** (if not already assigned to yourself).
4. Submit your **Review Score** and **Comments**.
5. Change status to:
   - **Accepted** — abstract is approved for presentation
   - **Rejected** — abstract is not accepted
6. Click **Save Decision**.

**The submitter is notified** of the outcome via email.

---

## 16. Reports

> **Note:** The Reports module is a configurable feature.

**Path:** Reports

### 16.1 Generate Report

**Path:** Reports → Generate Report

**Who can access:** Officers, Admin, Super Admin

[Screenshot: Generate Report Page]

**Available report types:**
- Proposal Count by Category
- Proposal Count by College
- Proposals by Status
- College Performance Summary
- Budget Utilization Report
- Custom / Filtered Report

**To generate a report:**
1. Select the **Report Type**.
2. Set filter criteria:
   - **Date Range** (start date – end date)
   - **Category** (or "All Categories")
   - **College** (or "All Colleges")
   - **Status** (or "All Statuses")
   - **Academic Year**
3. Click **Generate**.
4. The report appears on screen.
5. Click **Export** to download as:
   - **CSV** (for spreadsheet use)
   - **Excel** (formatted spreadsheet)
   - **PDF** (for printing)

### 16.2 Proposal Statistics

**Path:** Reports → Proposal Statistics

[Screenshot: Proposal Statistics Page]

A visual summary of proposals across the system. Includes:
- Total proposals by status (bar chart)
- Proposals by category (pie chart)
- Proposals by college (table with counts and percentages)
- Submission trend over time (line chart)

### 16.3 College Performance

**Path:** Reports → College Performance

**Who can access:** Admin, Central Officer, Super Admin

[Screenshot: College Performance Report]

Shows the research performance of each college:
- Number of proposals submitted
- Acceptance rate
- Funded proposals
- Average review score
- Budget utilization rate

Export as CSV or PDF.

### 16.4 Budget Utilization

**Path:** Reports → Budget Utilization

**Who can access:** Finance Officer, Admin, Super Admin

[Screenshot: Budget Utilization Report]

Tracks budget allocation vs. actual spending:
- Allocated vs. disbursed amount per college
- Settlement completion rate
- Budget requests by status
- Overspend / underspend alerts

### 16.5 Analytics Dashboard

**Path:** Reports → Analytics Dashboard

**Who can access:** Admin, Super Admin

[Screenshot: Analytics Dashboard]

A comprehensive live dashboard combining all key metrics:
- Proposal pipeline visualization
- Review completion rates and timelines
- Reviewer performance metrics
- Budget utilization across all colleges
- Year-over-year comparisons
- KPI summary cards

---

## 17. Notifications

**Path:** User Menu → Notifications (bell icon)

[Screenshot: Notifications Panel]

The RTT Platform sends you notifications when important events occur.

### Notification Types

| Trigger | Recipients |
|---------|-----------|
| Proposal submitted | Officer (validation queue) |
| Proposal validated (approved) | PI |
| Proposal returned for revision | PI |
| Proposal rejected | PI |
| Review assigned | Assigned reviewer |
| Review due date approaching | Reviewer |
| Defence scheduled | PI and panel members |
| Proposal funded | PI |
| Budget request signature needed | Signatory |
| Budget request approved/rejected | PI / Requester |
| Disbursement recorded | PI |
| Settlement verified | PI |
| Midterm evaluation scheduled | PI |
| Complaint assigned | Assigned officer |
| Complaint resolved | Complainant |
| Deadline reminder (7/3/1 day) | PIs with drafts |
| Abstract accepted/rejected | Abstract submitter |
| System alerts | Admins |

### Managing Notifications

**To view notifications:**
1. Click the **Bell icon** in the top navigation bar.
2. The notification panel slides open showing recent unread notifications.
3. Click any notification to go to the related page.
4. Click **Mark All Read** to clear the unread count.

**Notification channels:**
- **In-app** — always active; shows in the notification panel
- **Email** — can be configured per user (on/off)
- **Telegram** — requires linking your Telegram account; can be enabled in profile

**To configure notification preferences:**
1. Go to your **Profile** page.
2. In the **Notification Settings** section, toggle email and Telegram notifications on or off.
3. Click **Save Preferences**.

---

## 18. Public Pages

The following pages are accessible without logging in:

| Page | URL | Description |
|------|-----|-------------|
| Home | `/` | Landing page with system introduction |
| Explore Proposals | `/explore` | Browse publicly visible proposals |
| Proposal Calls | `/proposal-calls` | Active proposal calls |
| Funding Opportunities | `/funding-opportunities` | External funding opportunities |
| Repository | `/repository` | Published research outputs |
| Track Proposal | `/tracker` | Lookup by tracker number |
| Conferences | `/conferences` | Upcoming and past conferences |
| Conference Detail | `/conferences/{slug}` | Individual conference page |
| Submit Abstract | `/conferences/{slug}/submit-abstract` | Abstract submission form |
| My Abstracts | `/my-abstracts` | Track submitted abstracts by token |
| Download Resources | `/download` | Downloadable resources and templates |

---

## 19. User Management (Admin)

**Path:** Administration → Users

**Who can access:** Admin, Super Admin, College Officer (own college only)

[Screenshot: User Management Page]

### Viewing Users

The user list shows:
- Name and Email
- College and Department
- Role(s)
- Status (Active / Inactive / Guest)
- Last Login date

**Filtering:** Search by name/email, filter by role, college, or status.

### Creating a New User

1. Click **New User**.
2. Fill in:
   - **Full Name** (required)
   - **Email Address** (required; must be unique)
   - **Employee ID** (optional)
   - **College** and **Department**
   - **Title / Position**
   - **Phone** and **Gender**
   - **Expertise** (relevant competencies for reviewer matching)
   - **Role(s)** — select one or more roles
   - **Status** — Active / Inactive / Guest
3. The system sends a **welcome email** with a temporary password or email verification link.
4. Click **Save**.

### Editing a User

1. Click the user's name or the **Edit** icon.
2. Update any fields.
3. Click **Save Changes**.

### Changing a User's Role

1. Open the user's profile.
2. In the **Roles** section, add or remove roles.
3. Click **Save**.

> **Note:** Role changes take effect immediately on next login or page refresh.

### Deactivating a User

1. Open the user's profile.
2. Change **Status** to **Inactive**.
3. Click **Save**.

Inactive users cannot log in but their data is preserved.

### Impersonating a User (Super Admin Only)

Super Admins can log in as another user to troubleshoot issues.

1. Find the user in the Users list.
2. Click the **Impersonate** icon (eye icon).
3. You are now logged in as that user.
4. To return to your admin account, click **Stop Impersonating** in the top bar.

> **Warning:** All actions taken while impersonating are performed as the impersonated user and are logged in the audit trail.

### Bulk Actions

Select multiple users and choose from:
- **Assign Role** — apply a role to all selected users
- **Change Status** — activate or deactivate all selected users
- **Export** — download selected users as CSV

### Importing Users (CSV)

1. Click **Import Users**.
2. Download the **CSV Template**.
3. Fill in the template with user data.
4. Upload the completed CSV file.
5. Review the import preview.
6. Click **Confirm Import**.

---

## 20. Administration

### 20.1 Colleges and Departments

**Path:** Administration → Colleges / Departments

**Who can access:** Admin, Super Admin

Colleges and departments define the organizational structure of your institution.

#### Managing Colleges

1. Go to **Administration → Colleges**.
2. Click **New College** to add a college.
3. Enter the **Name** and **Code** (abbreviated identifier).
4. Click **Save**.

#### Managing Departments

1. Go to **Administration → Departments**.
2. Click **New Department**.
3. Enter the **Name**, **Code**, and select the **Parent College**.
4. Click **Save**.

> Colleges and departments are used to categorize users and proposals and to filter data for college-scoped officers.

### 20.2 Thematic Areas

**Path:** Administration → Thematic Areas

**Who can access:** Super Admin

Thematic areas represent research priority areas used to classify proposals. Administrators can create, edit, or deactivate thematic areas.

### 20.3 Resources

**Path:** Administration → Resources

**Who can access:** Admin, Super Admin

Manage downloadable files available on the public **Download** page.

**To add a resource:**
1. Click **New Resource**.
2. Enter the **Title** and optional **Description**.
3. Upload the file.
4. Set as **Active** to make it publicly available.
5. Click **Save**.

### 20.4 Audit Logs

**Path:** Administration → Audit Logs

**Who can access:** Super Admin

The audit log provides an immutable record of all significant actions taken in the system.

[Screenshot: Audit Logs Page]

**Each log entry shows:**
- **Timestamp** — exact date and time
- **Actor** — the user who performed the action
- **Action Type** — what was done (created, updated, deleted, status changed, etc.)
- **Affected Record** — what was affected (proposal ID, user ID, etc.)
- **IP Address** — the IP from which the action was performed
- **Old Value → New Value** — before and after state (for changes)

**Filtering:**
- By date range
- By actor (user)
- By action type
- By record type

> **Note:** Audit logs are read-only and cannot be edited or deleted. This is enforced at the database level to ensure compliance.

### 20.5 System Monitor

**Path:** Administration → System Monitor

**Who can access:** Central Officer, Admin, Super Admin

Real-time monitoring of system health.

[Screenshot: System Monitor Dashboard]

**Metrics displayed:**
- **CPU Usage** — current server CPU utilization
- **Memory Usage** — RAM used vs. available
- **Disk Usage** — storage used vs. available
- **Request Statistics** — requests per minute, average response time
- **Failed Jobs** — jobs that failed to execute in the background queue

**Performance Alerts:**
- The system automatically detects anomalies (e.g., CPU spike > 90%, disk > 85%)
- Alerts appear in the monitor dashboard
- To resolve an alert, click **Acknowledge** and add a note

**Failed Job Management:**
- View the list of failed background jobs
- Click **Retry** to re-attempt a failed job
- Click **Delete** to remove a job from the failed queue

### 20.6 Feature Management

**Path:** Administration → Feature Management

**Who can access:** Super Admin only

Enable or disable major system modules without requiring code changes.

[Screenshot: Feature Management Page]

**Toggleable features:**

| Feature | What it controls |
|---------|----------------|
| Finance | Budget module (allocations, requests, disbursements, settlements) |
| Monitoring | Midterm evaluations, completion workshops, research outputs |
| Reports | Report generation and analytics dashboard |
| Complaints | Complaint filing and resolution workflow |
| Similarity | Plagiarism/similarity detection flags |
| External Funds | External funding opportunities and applications |
| Conferences | Conference and abstract management |
| Repository | Public research output repository |
| Self-Registration | Allow new users to register themselves |

**To toggle a feature:**
1. Click the **toggle switch** next to the feature name.
2. Confirm the action in the dialog.
3. The change takes effect immediately — all users see the updated navigation instantly.

---

## 21. Settings

### 21.1 System Settings

**Path:** Settings → Settings

**Who can access:** Admin, Super Admin

Configure the core appearance and behavior of the RTT Platform.

[Screenshot: System Settings Page]

| Setting | Description |
|---------|-------------|
| System Name | The name displayed in the header and emails |
| System Tagline | A short description shown on the login page |
| Logo | Upload a logo image (PNG/SVG recommended) |
| Logo Width / Height | Pixel dimensions for the logo |
| Sidebar Color | Customize the navigation sidebar color |
| Announcement Banner | Toggle on/off; set the banner message |
| Footer Text | Text shown in the footer of every page |
| Feedback Popup | Enable/disable the feedback widget |
| Session Timeout | Inactivity timeout in minutes |
| Allow Self-Registration | Whether new users can register themselves |
| Allow Password Login | Whether email/password login is enabled |
| Auto-Backup | Enable scheduled database backups |
| Backup Time | Time of day to run scheduled backups |
| Maintenance Mode | Take the system offline for maintenance |
| Max Concurrent Sessions | Maximum active sessions per user |

After making changes, click **Save Settings**.

### 21.2 Public Site Settings

**Path:** Settings → Public Site

**Who can access:** Admin, Super Admin

Configure the content displayed on public-facing pages (home page, about section, contact information, etc.).

### 21.3 Login Notices

**Path:** Settings → Login Notices

**Who can access:** Admin, Super Admin

Login Notices are messages displayed on the login page before users sign in. Use them for announcements, maintenance warnings, or important policy updates.

**To create a login notice:**
1. Click **New Notice**.
2. Enter the **Message** text.
3. Set the **Publish Date** (when the notice becomes visible).
4. Toggle **Active** to publish immediately.
5. Click **Save**.

Multiple active notices are shown in order on the login page. To remove a notice, toggle it to Inactive or delete it.

---

## 22. Troubleshooting

### Cannot Log In

| Symptom | Solution |
|---------|---------|
| "Invalid credentials" error | Double-check email and password. Use "Forgot Password" if needed. |
| "Account is inactive" | Contact your administrator. |
| "Email not verified" | Check your inbox for a verification email. Click the link to verify. |
| SSO/Microsoft login fails | Contact IT support; may be an Azure AD configuration issue. |
| 2FA code not received | Check your spam folder. Wait 2 minutes and click "Resend Code". |
| Too many attempts | Wait 5 minutes before retrying. |

### Cannot Submit a Proposal

| Symptom | Solution |
|---------|---------|
| "No active proposal calls" | Check that the call deadline has not passed. Contact an officer. |
| Wizard validation errors | Read each error message carefully and fill in the missing/incorrect fields. |
| File upload fails | Check file size (must be within the limit) and file type (PDF, DOC, DOCX, etc.). |
| Cannot find co-investigator | The person must be a registered system user. Ask them to register first. |
| Proposal already submitted maximum | You have reached the per-PI limit for this call. Contact the officer. |

### Proposal Not Appearing in Queue

| Symptom | Solution |
|---------|---------|
| Submitted proposal not in validation queue | Allow a few minutes for processing. Refresh the page. |
| "I can't see my proposal" (officer) | Check your category/college scope filters. Proposals outside your scope are not visible. |
| Proposal status hasn't changed after action | Refresh the page. Check the audit log for errors. |

### Notifications Not Received

| Symptom | Solution |
|---------|---------|
| No email received | Check your spam/junk folder. Verify your email preferences in your profile. |
| Telegram notifications not working | Ensure your Telegram account is linked in your profile. |
| In-app notifications not showing | Click the bell icon and check the notification panel. Refresh the page. |

### File Download Issues

| Symptom | Solution |
|---------|---------|
| Download link doesn't work | The download link may have expired. Refresh the page and try again. |
| "Access denied" when downloading | You may not have permission to access this file. Contact your officer. |
| PDF opens as blank | Try a different browser or PDF viewer. |

### Report Generation Issues

| Symptom | Solution |
|---------|---------|
| Report shows no data | Adjust the date range and filters. Ensure data exists for the selected criteria. |
| Export file is empty | Same as above. Also check that you have at least one record matching the criteria. |
| "Reports feature is disabled" | Contact your Super Admin to enable the Reports module. |

---

## 23. Frequently Asked Questions

**Q: How do I know which proposal call to apply to?**
A: Go to **Proposals → Proposal Calls** and review the active calls. Each call specifies the eligible category, focus areas, deadline, and guidelines. Read the guidelines document before applying.

---

**Q: Can I edit my proposal after submitting it?**
A: No. Once submitted, a proposal cannot be edited unless an officer returns it to you for revision. Check your notifications for revision requests.

---

**Q: What is a Tracker Number and where do I find it?**
A: A Tracker Number (e.g., RTT-2026-00123) is a unique identifier assigned to your proposal upon submission. It appears in your confirmation email, in **My Proposals**, and on the **Track Proposal** page.

---

**Q: How long does the review process take?**
A: The timeline varies by institution and call. Typical stages are:
- Validation: 1–2 weeks
- Blind Review: 3–6 weeks
- Open Defence: Scheduled after reviews
- Central Evaluation: 1–2 weeks

Check the proposal call guidelines for specific timelines.

---

**Q: Can I submit a proposal for a colleague who is the actual PI?**
A: No. Proposals must be submitted by the Principal Investigator. If you need to assist with data entry, the PI must log in to complete the final submission.

---

**Q: I was assigned as a reviewer but I have a conflict of interest. What should I do?**
A: Do not review the proposal. Contact the assigning officer immediately and explain the conflict. The system checks for co-authorship conflicts automatically but cannot detect all types of conflicts.

---

**Q: How do I add a team member who is not registered in the system?**
A: You cannot add unregistered users to your proposal team. Ask the person to register for an account first. If self-registration is disabled, the administrator needs to create their account.

---

**Q: Can I submit a proposal to multiple calls at the same time?**
A: This depends on the rules set by each proposal call (maximum proposals per PI). In general, you may submit to different calls for different categories. Check each call's guidelines.

---

**Q: My session expired and I lost my progress. Is my draft saved?**
A: Yes. The wizard saves your work at each step when you click "Save & Next". If your session expired mid-step, you may lose unsaved data within that step, but all previously completed steps are saved.

---

**Q: How do I link my Telegram account for notifications?**
A: Go to your **Profile** page, scroll to **Notification Settings**, and click **Link Telegram Account**. You will receive a code or be directed to the Telegram bot. Follow the instructions to complete the link.

---

**Q: I cannot see the Finance / Monitoring / Reports menu. Why?**
A: These modules may be disabled by your administrator (Feature Management), or your role may not have permission to access them. Contact your system administrator.

---

**Q: How do I export a list of proposals?**
A: Go to **All Proposals** or **My Proposals** and use the **Export** button to download the filtered list as a CSV file.

---

**Q: Who do I contact for technical support?**
A: Contact your institution's RTT Platform administrator or IT support team. Use the **Feedback** link at the bottom of the page (if enabled) to submit a support request directly through the system.

---

*End of User Manual*

---

**Document Information**
- System: RTT — Research & Technology Transfer Platform
- Version: 1.0
- Date: June 2026
- For technical issues, contact your system administrator.
