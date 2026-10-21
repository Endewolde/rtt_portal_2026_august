<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Reports';

return [
    [
        'slug' => 'reports-analytics', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'The analytics dashboard',
        'summary' => 'Submissions, pass rate, funnel, money and review quality, filtered by year, category and college.',
        'keywords' => 'analytics statistics dashboard pass rate funnel charts numbers trends success rate',
        'questions' => [
            'Where can I see statistics?', 'What is the pass rate?', 'How many proposals were funded this year?', 'How do I filter by college?',
            'How is the pass rate calculated?', 'How much money has been awarded?', 'Where do proposals drop out?', 'Can I compare years?',
            'How long does each stage take on average?',
        ],
        'body' => "Open **Analytics Dashboard** for the big picture.\n\n"
            ."## What it shows\n"
            ."- **Submissions**, **funded** and **not selected** counts.\n"
            ."- **Pass rate** — funded ÷ decided. Proposals still in review aren't counted, so the rate isn't dragged down by work in progress.\n"
            ."- The **funnel** — how many proposals reach each stage, so you can see where they drop out.\n"
            ."- **Money** awarded and disbursed.\n"
            ."- **Time per stage** and **review quality**.\n\n"
            ."## Filters\n"
            ."Filter by **academic year** (or all years), **category** and **college**. All figures update together.\n\n"
            ."## Good to know\n"
            .'For a printable summary use the **Annual RTT Report**; for your own breakdowns use the **Report Builder**.',
        'page_paths' => ['/admin/analytics'], 'action_label' => 'Open analytics', 'action_url' => '/admin/analytics',
    ],
    [
        'slug' => 'turnaround', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Finding delays with Turnaround',
        'summary' => 'See how long proposals wait at each stage and remind whoever has to act.',
        'keywords' => 'turnaround delays stuck slow waiting stage remind nudge time bottleneck target',
        'questions' => [
            'Which proposals are stuck?', 'How long does each stage take?', 'How do I remind someone a proposal is waiting?',
            'Where is the bottleneck?', 'Which stage is slowest?', 'Who is holding up this proposal?',
        ],
        'body' => "Open **Turnaround** to find where work is waiting.\n\n"
            ."## What it shows\n"
            ."- **Median days per stage**, compared with the target for that stage.\n"
            ."- The proposals **stuck longest**, and at which stage.\n"
            ."- **Slow reviewers**.\n\n"
            ."## Acting on it\n"
            .'Click **Remind** on a stuck proposal to notify whoever has to act next — the officer, reviewer or researcher.',
        'page_paths' => ['/admin/turnaround'], 'action_label' => 'Open turnaround', 'action_url' => '/admin/turnaround',
    ],
    [
        'slug' => 'reviewer-workload', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Reviewer workload and performance',
        'summary' => 'See each reviewer\'s load, on-time rate and scoring tendency.',
        'keywords' => 'reviewer workload performance on-time leniency strict generous overdue at risk overloaded',
        'questions' => [
            'Which reviewers are overloaded?', 'Which reviewers are always late?', 'Who are the strictest reviewers?',
            'What does leniency mean?', 'Which reviewers might miss their deadline?', 'Who has capacity for more reviews?',
        ],
        'body' => "Open **Reviewer Workload** before assigning to spread the work fairly.\n\n"
            ."## For each reviewer\n"
            ."- **assigned**, **completed** and **overdue** reviews;\n"
            ."- **average days** to complete and **on-time rate**;\n"
            ."- **leniency** — whether they tend to score above or below other reviewers of the same proposals.\n\n"
            ."## At risk\n"
            ."A separate list shows reviewers with reviews due soon and not started.\n\n"
            ."## Good to know\n"
            .'The normal limit is **5 active reviews** per reviewer. Pair a very strict reviewer with a balanced one where you can.',
        'page_paths' => ['/admin/reviewer-workload'],
    ],
    [
        'slug' => 'report-builder', 'category' => $c, 'roles' => [...R::OFFICERS, ...R::RTT_MANAGER],
        'title' => 'Building and exporting reports',
        'summary' => 'Ready-made reports, your own custom reports, and the annual report.',
        'keywords' => 'report builder export excel pdf custom annual report download export data spreadsheet csv save',
        'questions' => [
            'How do I export data?', 'How do I make a custom report?', 'Where is the annual report?', 'Can I download a report as Excel?',
            'Can I save a report to run again?', 'How do I print the annual report?', 'Why does my report say Processing?',
        ],
        'body' => "## Three options\n"
            ."- **Reports** — ready-made reports you filter and export.\n"
            ."- **Report Builder** — choose a **subject** (e.g. proposals or reviews), **filters**, **dimensions** (how to group) and **metrics** (what to count), then **save** it to run again.\n"
            ."- **Annual RTT Report** — the year's summary: calls, proposals, funding, outputs and college performance, ready to print.\n\n"
            ."## Exporting\n"
            .'Download reports as **Excel**. Reports over a long date range are prepared in the background — they show **Processing** for a moment, then become ready to open and export.',
        'page_paths' => ['/reports', '/reports/builder', '/reports/annual'], 'action_label' => 'Open reports', 'action_url' => '/reports',
    ],
    [
        'slug' => 'similarity-flags', 'category' => $c, 'roles' => [...R::CENTRAL, 'admin', 'super_admin'],
        'title' => 'Similarity (plagiarism) flags',
        'summary' => 'Proposals that are very similar to others are flagged for review.',
        'keywords' => 'similarity plagiarism duplicate copy flag detection resubmission same proposal',
        'questions' => [
            'How does plagiarism checking work?', 'Where are similarity flags?', 'What should I do with a flagged proposal?',
            'What similarity score is flagged?', 'Is a flag proof of plagiarism?', 'Does it compare with previous years?',
        ],
        'body' => "When a proposal is submitted it's compared with other proposals in the **same category**, including earlier years.\n\n"
            ."## How flags work\n"
            ."Pairs scoring **70% similar or more** (the threshold can be changed in Settings) appear in **Similarity Flags** with their score.\n\n"
            ."## What to do\n"
            ."1. Open both proposals side by side.\n"
            ."2. Decide whether it's a genuine problem — a resubmission of the team's own earlier proposal is often legitimate.\n"
            ."3. Act through **validation** or the central office if needed.\n\n"
            ."## Good to know\n"
            .'A flag is a prompt to look, **not proof** of plagiarism.',
        'page_paths' => ['/admin/similarity-flags'],
    ],
];
