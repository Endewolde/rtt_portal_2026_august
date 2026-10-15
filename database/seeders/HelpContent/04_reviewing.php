<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Reviewing';

return [
    [
        'slug' => 'reviewer-agreement', 'category' => $c, 'roles' => R::REVIEWER,
        'title' => 'The reviewer confidentiality agreement',
        'summary' => 'Accept it once each academic year before you can open proposals to review.',
        'keywords' => 'agreement confidentiality accept cannot open review blocked nda why cannot open my review',
        'questions' => [
            'Why can\'t I open my review?', 'What is the confidentiality agreement?', 'Do I have to accept every year?',
            'Where do I accept the agreement?', 'What am I agreeing to as a reviewer?', 'What if I don\'t accept the agreement?',
        ],
        'body' => "Before opening any proposal to review, you accept a short **confidentiality agreement** — once per academic year.\n\n"
            ."## What you agree to\n"
            ."- keep proposals, documents, scores and discussions **confidential**;\n"
            ."- not use the ideas, methods or data for your own work;\n"
            ."- not try to identify the authors of blind-review proposals or contact applicants;\n"
            ."- **declare any conflict of interest** and withdraw from that review;\n"
            ."- review fairly against the published criteria and on time;\n"
            ."- delete copies of documents when your review is complete.\n\n"
            ."## How to accept\n"
            ."Open **My Reviews** and click **Read & accept** in the notice at the top, tick the box and click **I Agree**. If you open a review first, the agreement appears there.\n\n"
            ."## Good to know\n"
            ."Without accepting, you can't open or score proposals. The date and wording you accepted are recorded.",
        'page_paths' => ['/reviews'], 'action_label' => 'Open my reviews', 'action_url' => '/reviews',
    ],
    [
        'slug' => 'scoring-blind-review', 'category' => $c, 'roles' => R::REVIEWER,
        'title' => 'Scoring a blind review',
        'summary' => 'Open the assignment from My Reviews, read the documents, score each criterion and submit.',
        'keywords' => 'score review blind review evaluate marks criteria submit review how to review proposal documents where documents reviewer',
        'questions' => [
            'How do I review a proposal?', 'How do I score a proposal?', 'Where are the proposal documents?',
            'Can I change my score after submitting?', 'Will the applicants see my comments?', 'Will the applicants know who I am?',
            'How long should my comments be?', 'Can I save my scores and finish later?', 'What happens after I submit?',
        ],
        'body' => "In blind review you score a proposal **without knowing who wrote it**.\n\n"
            ."## Step by step\n"
            ."1. Go to **My Reviews** and open the assignment.\n"
            ."2. Read the **proposal document** and **budget spreadsheet** in the **Documents** tab.\n"
            ."3. On the **Score** tab, score every criterion. Required criteria are marked.\n"
            ."4. Add **comments** that justify your scores and help the team improve.\n"
            ."5. Submit before the due date.\n\n"
            ."## Good to know\n"
            ."- Submitted scores **can't be changed** — check before submitting.\n"
            ."- The research team sees your comments but **not your name**.\n"
            ."- When all reviewers have submitted, the average decides whether the proposal goes to open defence.\n"
            .'- If you know who wrote it or have any relationship with them, **declare a conflict** instead of scoring.',
        'page_paths' => ['/reviews'], 'action_label' => 'Open my reviews', 'action_url' => '/reviews',
    ],
    [
        'slug' => 'review-due-dates', 'category' => $c, 'roles' => R::REVIEWER,
        'title' => 'Review due dates and reminders',
        'summary' => 'Each review has a due date; you\'ll be reminded before and after it.',
        'keywords' => 'due date deadline late overdue reminder review time how long decline workload',
        'questions' => [
            'When is my review due?', 'What if I can\'t finish my review on time?', 'Why did I get a reminder?',
            'Can I decline a review?', 'How many reviews can I be given?', 'How long do I have to review?',
        ],
        'body' => "Each assignment in **My Reviews** shows its **due date** — usually about two weeks after assignment.\n\n"
            ."## Reminders\n"
            ."You're reminded **7, 3 and 1 days** before the due date and on the day. If it becomes overdue, a reminder is sent **every 3 days** until it's done.\n\n"
            ."## If you can't make it\n"
            ."Contact the officer who assigned it **before** the due date — they can extend it or give the review to someone else.\n\n"
            ."## Good to know\n"
            ."- Reviewers normally have at most **5 active reviews** at a time.\n"
            .'- On-time reviews count toward your yearly **certificate of review service**.',
        'page_paths' => ['/reviews'],
    ],
    [
        'slug' => 'conflict-of-interest', 'category' => $c, 'roles' => R::REVIEWER,
        'title' => 'Declaring a conflict of interest',
        'summary' => 'If you know or work with the applicants, declare it — you won\'t be able to score.',
        'keywords' => 'conflict of interest coi relative family brother sister spouse friend colleague know author declare withdraw',
        'questions' => [
            'What if I know the applicant?', 'How do I declare a conflict of interest?', 'What counts as a conflict of interest?',
            'What happens after I declare a conflict?', 'Will declaring a conflict count against me?', 'I already started scoring, can I still declare?',
        ],
        'body' => "A conflict of interest is any relationship that could affect — or look like it affects — your judgement.\n\n"
            ."## Common conflicts\n"
            ."- a family member or close friend on the team;\n"
            ."- a recent co-author or close collaborator;\n"
            ."- your supervisor or student;\n"
            ."- a financial interest in the outcome;\n"
            ."- recognising the work as a direct competitor's.\n\n"
            ."## Step by step\n"
            ."1. Open the assignment in **My Reviews**.\n"
            ."2. **Declare a conflict** and briefly explain it.\n"
            ."3. You can no longer score it; officers reassign the review.\n\n"
            ."## Good to know\n"
            ."When in doubt, declare it. It's never held against you.",
        'page_paths' => ['/reviews'],
    ],
    [
        'slug' => 'scoring-open-defence', 'category' => $c, 'roles' => R::REVIEWER,
        'title' => 'Scoring an open defence',
        'summary' => 'Score during the session or by the end of the next day; late scores need an extension.',
        'keywords' => 'defence defense panel score deadline late presentation open defence scoring closed',
        'questions' => [
            'How do I score a defence?', 'When can I score the open defence?', 'The defence scoring has closed',
            'Can I score after the defence day?', 'Can I score on my phone in the room?', 'Why can\'t I score yet?',
        ],
        'body' => "As a panel member you score the team's presentation on the defence criteria.\n\n"
            ."## Timing\n"
            ."- Scoring **opens on the day** of the defence — you can't score before it.\n"
            ."- Score in the room during the presentation, or **by the end of the following day** (23:59).\n"
            ."- After that, submissions **close**.\n\n"
            ."## Step by step\n"
            ."1. Open the defence assignment in **My Reviews**.\n"
            ."2. Score each criterion and add comments.\n"
            ."3. Submit.\n\n"
            ."## If you missed the deadline\n"
            ."Contact your **college officer**, who can request an extension; once approved you can submit.\n\n"
            ."## Good to know\n"
            .'Installing the platform on your phone makes scoring in the room easier.',
        'page_paths' => ['/reviews'],
    ],
    [
        'slug' => 'reviewer-certificates', 'category' => $c, 'roles' => R::REVIEWER,
        'title' => 'Getting your certificate of review service',
        'summary' => 'Released each year by the central office for reviewers who meet the minimum.',
        'keywords' => 'certificate appreciation reviewer service download verify qr minimum reviews',
        'questions' => [
            'How do I get my reviewer certificate?', 'Why can\'t I download my certificate?', 'How many reviews do I need for a certificate?',
            'How can someone verify my certificate?', 'When are certificates released?', 'My certificate was revoked, why?',
            'Do late reviews count for the certificate?',
        ],
        'body' => "Each academic year, reviewers who complete enough reviews receive a **certificate of review service**.\n\n"
            ."## How it works\n"
            ."1. During the year, **My Reviews** shows whether you qualify (by default **3 completed reviews**).\n"
            ."2. Once the year's reviews are finished, the central office **releases** the certificates.\n"
            ."3. You're notified and can **download** the PDF from My Reviews.\n\n"
            ."## Good to know\n"
            ."- The office may count only **on-time** reviews — My Reviews tells you if so.\n"
            ."- Each certificate has a number and **QR code**; anyone can confirm it on the public **Verify Certificate** page.\n"
            ."- A revoked certificate shows the reason; contact the office if you think it's a mistake.",
        'page_paths' => ['/reviews'], 'action_label' => 'Open my reviews', 'action_url' => '/reviews',
    ],
    [
        'slug' => 'abstract-reviewing', 'category' => $c, 'roles' => R::REVIEWER,
        'title' => 'Reviewing conference abstracts',
        'summary' => 'Abstracts assigned to you appear in My Reviews alongside proposal reviews.',
        'keywords' => 'abstract review conference abstract assigned score accept reject',
        'questions' => [
            'How do I review a conference abstract?', 'Where are my abstract reviews?', 'Who assigned me an abstract to review?', 'I can\'t review this abstract, what do I do?', 'Do abstract reviews count toward my certificate?',
        ],
        'body' => "Conference organisers can ask you to review submitted **abstracts**.\n\n"
            ."## Step by step\n"
            ."1. Open **My Reviews** and find the abstract.\n"
            ."2. Read it and give your recommendation and comments.\n"
            ."3. Submit. The organisers decide acceptance using the reviews.\n\n"
            ."## Good to know\n"
            ."- If you can't review an abstract, or you know the authors, tell the organisers so they can reassign it.\n"
            ."- Abstract reviews don't count toward the yearly **certificate of review service**, which counts proposal reviews.",
        'page_paths' => ['/reviews'],
    ],
];
