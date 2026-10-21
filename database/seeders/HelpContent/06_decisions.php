<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Decisions';

return [
    [
        'slug' => 'manage-calls', 'category' => $c, 'roles' => R::CENTRAL,
        'title' => 'Creating and managing proposal calls',
        'summary' => 'Publish a call with its dates, category, limits, budget and guidelines.',
        'keywords' => 'call create new call publish close reopen guidelines deadline proposal calls submissions',
        'questions' => [
            'How do I create a new call?', 'How do I close a call?', 'How do I reopen a call?', 'How do I see submissions for a call?',
            'How do I upload call guidelines?', 'How do I limit proposals per PI?', 'When does a call close?', 'How do I edit a call?',
        ],
        'body' => "Calls are where funding starts. Open **Proposal Calls** to manage them.\n\n"
            ."## Creating a call\n"
            ."1. Click to create a new call.\n"
            ."2. Enter the **title**, **academic year**, **category**, **start and end date and time**.\n"
            ."3. Set the **maximum proposals per PI** (optional) and the **total funding budget**.\n"
            ."4. Add the description and eligibility, and upload the **guidelines** document.\n"
            ."5. Save — open calls appear on the public site and in New Proposal.\n\n"
            ."## While it's open\n"
            ."- Click **Submissions** on a call to see what's been submitted (drafts aren't counted).\n"
            ."- Researchers with drafts are reminded **7, 3 and 1 days** before the deadline.\n\n"
            ."## Closing and reopening\n"
            .'Calls close **automatically** at their end date and time. Edit the dates and reopen a call if needed.',
        'page_paths' => ['/proposal-calls'], 'action_label' => 'Open proposal calls', 'action_url' => '/proposal-calls',
    ],
    [
        'slug' => 'validation', 'category' => $c, 'roles' => R::DIRECTORS,
        'title' => 'Validating submitted proposals',
        'summary' => 'Check completeness, eligibility and the anonymity check, then approve, return or reject.',
        'keywords' => 'validate validation queue approve return correction submitted eligibility anonymity bulk',
        'questions' => [
            'How do I validate proposals?', 'How do I return a proposal for corrections?', 'What does the anonymity flag mean?',
            'Can I approve several proposals at once?', 'How do I see what changed in a resubmission?', 'What should I check during validation?',
            'How do I reject a proposal at validation?', 'How long should validation take?',
        ],
        'body' => "Every submitted proposal comes to the **Validation Queue** first.\n\n"
            ."## What to check\n"
            ."- it's **complete** — documents, budget, team;\n"
            ."- it **fits the call** — category and eligibility;\n"
            ."- the **anonymity check** — a badge shows if names, emails or phones of the team were found in the reviewer documents. Open the proposal to see exactly what.\n\n"
            ."## Your decision\n"
            ."- **Approve** — it goes to blind review. You can approve several at once.\n"
            ."- **Return for correction** — back to the PI with your note. When they resubmit you'll see exactly what changed.\n"
            ."- **Reject** — choose a reason from the list and add details.\n\n"
            ."## Good to know\n"
            .'The target is about **one week** in validation; Turnaround shows anything waiting longer.',
        'page_paths' => ['/admin/validation-queue'], 'action_label' => 'Open validation queue', 'action_url' => '/admin/validation-queue',
    ],
    [
        'slug' => 'central-evaluation', 'category' => $c, 'roles' => [...R::DIRECTORS, ...R::RTT_MANAGER],
        'title' => 'Making funding decisions in Central Evaluation',
        'summary' => 'Use the merit list and call budget, read the reviews, then approve or reject.',
        'keywords' => 'central evaluation funding decision approve fund merit list ranking budget award',
        'questions' => [
            'How do I approve a proposal for funding?', 'What is the merit list?', 'How much budget is left in the call?',
            'Can I award more than the call budget?', 'How do I reject at central evaluation?', 'Can I award less than requested?',
            'What is the AI summary of the reviews?', 'How do I see the PI\'s other funding?',
        ],
        'body' => "Proposals that pass open defence reach **Central Evaluation** for the final funding decision.\n\n"
            ."## The merit list\n"
            ."Switch to **Merit List & Budget** to see, per call, proposals ranked by **combined score** with a running total of what they request, and a line where the call's **remaining budget runs out**.\n\n"
            ."## For each proposal\n"
            ."Review the scores, the budget, the PI's **existing funding** (to avoid double funding) and the **AI summary of the reviews** if available.\n\n"
            ."## Deciding\n"
            ."- **Approve for Funding** — enter the **award amount** (it can be less than requested) and remarks. The dialog shows the call budget left before and after.\n"
            ."- **Reject** — choose a reason.\n\n"
            ."## Good to know\n"
            ."Going **over the call's budget** needs an explicit confirmation. Approving creates the **award** and grant reference, and the team is notified.",
        'page_paths' => ['/admin/central-evaluation'], 'action_label' => 'Open central evaluation', 'action_url' => '/admin/central-evaluation',
    ],
    [
        'slug' => 'award-and-letters', 'category' => $c, 'roles' => [...R::CENTRAL, ...R::RTT_MANAGER],
        'title' => 'Awards, grant references and grant letters',
        'summary' => 'Approving for funding creates the award; generate the grant letter from Grant Letters.',
        'keywords' => 'award grant letter reference number funding letter generate print template all funded proposals list funded',
        'questions' => [
            'How do I generate a grant letter?', 'Where do I find the grant reference number?', 'How do I see all funded proposals?',
            'Can I change the award amount?', 'Can funding be revoked?',
        ],
        'body' => "Approving a proposal for funding creates its **award** with a **grant reference**.\n\n"
            ."## Grant letters\n"
            ."Open **Grant Letters**, choose the funded proposal and prepare the official letter from the template, including the letter number. Use a computer for this page.\n\n"
            ."## Funded proposals\n"
            ."**Proposal Funding** and **Awarded** list all funded proposals with their award details.\n\n"
            ."## Good to know\n"
            .'Funding can be revoked from the funding page if needed; the team is notified.',
        'page_paths' => ['/admin/grant-letters', '/admin/funding', '/admin/awarded'], 'action_label' => 'Open grant letters', 'action_url' => '/admin/grant-letters',
    ],
    [
        'slug' => 'contracts-admin', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Approving research contracts',
        'summary' => 'Review submitted contracts and approve or return them.',
        'keywords' => 'contracts approve reject review contract status submitted',
        'questions' => ['How do I approve a contract?', 'Which contracts are pending?', 'How do I reject a contract?', 'Which funded projects have no contract yet?', 'Is the PI notified when the contract is approved?', 'Can funds be requested before the contract is approved?'],
        'body' => "Open **Contracts** to see every funded proposal's contract status: **Not Submitted**, **Pending Review**, **Approved** or **Rejected**.\n\n"
            ."## Step by step\n"
            ."1. Open a pending contract and check it.\n"
            ."2. **Approve** it — funds can then be requested — or **reject** it with a clear reason.\n\n"
            ."## Good to know\n"
            ."Chase **Not Submitted** contracts: funding can't start without one.",
        'page_paths' => ['/admin/contracts'], 'action_label' => 'Open contracts', 'action_url' => '/admin/contracts',
    ],
    [
        'slug' => 'ethical-clearance-admin', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Verifying ethical clearance',
        'summary' => 'Approve or return uploaded ethics certificates and watch for expiries.',
        'keywords' => 'ethical clearance verify approve reject certificate expiry ethics',
        'questions' => ['How do I verify an ethics certificate?', 'Which projects need ethical clearance?', 'How do I see expired clearances?', 'Are PIs reminded before expiry?', 'What happens when ethical clearance expires?', 'How do I reject an ethics certificate?'],
        'body' => "Open **Ethical Clearance** to see projects that need it, grouped as **Not Submitted**, **Awaiting Review**, **Approved** and **Rejected / Expired**.\n\n"
            ."## Step by step\n"
            ."1. Open an uploaded certificate and check the reference number and expiry date.\n"
            ."2. **Approve** it, or **Reject & Return** with a reason.\n\n"
            ."## Good to know\n"
            .'PIs are reminded **14, 7 and 1 days** before expiry.',
        'page_paths' => ['/admin/ethical-clearance'], 'action_label' => 'Open ethical clearance', 'action_url' => '/admin/ethical-clearance',
    ],
    [
        'slug' => 'extension-requests-admin', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Handling extension and budget change requests',
        'summary' => 'Approve or decline deadline extensions, no-cost extensions and budget revisions.',
        'keywords' => 'deadline extensions no-cost extension budget revision approve decline requests',
        'questions' => [
            'How do I approve a deadline extension?', 'How do I approve a no-cost extension?', 'How do I approve a budget revision?',
            'Where are all pending requests?', 'Is the PI told about my decision?',
        ],
        'body' => "Researchers can ask for more time or budget changes. Each has its own page:\n\n"
            ."- **Deadline Extensions** — more time to submit a draft proposal.\n"
            ."- **No-Cost Extensions** — more time to finish a funded project.\n"
            ."- **Budget Revisions** — moving money between budget lines.\n"
            ."- **Defence Extensions** — more time for panel members to score.\n\n"
            ."## Step by step\n"
            ."Open the request, read the reason and any attachments, then **approve** or **decline** with a note. The requester is notified.\n\n"
            ."## Good to know\n"
            .'The sidebar badges show how many requests are waiting.',
        'page_paths' => ['/admin/deadline-extensions', '/admin/no-cost-extensions', '/admin/budget-revisions', '/admin/defence-extensions'],
    ],
    [
        'slug' => 'appeals-admin', 'category' => $c, 'roles' => R::DIRECTORS,
        'title' => 'Resolving appeals',
        'summary' => 'Review reconsideration requests and record your decision for the applicant.',
        'keywords' => 'appeals reconsideration request resolve decision applicant reopen',
        'questions' => ['How do I handle an appeal?', 'Can a rejected proposal be reopened?', 'Where are reconsideration requests?', 'Who decides appeals?', 'Is the researcher told the appeal outcome?', 'What should I check before accepting an appeal?'],
        'body' => "Open **Appeals** to see reconsideration requests from researchers.\n\n"
            ."## Step by step\n"
            ."1. Read the applicant's reasons and the proposal's history and reviews.\n"
            ."2. Click **Resolve Appeal**, record your decision and **explain it to the applicant**.\n"
            .'3. Where justified, a rejected proposal can be **reopened** at the right stage.',
        'page_paths' => ['/admin/appeals'], 'action_label' => 'Open appeals', 'action_url' => '/admin/appeals',
    ],
    [
        'slug' => 'approval-reports-admin', 'category' => $c, 'roles' => R::DIRECTORS,
        'title' => 'Reviewing mistaken-approval reports',
        'summary' => 'Decide whether a reported approval stands, is revoked, or the project is already ongoing.',
        'keywords' => 'approval reports mistaken approval resolve stands revoked already ongoing running move to ongoing funded',
        'questions' => ['How do I resolve an approval report?', 'What happens if the approval is revoked?', 'What happens if the approval stands?', 'Where are mistaken approval reports?', 'Is the proposal paused while a report is open?', 'How do I move an already running project to ongoing?'],
        'body' => "College officers can report a proposal they believe was approved by mistake. Open **Approval Reports**.\n\n"
            ."## Deciding\n"
            ."- **Approval stands** — the proposal is restored and continues.\n"
            ."- **Revoked** — the proposal is rejected, with both officers' notes recorded.\n"
            ."- **Already ongoing — move** — the project is already running: enter the amount awarded (and the grant reference and original approval date if known). It becomes Funded and appears under **Ongoing Proposals**; pending reviews are cancelled and the team is notified.",
        'page_paths' => ['/admin/approval-reports'],
    ],
    [
        'slug' => 'call-budget', 'category' => $c, 'roles' => [...R::CENTRAL, ...R::RTT_MANAGER],
        'title' => 'Setting a call\'s funding budget',
        'summary' => 'Enter the total budget on the call so the merit list can show the cut-off.',
        'keywords' => 'call budget total funding envelope ceiling proposal call create edit',
        'questions' => ['How do I set the call budget?', 'Why doesn\'t the merit list show a budget line?', 'How is the remaining budget calculated?', 'What happens if approving goes over budget?', 'Where can I see how much budget is left for a call?'],
        'body' => "Open **Proposal Calls**, edit the call and fill in **Total Funding Budget (ETB)**.\n\n"
            ."Central Evaluation then shows how much is **committed** (awards already made) and **left**, and the merit list marks where the money runs out.\n\n"
            ."## Good to know\n"
            ."Committed money counts awards on funded, ongoing and completed projects from that call.\n\n"
            ."If an award is more than the money left, approval stops and shows how much it's over by. You can still approve it by **confirming** you accept going over budget.",
        'page_paths' => ['/proposal-calls'], 'action_label' => 'Open proposal calls', 'action_url' => '/proposal-calls',
    ],
    [
        'slug' => 'release-certificates', 'category' => $c, 'roles' => R::CENTRAL,
        'title' => 'Releasing reviewer certificates',
        'summary' => 'Release a year\'s certificates once its reviews are done; revoke if needed.',
        'keywords' => 'release certificates reviewer certificates revoke minimum reviews year',
        'questions' => [
            'How do I release reviewer certificates?', 'How do I revoke a certificate?', 'Who qualifies for a certificate?',
            'Can I release certificates twice?', 'How do I change the minimum number of reviews?',
        ],
        'body' => "Open **Reviewer Certificates** and choose the academic year.\n\n"
            ."## Releasing\n"
            ."The page lists every reviewer with their reviews and whether they qualify (by default **3 reviews**, set in Settings). Click **Release Certificates** when the year's reviews are finished. Qualifying reviewers get a certificate, with counts frozen, and a notification. A year is released **once**.\n\n"
            ."## Revoking\n"
            .'Use **Revoke** with a reason (sent to the reviewer). The public check then shows the certificate as revoked. **Reinstate** reverses it.',
        'page_paths' => ['/admin/review-certificates'], 'action_label' => 'Open reviewer certificates', 'action_url' => '/admin/review-certificates',
    ],
    [
        'slug' => 'college-rtt-manager', 'category' => $c, 'roles' => [...R::RTT_MANAGER, ...R::ADMIN, ...R::CENTRAL],
        'title' => 'The College RTT Manager role',
        'summary' => 'Central evaluation, funding, progress reports and reporting for one college\'s proposals, across every category.',
        'keywords' => 'college rtt manager role college research manager my college proposals funding decision central evaluation scope',
        'questions' => [
            'What can a College RTT Manager do?', 'Which proposals can I see as RTT manager?', 'Can I approve funding for my college?',
            'Why can\'t I see another college\'s proposals?', 'How do I make someone a College RTT Manager?', 'Can I revoke funding?',
            'Do I validate proposals or assign reviewers?', 'Will I be notified when a proposal reaches central evaluation?',
        ],
        'body' => "The **College RTT Manager** looks after one college's research proposals in **every category** — research, community engagement and technology transfer.\n\n"
            ."## What you can do\n"
            ."- **All Proposals** — see every proposal from your college.\n"
            ."- **Central Evaluation** — approve proposals for funding with the awarded amount, or reject them, for your college.\n"
            ."- **Proposal Funding** — adjust award amounts and, if needed, **revoke funding** with a reason.\n"
            ."- **Progress Reports** — review your college's reports and chase late ones.\n"
            ."- **Reports**, **Report Builder** and **College Dashboard** — always limited to your college.\n"
            ."- **Proposal Pipeline** — your college's proposals at every stage.\n\n"
            ."## What stays with others\n"
            ."Validating submissions, assigning reviewers and running open defences stay with the **college officer** and the **category directors**. Proposals from other colleges are never shown to you.\n\n"
            ."## Notifications\n"
            ."You're notified when one of your college's proposals passes open defence and is **ready for central evaluation**, and about progress reports to review.\n\n"
            ."## Setting up the role (administrators)\n"
            ."Give the user the **College RTT Manager** role on **Users**. The user must belong to a **college** first — the role can't be given without one.",
        'page_paths' => ['/admin/central-evaluation', '/admin/funding'], 'action_label' => 'Open central evaluation', 'action_url' => '/admin/central-evaluation',
    ],
];
