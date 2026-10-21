<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Monitoring';

return [
    [
        'slug' => 'ongoing-proposals', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Monitoring ongoing projects',
        'summary' => 'See every funded project\'s contract, mid-term and completion status, and add older grants.',
        'keywords' => 'ongoing proposals monitoring funded projects legacy grant import archive status needs scheduling',
        'questions' => [
            'Where can I see all ongoing projects?', 'How do I add an old grant that predates the system?', 'Which projects need a mid-term scheduled?',
            'How do I archive a project?', 'How do I import many legacy grants?', 'Which projects have no contract?',
        ],
        'body' => "Open **Ongoing Proposals** to oversee every funded project in one table.\n\n"
            ."## What you see\n"
            ."For each project: **contract** status, **mid-term** status (e.g. *Needs Scheduling*), **completion workshop** status and **days since funded**. Filter to find what needs attention.\n\n"
            ."## Older grants\n"
            ."Grants that started before the platform was used can be added with **Grant Legacy Proposal**, or many at once with the **import template**.\n\n"
            ."## Good to know\n"
            .'Projects without a mid-term after about **90 days** are flagged as overdue for one.',
        'page_paths' => ['/ongoing-proposals'], 'action_label' => 'Open ongoing proposals', 'action_url' => '/ongoing-proposals',
    ],
    [
        'slug' => 'progress-reports-admin', 'category' => $c, 'roles' => [...R::OFFICERS, ...R::RTT_MANAGER],
        'title' => 'Reviewing progress reports',
        'summary' => 'Accept reports or send them back, and chase the ones that are late.',
        'keywords' => 'progress reports review accept revision late overdue chase monitoring',
        'questions' => [
            'How do I review a progress report?', 'Which progress reports are late?', 'How do I send a report back for revision?',
            'How often do projects report?', 'Are researchers reminded automatically?', 'What happens if a PI never submits a report?',
            'Can I change how often reports are due?', 'Where do I see percent complete for a project?',
        ],
        'body' => "Funded projects report **every 3 months**; each report is due **14 days** after its period ends. Open **Progress Reports**.\n\n"
            ."## Reviewing\n"
            ."1. Open a **submitted** report.\n"
            ."2. Read the summary, achievements, challenges, percent complete, spending and milestone updates.\n"
            ."3. **Accept** it, or **send it back for revision** with notes.\n\n"
            ."## Chasing late reports\n"
            .'Filter for **overdue** reports. PIs are reminded automatically before and after the due date, and an overdue report **blocks them from submitting new proposals**.',
        'page_paths' => ['/progress-reports'], 'action_label' => 'Open progress reports', 'action_url' => '/progress-reports',
    ],
    [
        'slug' => 'midterm-admin', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Scheduling and recording mid-term evaluations',
        'summary' => 'Schedule the mid-term, review the PI\'s reports and record the outcome.',
        'keywords' => 'midterm mid-term evaluation schedule bulk hold financial report notes',
        'questions' => [
            'How do I schedule a mid-term evaluation?', 'Can I schedule several mid-terms at once?', 'How do I put a project on hold?',
            'What reports does the PI upload?', 'How do I record the evaluation outcome?', 'When is a mid-term due?',
            'Which projects are overdue for a mid-term?', 'Is the PI notified about the mid-term?',
        ],
        'body' => "Open **Midterm Evaluations**.\n\n"
            ."## Step by step\n"
            ."1. **Schedule Midterm Evaluation** for a project (or several at once).\n"
            ."2. The PI uploads a **progress report** and **financial report** and lists completed and missed milestones.\n"
            ."3. Record your **evaluation notes** and feedback.\n\n"
            ."## Problems\n"
            .'If serious problems are found, put the project **on hold**; the PI and office are notified.',
        'page_paths' => ['/midterm-evaluations'], 'action_label' => 'Open midterm evaluations', 'action_url' => '/midterm-evaluations',
    ],
    [
        'slug' => 'completion-admin', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Running completion workshops',
        'summary' => 'Schedule the workshop, record feedback and finalize with a score.',
        'keywords' => 'completion workshop schedule finalize score complete project archive',
        'questions' => [
            'How do I schedule a completion workshop?', 'How do I finalize a workshop?', 'What happens after finalizing?',
            'Why wasn\'t a completed project archived?', 'When is a project archived?', 'What does the PI present at the workshop?',
        ],
        'body' => "Open **Completion Workshops**.\n\n"
            ."## Step by step\n"
            ."1. **Schedule Completion Workshop** for the project.\n"
            ."2. The PI uploads their presentation or report.\n"
            ."3. Record **questions & discussion** and overall feedback.\n"
            ."4. **Finalize Workshop** with a score — the project becomes **completed**.\n\n"
            ."## Archiving\n"
            .'Completed projects are archived automatically **30 days** later, provided at least one research output is recorded and funds are settled. If not, the project waits until they are.',
        'page_paths' => ['/completion-workshops'], 'action_label' => 'Open completion workshops', 'action_url' => '/completion-workshops',
    ],
    [
        'slug' => 'outputs-admin', 'category' => $c, 'roles' => R::OFFICERS,
        'title' => 'Verifying research outputs and impact',
        'summary' => 'Verify and approve recorded outputs; track publications, patents and awards.',
        'keywords' => 'research outputs verify approve impact publications patents awards',
        'questions' => [
            'How do I approve a research output?', 'Where can I see publications and patents?', 'How do I record an award?',
            'Why does a project need an output to be archived?', 'How many publications came from funded research?', 'What counts as a research output?',
        ],
        'body' => "- **Research Outputs** — outputs recorded by research teams. Open one to **verify** and **approve** it, or add review notes.\n"
            ."- **Research Impact** — publications, patents, awards and other outcomes from funded research, with totals.\n\n"
            .'Approved outputs count toward project archiving and appear in the annual report.',
        'page_paths' => ['/research-outputs', '/research-impact'],
    ],
    [
        'slug' => 'repository-admin', 'category' => $c, 'roles' => [...R::CENTRAL, 'admin', 'super_admin'],
        'title' => 'Publishing to the research repository',
        'summary' => 'Publish completed research to the public repository and curate it.',
        'keywords' => 'repository publish public archive featured completed research public abstract edit',
        'questions' => [
            'How do I publish research to the repository?', 'How do I remove a record from the public site?', 'How do I feature a project?',
            'Which projects are ready to publish?', 'Can I edit the public abstract?', 'Where does the public see completed research?',
        ],
        'body' => "Open **Research Repository**.\n\n"
            ."## Step by step\n"
            ."1. **View ready proposals** — completed research that can be published.\n"
            ."2. **Publish to Repository**, adding a public-facing abstract (or using the proposal's).\n"
            ."3. Edit or **feature** records as needed.\n\n"
            ."## Removing\n"
            .'**Archive** a record to remove it from the public site; **Re-publish** to restore it.',
        'page_paths' => ['/admin/repository'], 'action_label' => 'Open repository', 'action_url' => '/admin/repository',
    ],
    [
        'slug' => 'archives', 'category' => $c, 'roles' => [...R::CENTRAL, 'proposal_archivist', 'admin', 'super_admin'],
        'title' => 'Finding completed and archived projects',
        'summary' => 'Browse completed projects by year, and search the full proposal archive.',
        'keywords' => 'archive archived completed past projects search history proposal archive documents old proposals previous years',
        'questions' => ['Where are old proposals?', 'How do I find a completed project?', 'How do I search the proposal archive?', 'Can I see documents of archived proposals?', 'Where are projects from previous years?', 'Who can open the proposal archive?'],
        'body' => "- **Completed Archive** — completed and archived projects by academic year.\n"
            .'- **Proposal Archive** (archivists and admins) — search any proposal by title, tracker number or PI, and open its **documents** and **team members**.',
        'page_paths' => ['/admin/completed-archive', '/admin/proposal-archive'],
    ],
];
