<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Finance';

return [
    [
        'slug' => 'budget-allocations', 'category' => $c, 'roles' => R::FINANCE,
        'title' => 'Allocating budgets to funded projects',
        'summary' => 'Allocate and approve each funded project\'s budget before requests can be made.',
        'keywords' => 'allocate allocation budget approve bulk funded project fiscal year',
        'questions' => [
            'How do I allocate a budget?', 'How do I approve several allocations at once?', 'Why can\'t the PI request money yet?',
            'How do I edit an allocation?', 'What is a fiscal year allocation?',
        ],
        'body' => "Each funded project needs an approved **budget allocation** before its team can request money.\n\n"
            ."## Step by step\n"
            ."1. Open **Budget Allocations**.\n"
            ."2. **Allocate Budget** to the funded project, for the fiscal year.\n"
            ."3. **Approve** it. Use **Select all pending** to approve several at once.\n\n"
            ."## Good to know\n"
            .'The PI is notified when the allocation is approved. They also need an **approved contract** before requesting funds.',
        'page_paths' => ['/budget-allocations'], 'action_label' => 'Open budget allocations', 'action_url' => '/budget-allocations',
    ],
    [
        'slug' => 'approve-budget-requests', 'category' => $c, 'roles' => [...R::FINANCE, 'college_officer'],
        'title' => 'Reviewing budget requests',
        'summary' => 'Check signatures and items, then approve or return each request.',
        'keywords' => 'budget requests approve review signatures round finance college approval approve budget request',
        'questions' => [
            'How do I approve a budget request?', 'Why is this request waiting?', 'How do I see the signature status?',
            'How do I return a request with comments?', 'Who approves budget requests?',
        ],
        'body' => "Budget requests go through signatures, then the college, then finance.\n\n"
            ."## Step by step\n"
            ."1. Open **Budget Requests** and choose a request.\n"
            ."2. Check the **round**, the items and the **signature status** — every required signature must be in.\n"
            ."3. **College** review comes first, then **finance** approval.\n"
            ."4. Approve, or **return** it with notes explaining what to fix.\n\n"
            ."## Good to know\n"
            .'Approved requests move to **Disbursements** for payment.',
        'page_paths' => ['/budget-requests'],
    ],
    [
        'slug' => 'disbursements', 'category' => $c, 'roles' => R::FINANCE,
        'title' => 'Disbursing funds',
        'summary' => 'Release approved requests and record the transaction and payment proof.',
        'keywords' => 'disburse disbursement pay release money cheque transaction payment proof',
        'questions' => [
            'How do I disburse funds?', 'How do I record a payment?', 'How much has been disbursed this month?',
            'Where do I attach the payment proof?', 'Is the PI notified when money is released?',
        ],
        'body' => "Open **Disbursements**. Approved requests waiting for payment are listed under **Pending Requests**.\n\n"
            ."## Step by step\n"
            ."1. Click **Disburse Funds** on the request.\n"
            ."2. Enter the **amount**, the **transaction or cheque number** and notes.\n"
            ."3. Attach the **payment proof** and save.\n\n"
            ."## Good to know\n"
            .'The top of the page shows the total disbursed **this month** and **overall**. After spending, the PI submits a settlement.',
        'page_paths' => ['/disbursements'], 'action_label' => 'Open disbursements', 'action_url' => '/disbursements',
    ],
    [
        'slug' => 'settlements-admin', 'category' => $c, 'roles' => [...R::FINANCE, 'college_officer'],
        'title' => 'Verifying settlements',
        'summary' => 'The college verifies first, then finance gives final verification.',
        'keywords' => 'settlement verify verification expense report college finance unspent',
        'questions' => [
            'How do I verify a settlement?', 'Which settlements are waiting for me?', 'What happens after finance verification?',
            'What do I check in a settlement?', 'Why can\'t this project be archived?', 'What if the PI spent less than released?',
        ],
        'body' => "Open **Settlements**.\n\n"
            ."## Two steps\n"
            ."1. **College verification** — check the expense report against the approved budget, add notes and verify.\n"
            ."2. **Finance verification** — final check, then verify.\n\n"
            ."## What to check\n"
            ."the **expense report**, the **total spent**, the **unspent** amount and that spending matches the approved budget.\n\n"
            ."## Good to know\n"
            ."A finance-verified settlement marks the request as **settled**. This clears the PI's settlement obligation and allows the project to be archived later.",
        'page_paths' => ['/settlements'], 'action_label' => 'Open settlements', 'action_url' => '/settlements',
    ],
    [
        'slug' => 'milestones', 'category' => $c, 'roles' => R::FINANCE,
        'title' => 'Tracking budget milestones',
        'summary' => 'Follow disbursement milestones for each funded project.',
        'keywords' => 'milestones tracker disbursement milestone deliverable finance',
        'questions' => ['Where can I track milestones?', 'How do I add a milestone?', 'Who updates milestone status?', 'How do I see overdue milestones?', 'Can I remove a milestone?'],
        'body' => "Open **Budget Milestone Tracker** to see and manage the milestones tied to each funded project's money.\n\n"
            ."- Add, edit or remove milestones per project.\n"
            ."- PIs update each milestone's status (pending, in progress, completed) in their **progress reports**.\n"
            .'- Milestones past their due date and not completed are shown as **Overdue**.',
        'page_paths' => ['/finance/milestones'], 'action_label' => 'Open milestones', 'action_url' => '/finance/milestones',
    ],
];
