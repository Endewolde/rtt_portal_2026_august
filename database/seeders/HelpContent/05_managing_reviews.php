<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Managing reviews';

return [
    [
        'slug' => 'assign-reviewers', 'category' => $c, 'roles' => R::COLLEGE,
        'title' => 'Assigning blind reviewers',
        'summary' => 'Pick reviewers for validated proposals, using suggestions and conflict warnings.',
        'keywords' => 'assign reviewers reviewer selection blind review assign add reviewer suggestions workload replace reassign',
        'questions' => [
            'How do I assign reviewers?', 'How do I choose good reviewers?', 'What does Possible conflict mean?',
            'How do I replace a reviewer?', 'How do I add another reviewer?', 'What is the workload limit?',
            'How many reviewers should a proposal have?', 'Can I assign an external reviewer?', 'Why can\'t I assign this person?',
            'How are reviewer suggestions ranked?',
        ],
        'body' => "Validated proposals wait in **Blind Review** for you to assign reviewers.\n\n"
            ."## Step by step\n"
            ."1. Open **Blind Review** (or **Assign Reviewers**) and choose a proposal.\n"
            ."2. Open **Suggested reviewers** — ranked by matching expertise, on-time record and current workload — or search by name or expertise.\n"
            ."3. Select reviewers, set a **due date** and assign.\n"
            ."4. The proposal moves to blind review and reviewers are notified.\n\n"
            ."## Warnings you may see\n"
            ."- **Possible conflict:** the reviewer is in the proposal's department or worked with the team recently. Prefer someone else; if you must, click **Assign Anyway** — your confirmation is recorded.\n"
            ."- **Workload limit:** the reviewer already has **5 active reviews**. Assigning more needs confirmation.\n"
            ."- **Team member:** the PI and co-investigators can never review their own proposal.\n\n"
            ."## Changing reviewers later\n"
            ."On **Blind Review**, use **Reassign** to swap a reviewer or **Add Reviewer** to add one.\n\n"
            ."## Good to know\n"
            .'External reviewers are marked **External** in the list.',
        'page_paths' => ['/admin/blind-review', '/admin/assign-reviewers'], 'action_label' => 'Open blind review', 'action_url' => '/admin/blind-review',
    ],
    [
        'slug' => 'review-deadlines-admin', 'category' => $c, 'roles' => R::COLLEGE,
        'title' => 'Chasing late reviews',
        'summary' => 'See overdue reviews, send reminders, extend due dates or reassign.',
        'keywords' => 'overdue late reviews remind reminder extend due date more time chase reviewers',
        'questions' => [
            'How do I see overdue reviews?', 'How do I remind a reviewer?', 'How do I extend a review due date?', 'How do I give a reviewer more time?',
            'Can I remind all late reviewers at once?', 'Are reminders sent automatically?', 'What should I do with a reviewer who never responds?',
        ],
        'body' => "Open **Review Deadlines** to see reviews due soon and overdue, with each reviewer's reminder history.\n\n"
            ."## What you can do\n"
            ."- **Remind** one reviewer, or select several and remind them at once.\n"
            ."- **Extend** the due date if they've asked for more time.\n"
            ."- **Reassign** the review from Blind Review if they can't do it.\n\n"
            ."## Good to know\n"
            ."- Reminders also go out **automatically** — 7, 3 and 1 days before, on the due day, and every 3 days once overdue.\n"
            ."- A manual reminder can't be sent again within a few minutes.",
        'page_paths' => ['/admin/review-deadlines'], 'action_label' => 'Open review deadlines', 'action_url' => '/admin/review-deadlines',
    ],
    [
        'slug' => 'coi-reassignment', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Handling declared conflicts of interest',
        'summary' => 'Reviewers who declared a conflict are listed for reassignment.',
        'keywords' => 'coi conflicts declared reassign reviewer conflict of interest dashboard',
        'questions' => [
            'A reviewer declared a conflict, what do I do?', 'Where are the conflict of interest reports?',
            'How do I reassign a conflicted reviewer?', 'Is the conflict recorded?', 'Does the proposal wait while I reassign?',
        ],
        'body' => "When a reviewer declares a conflict of interest, the assignment appears in **COI Conflicts**.\n\n"
            ."## Step by step\n"
            ."1. Open **COI Conflicts** and read the reviewer's reason.\n"
            ."2. Click **Reassign Reviewer** and choose someone without a conflict.\n"
            .'3. The new reviewer is notified and the conflict is marked resolved.',
        'page_paths' => ['/admin/coi-conflicts'], 'action_label' => 'Open COI conflicts', 'action_url' => '/admin/coi-conflicts',
    ],
    [
        'slug' => 'reviewer-disagreement', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'When blind reviewers strongly disagree',
        'summary' => 'Proposals with very different reviewer scores are held for an officer to decide.',
        'keywords' => 'disagreement disagree scores differ spread inconsistent reviewers held moderation',
        'questions' => [
            'Why is this proposal held after blind review?', 'What does reviewer disagreement mean?', 'How do I resolve a disagreement?',
            'How big a difference counts as disagreement?', 'Should I add another reviewer?',
        ],
        'body' => "Normally the system passes or rejects a proposal automatically once all blind reviews are in. If the reviewers **disagree strongly**, it's **held** instead.\n\n"
            ."## When it's held\n"
            ."- reviewers' scores differ by more than the set share of the maximum (by default **25%**), or\n"
            ."- some reviewers score it above the pass mark and others below.\n\n"
            ."## What to do\n"
            ."1. Open the proposal and read every review and comment.\n"
            ."2. Decide: **pass**, **fail**, or **add another reviewer** for a further opinion.\n"
            ."3. Add a note explaining your decision — it's recorded.",
        'page_paths' => ['/admin/blind-review'],
    ],
    [
        'slug' => 'schedule-defence', 'category' => $c, 'roles' => R::COLLEGE,
        'title' => 'Scheduling an open defence',
        'summary' => 'Once all your college\'s blind reviews are finished, schedule the defence and panel.',
        'keywords' => 'schedule defence defense panel venue date open defence add reviewer panel members change date',
        'questions' => [
            'How do I schedule a defence?', 'Why can\'t I schedule open defence yet?', 'How do I choose panel members?',
            'How do I change the defence date?', 'How do I add a panel member?', 'Can the defence be online?',
            'When are panel scores due?', 'What does No panel members mean?', 'Can I remove every panel member?',
        ],
        'body' => "Proposals that pass blind review wait in **Open Defence** for scheduling.\n\n"
            ."## Before you can schedule\n"
            ."All of **your college's proposals must have finished blind review**. The page tells you which are still pending.\n\n"
            ."## Step by step\n"
            ."1. Open **Open Defence** and click **Schedule Defence** on the proposal.\n"
            ."2. Set the **date, time** and **venue** (or an online link).\n"
            ."3. Choose the **panel members**.\n"
            ."4. Save — the team and panel are notified.\n\n"
            ."## Changing it later\n"
            ."Use **Schedule Defence** again to change the date or venue, or **Add Reviewer** to change the panel.\n\n"
            ."## Good to know\n"
            ."- **No panel members** means nobody is on the panel yet — use **Add Reviewer**. The last panel member can't be removed until someone else is added.\n"
            .'- Scores are due by the **end of the day after** the defence. When all are in, the result is calculated automatically.',
        'page_paths' => ['/admin/open-defence'], 'action_label' => 'Open open defence', 'action_url' => '/admin/open-defence',
    ],
    [
        'slug' => 'defence-deadline-extension', 'category' => $c, 'roles' => [...R::COLLEGE, ...R::DIRECTORS],
        'title' => 'Extending a defence scoring deadline',
        'summary' => 'Request it on the defence card; a director or the central office approves.',
        'keywords' => 'extension late score deadline passed defence extend panel member late',
        'questions' => [
            'A panel member missed the scoring deadline', 'How do I extend the defence deadline?', 'Who approves defence extensions?',
            'How long can I extend for?', 'Is there a limit on extensions?',
        ],
        'body' => "If a panel member couldn't score in time for a good reason, you can give them more time.\n\n"
            ."## Step by step\n"
            ."1. On **Open Defence**, find the proposal's defence card.\n"
            ."2. Click **Request extension**, choose the new deadline and give the reason.\n"
            ."3. The **category director** or the **central office** approves it under **Defence Extensions**.\n"
            ."4. Once approved, the panel member can submit until the new deadline.\n\n"
            ."## Good to know\n"
            .'The defence result waits until every panel member has scored, so act quickly.',
        'page_paths' => ['/admin/open-defence', '/admin/defence-extensions'],
    ],
    [
        'slug' => 'defence-record', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Printing the defence record',
        'summary' => 'Download a one-page PDF of the session, panel scores and outcome for signatures.',
        'keywords' => 'defence record minutes pdf print sign file report session',
        'questions' => [
            'How do I get the defence minutes?', 'Is there a defence report to sign?', 'Where is the defence record PDF?',
            'What is in the defence record?', 'Can I print the defence scores?', 'Who signs the defence record?',
        ],
        'body' => "The **defence record** is the official one-page record of an open defence.\n\n"
            ."## What it contains\n"
            ."- session date, time and venue;\n"
            ."- the proposal, PI and team;\n"
            ."- each panel member's score, comments and recommendation;\n"
            ."- the blind, defence and combined results and the outcome;\n"
            ."- signature lines for filing.\n\n"
            ."## How to get it\n"
            ."Click **Defence record** on the Open Defence card, or on the proposal's **Reviews** tab.",
        'page_paths' => ['/admin/open-defence'],
    ],
    [
        'slug' => 'college-progress', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Following your college\'s progress',
        'summary' => 'See how many proposals are at each stage, per college.',
        'keywords' => 'college phase completion progress pipeline stage counts dashboard',
        'questions' => [
            'How many of my college\'s proposals are reviewed?', 'Which proposals are still waiting?', 'Where is the college dashboard?',
            'How do I see all proposals by status?', 'Where is the proposal pipeline?', 'Which proposals are waiting for reviewer assignment?',
        ],
        'body' => "Three pages show progress:\n\n"
            ."- **College Phase Completion** — for each college, how many proposals are waiting for assignment, in blind review, in open defence, reviewed or rejected.\n"
            ."- **Proposal Pipeline** — every proposal by status, with search.\n"
            ."- **College Research Dashboard** — your college's proposals by department, category and outcome.",
        'page_paths' => ['/admin/college-phase-completion', '/admin/proposal-pipeline', '/reports/college-dashboard'],
    ],
    [
        'slug' => 'report-mistaken-approval', 'category' => $c, 'roles' => ['college_officer'],
        'title' => 'Reporting a mistaken approval',
        'summary' => 'If a proposal was approved by mistake, report it with the issue type for review.',
        'keywords' => 'mistake wrong approval report error approved by mistake undo cancel report',
        'questions' => [
            'A proposal was approved by mistake', 'How do I report a wrong approval?', 'Can I cancel my report?',
            'What happens to the proposal while it\'s reported?', 'Who reviews a mistaken approval report?',
        ],
        'body' => "If you believe a proposal was approved in error, report it so a director can review.\n\n"
            ."## Step by step\n"
            ."1. Open the proposal and click **Report mistaken approval**.\n"
            ."2. Choose the **issue type** and describe it.\n"
            ."3. The proposal is **held** while the director reviews.\n\n"
            ."## Outcomes\n"
            ."- **Approval stands** — the proposal continues.\n"
            ."- **Revoked** — the proposal is rejected, with both officers' notes recorded.\n\n"
            ."You can **cancel** your report while it's pending.",
    ],
];
