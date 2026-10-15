<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Funded projects';

return [
    [
        'slug' => 'after-funding', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Your proposal was funded — what happens next',
        'summary' => 'Sign the contract, get ethical clearance if required, then request your budget.',
        'keywords' => 'funded award grant contract next steps after approval money letter when get money award letter where',
        'questions' => [
            'My proposal was funded, what next?', 'When will I get the money?', 'Where is my award letter?',
            'What do I have to do after funding?', 'What is my grant reference number?', 'How much was I awarded?',
            'What are my reporting obligations?', 'How long does my project last?',
        ],
        'body' => "Congratulations! Being funded starts the **project phase**, with a few steps before money is released and regular reporting after.\n\n"
            ."## Before funds are released\n"
            ."1. **Sign and submit the research contract** from the proposal page. Funds are released only after it's approved.\n"
            ."2. **Upload ethical clearance** if your study needs it.\n"
            ."3. Wait for your **budget allocation** to be approved by finance.\n\n"
            ."## Getting the money\n"
            ."4. **Request your budget** through Budget Requests, round by round.\n"
            ."5. After spending a release, submit a **settlement** with your expense report.\n\n"
            ."## During the project\n"
            ."- a **progress report** every 3 months;\n"
            ."- a **mid-term evaluation** about half-way;\n"
            ."- a **completion workshop** at the end;\n"
            ."- record your **research outputs** (publications, patents, etc.).\n\n"
            ."## Good to know\n"
            ."Your **award** has a grant reference and the awarded amount, which can differ from what you requested. The status guide on your proposal page always lists what's due next.",
        'page_paths' => ['/my-proposals', '/my-research'], 'action_label' => 'Open my funded projects', 'action_url' => '/my-research',
    ],
    [
        'slug' => 'research-contract', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Signing your research contract',
        'summary' => 'Sign and submit the contract from your proposal; officers approve it before funds are released.',
        'keywords' => 'contract sign signature agreement submit rejected resubmit approval',
        'questions' => [
            'How do I sign the contract?', 'Why was my contract rejected?', 'Do I need a contract before getting money?',
            'Who approves the contract?', 'How long does contract approval take?', 'Can I see my signed contract?',
        ],
        'body' => "The research contract sets out the terms of your grant. **No money is released until it's approved.**\n\n"
            ."## Step by step\n"
            ."1. Open your funded proposal and find the **contract** step on the Overview tab.\n"
            ."2. Read the contract carefully, sign and **submit** it.\n"
            ."3. Officers check it and **approve** it, or **reject** it with a reason.\n"
            ."4. If rejected, correct what's explained and submit again.\n\n"
            ."## Good to know\n"
            ."Your status guide shows the contract as an urgent action until it's submitted, then as *waiting for approval*.",
        'page_paths' => ['/my-research'],
    ],
    [
        'slug' => 'ethical-clearance', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Ethical clearance for your study',
        'summary' => 'Upload your ethics certificate if your study needs one, and renew it before it expires.',
        'keywords' => 'ethics ethical clearance irb certificate approval human subjects animals expired expiry renew',
        'questions' => [
            'Do I need ethical clearance?', 'How do I upload my ethics certificate?', 'My ethical clearance expired',
            'Why was my clearance rejected?', 'When will I be reminded about expiry?', 'Can I start work before clearance is approved?',
        ],
        'body' => "Studies involving people, animals or sensitive data usually need **ethical clearance** from an ethics committee. Your proposal says whether it's required.\n\n"
            ."## Step by step\n"
            ."1. Obtain the clearance certificate from the ethics committee.\n"
            ."2. Upload it from your proposal's **Documents** tab, with its **reference number** and **expiry date**.\n"
            ."3. Officers verify it — approved, or rejected with a reason to fix.\n\n"
            ."## Good to know\n"
            ."- You're reminded **14, 7 and 1 days** before your clearance expires — upload a renewed certificate in time.\n"
            ."- Don't begin work that needs clearance until it's approved.",
    ],
    [
        'slug' => 'progress-reports', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Submitting a progress report',
        'summary' => 'Report every few months from the Progress tab; overdue reports block new submissions.',
        'keywords' => 'progress report quarterly report final report milestones overdue due revision',
        'questions' => [
            'How do I submit a progress report?', 'When is my progress report due?', 'What do I write in a progress report?',
            'My report was sent back for revision', 'What is the final report?', 'How often do I report?',
            'What happens if my report is late?', 'Can I attach files to my report?', 'Who reviews my progress report?',
        ],
        'body' => "Funded projects report progress **every 3 months**. Each report covers one period; the last one is the **final report**.\n\n"
            ."## Step by step\n"
            ."1. Open your funded proposal and go to the **Progress** tab.\n"
            ."2. Find the period that is due and click **Submit report**.\n"
            ."3. Describe what was done, achievements, challenges, next steps, **percent complete** and **money spent**.\n"
            ."4. Update each **milestone** (pending, in progress, completed) and attach a file if useful.\n"
            ."5. Submit. Officers **accept** it or **send it back for revision** with notes.\n\n"
            ."## Deadlines\n"
            ."- A report is due **14 days after its period ends**.\n"
            ."- You're reminded when it's due soon and once if it becomes overdue.\n\n"
            ."## Good to know\n"
            ."**An overdue report stops you submitting new proposals** until it's in.",
        'page_paths' => ['/my-research'],
    ],
    [
        'slug' => 'budget-requests', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Requesting your budget',
        'summary' => 'Request funds in rounds; the request is signed and approved before money is released.',
        'keywords' => 'budget request money disbursement release funds round signature form tranche',
        'questions' => [
            'How do I request my budget?', 'When will my money be released?', 'Why is my budget request pending?',
            'What signatures does a budget request need?', 'How many funding rounds are there?', 'Can I request the whole budget at once?',
            'Why can\'t I create a budget request?', 'How do I follow my request?',
        ],
        'body' => "Money is released in **rounds** (tranches) through budget requests.\n\n"
            ."## Before you can request\n"
            ."- your **contract** is approved;\n"
            ."- your **budget allocation** is approved by finance.\n\n"
            ."## Step by step\n"
            ."1. Open **Budget Requests** and create a request for the current round.\n"
            ."2. List the items and amounts you need now.\n"
            ."3. The request collects the required **signatures**.\n"
            ."4. The **college** reviews it, then **finance** approves it.\n"
            ."5. Finance **disburses** the money; you're notified.\n\n"
            ."## Good to know\n"
            ."- Follow every step on the request's page, including which signatures are still missing.\n"
            .'- Settle each round before asking for the next, as your office requires.',
        'page_paths' => ['/budget-requests'], 'action_label' => 'Open budget requests', 'action_url' => '/budget-requests',
    ],
    [
        'slug' => 'settlements', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Settling the money you spent',
        'summary' => 'After spending a release, submit a settlement with your expense report.',
        'keywords' => 'settlement expense report receipts unspent liquidate account for money',
        'questions' => [
            'How do I settle my budget?', 'What is a settlement?', 'What documents do I need for settlement?',
            'What happens to unspent money?', 'Who verifies my settlement?', 'Why does an unsettled budget block me?',
        ],
        'body' => "A **settlement** accounts for money you received and spent.\n\n"
            ."## Step by step\n"
            ."1. After spending a released round, open **Settlements** and choose **Submit Settlement**.\n"
            ."2. Upload your **expense report** (with receipts as your office requires).\n"
            ."3. Enter the **total spent** and any **unspent** amount.\n"
            ."4. The **college** verifies it, then **finance** gives final verification.\n\n"
            ."## Good to know\n"
            ."- Unsettled funds can **block new proposals** and stop your project being archived.\n"
            .'- Unspent money is handled as your finance office directs.',
        'page_paths' => ['/settlements'], 'action_label' => 'Open settlements', 'action_url' => '/settlements',
    ],
    [
        'slug' => 'extensions-and-changes', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Asking for more time or a budget change',
        'summary' => 'No-cost extensions extend the project; budget revisions move money between lines.',
        'keywords' => 'extension more time delay no cost extension budget revision change reallocate change my budget after funding',
        'questions' => [
            'Can I extend my project?', 'How do I change my budget?', 'What is a no-cost extension?',
            'Can I move money between budget lines?', 'Who approves budget changes?', 'Can I get more money?',
        ],
        'body' => "Plans change. Two requests cover most situations:\n\n"
            ."- **No-cost extension** — more **time** to finish the project, without extra money.\n"
            ."- **Budget revision** — move money **between budget lines** within your award.\n\n"
            ."## Step by step\n"
            ."1. Open your funded proposal.\n"
            ."2. Choose the request and explain **why** it's needed and what changes.\n"
            ."3. Attach supporting documents if you have them.\n"
            ."4. Officers approve or decline it; you're notified.\n\n"
            ."## Good to know\n"
            .'Neither request adds money to your award. Ask early — before deadlines pass or money is spent differently from the plan.',
    ],
    [
        'slug' => 'midterm-evaluation', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Your mid-term evaluation',
        'summary' => 'Present progress and spending mid-way through the project; upload your reports.',
        'keywords' => 'midterm mid-term evaluation progress financial report milestones hold',
        'questions' => [
            'What is the mid-term evaluation?', 'When is my mid-term evaluation?', 'What do I upload for the mid-term?',
            'Why is my project on hold?', 'What happens if my mid-term goes badly?', 'Who evaluates my mid-term?',
        ],
        'body' => "About half-way through your project, officers schedule a **mid-term evaluation** to check progress and spending.\n\n"
            ."## What to prepare\n"
            ."- a **progress report** (PDF);\n"
            ."- a **financial report** (PDF);\n"
            ."- lists of **completed** and **missed** milestones.\n\n"
            ."## What happens\n"
            ."Evaluators review your reports and add notes and feedback. If serious problems are found the project can be put **on hold** until they're resolved.\n\n"
            ."## Good to know\n"
            .'The date appears in your status guide and calendar.',
    ],
    [
        'slug' => 'completion-workshop', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Completing your project',
        'summary' => 'Present your results at the completion workshop; the project is then completed and archived.',
        'keywords' => 'completion workshop final presentation finish project close archive results final report',
        'questions' => [
            'How do I finish my project?', 'What is the completion workshop?', 'What happens after my project is completed?',
            'When is my project archived?', 'What do I upload for the completion workshop?', 'Why hasn\'t my project been archived?',
        ],
        'body' => "At the end of the project you present your results at a **completion workshop**.\n\n"
            ."## Step by step\n"
            ."1. Officers schedule the workshop.\n"
            ."2. Upload your **presentation or final report**.\n"
            ."3. Present and answer questions; evaluators record feedback and a **score**.\n"
            ."4. The workshop is finalised and the project becomes **completed**.\n\n"
            ."## Archiving\n"
            ."The project is **archived 30 days after completion**, once:\n"
            ."- at least one **research output** is recorded, and\n"
            ."- all released funds are **settled**.\n\n"
            ."If it hasn't been archived, one of these is usually missing.",
    ],
    [
        'slug' => 'research-outputs', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Recording publications and other outputs',
        'summary' => 'Record articles, books, patents, software and impact from your funded research.',
        'keywords' => 'outputs publications journal article paper patent book software prototype impact record',
        'questions' => [
            'How do I record a publication?', 'Where do I add my research outputs?', 'What counts as a research output?',
            'Why do outputs matter?', 'Who verifies my outputs?', 'Can I add outputs after my project ends?',
        ],
        'body' => "Record what your funded research produced in **Research Outputs**.\n\n"
            ."## Types of output\n"
            ."journal article, conference paper, book, patent, software, prototype, community impact and technology transfer.\n\n"
            ."## Step by step\n"
            ."1. Open **Research Outputs** and add an output.\n"
            ."2. Choose the project, the type, and give the title and details (journal, publisher, licence, etc.).\n"
            ."3. Officers **verify** and **approve** it.\n\n"
            ."## Why it matters\n"
            ."- At least one output is needed before a completed project can be **archived**.\n"
            .'- Outputs appear in the **annual report** and university research statistics.',
        'page_paths' => ['/research-outputs'], 'action_label' => 'Open research outputs', 'action_url' => '/research-outputs',
    ],
];
