<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Conferences & external funding';

return [
    [
        'slug' => 'submit-abstract', 'category' => $c,
        'title' => 'Submitting a conference abstract',
        'summary' => 'Submit an abstract from the conference page and follow it under My Abstracts.',
        'keywords' => 'conference abstract submit presentation poster oral my abstracts status co-authors deadline',
        'questions' => [
            'How do I submit an abstract?', 'How do I check my abstract status?', 'Can I add co-authors to my abstract?',
            'What is the abstract deadline?', 'Can I choose oral or poster presentation?', 'Can I edit my abstract after submitting?',
            'Where are upcoming conferences?', 'How will I know if my abstract is accepted?',
        ],
        'body' => "Conferences organised by the office are listed on the public **Conferences** page.\n\n"
            ."## Step by step\n"
            ."1. Open the conference and choose **Submit abstract**.\n"
            ."2. Enter the **title**, **abstract**, **keywords** and the **presentation type** (oral or poster, where offered).\n"
            ."3. Add your **co-authors** and attach a supporting file if needed.\n"
            ."4. Submit before the **abstract deadline** shown on the conference page.\n\n"
            ."## Following your abstract\n"
            ."Open **My Abstracts** and enter the **email** you submitted with to see each abstract's status (submitted, under review, accepted or rejected).\n\n"
            ."## Good to know\n"
            ."- After the deadline, submissions close.\n"
            ."- To correct a submitted abstract, contact the organisers.\n"
            .'- Accepted abstracts are scheduled into the conference sessions.',
    ],
    [
        'slug' => 'conferences-admin', 'category' => $c, 'roles' => [...R::CENTRAL, 'admin', 'super_admin'],
        'title' => 'Running conferences and abstract review',
        'summary' => 'Create events, manage registrations and sessions, and review abstracts.',
        'keywords' => 'conference create event registration sessions speakers abstracts review assign accept reject publish capacity',
        'questions' => [
            'How do I create a conference?', 'How do I assign abstract reviewers?', 'How do I accept or reject an abstract?',
            'How do I publish a conference on the public site?', 'How do I add sessions and speakers?', 'How do I see who registered?',
            'How do I set the abstract deadline?', 'Can a conference be online?',
        ],
        'body' => "## Creating a conference\n"
            ."1. Open **Conferences** and create an event.\n"
            ."2. Set the **dates**, **location** (in person or online), **capacity** and **abstract deadline**.\n"
            ."3. Add **sessions** and **speakers**.\n"
            ."4. **Publish** it — published conferences appear on the public site.\n\n"
            ."## Reviewing abstracts\n"
            ."1. Open **Abstracts** and filter by conference.\n"
            ."2. **Assign reviewers** — the abstract appears in their **My Reviews**.\n"
            ."3. Read their recommendations and set each abstract's **status** (accepted or rejected).\n\n"
            ."## Good to know\n"
            .'Registrations are listed on the conference so you can track attendance against capacity.',
        'page_paths' => ['/admin/conferences', '/admin/abstracts'], 'action_label' => 'Open conferences', 'action_url' => '/admin/conferences',
    ],
    [
        'slug' => 'external-funds', 'category' => $c, 'roles' => [...R::CENTRAL, 'admin', 'super_admin', 'finance_officer'],
        'title' => 'Managing external funding',
        'summary' => 'Track funding agencies, opportunities, applications and awards outside the university.',
        'keywords' => 'external funds agencies donors grants opportunities applications awards milestones international partner',
        'questions' => [
            'How do I record an external grant?', 'How do I publish an external funding opportunity?', 'How do I track an application to a donor?',
            'How do I add a funding agency?', 'Where can staff see external funding opportunities?', 'How do I track milestones on an external award?',
            'How much external funding has each college won?',
        ],
        'body' => "**External Funds** covers money from outside the university — donors, agencies and partners.\n\n"
            ."## What you manage\n"
            ."- **Agencies** — the funders you work with and their contacts.\n"
            ."- **Opportunities** — open calls from funders. Published ones appear on the public **Funding Opportunities** page so staff can find them.\n"
            ."- **Applications** — what staff have applied for and its status.\n"
            ."- **Awards** — successful grants, with amount, period, **milestones** and budget use.\n\n"
            ."## Step by step: recording a grant\n"
            ."1. Make sure the **agency** exists.\n"
            ."2. Record the **application**, then mark it awarded.\n"
            ."3. Add the **award** details and milestones, and update them as the project progresses.\n\n"
            ."## Good to know\n"
            .'Totals by **college** show where external funding is coming in.',
        'page_paths' => ['/admin/external-funds'], 'action_label' => 'Open external funds', 'action_url' => '/admin/external-funds',
    ],
];
