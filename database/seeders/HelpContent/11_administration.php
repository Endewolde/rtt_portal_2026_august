<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Administration';

return [
    [
        'slug' => 'manage-users', 'category' => $c, 'roles' => [...R::ADMIN, 'college_officer'],
        'title' => 'Managing users and roles',
        'summary' => 'Create or import users, assign roles, and activate, suspend or deactivate accounts.',
        'keywords' => 'users create import csv roles assign deactivate activate suspend account add user bulk login as user impersonate',
        'questions' => [
            'How do I add a new user?', 'How do I import users from Excel?', 'How do I give someone a role?', 'How do I deactivate an account?',
            'Why can\'t a user log in?', 'How do I assign a role to many users at once?', 'How do I see what a user sees?',
            'How do I suspend a user?', 'How do I find users who signed in with Google or Microsoft?', 'Can I delete a user?',
            'How do I make someone a reviewer?',
        ],
        'body' => "Open **Users**.\n\n"
            ."## Adding people\n"
            ."- **Create New User** for one person.\n"
            ."- **Import Users** from a **CSV** made from the downloadable template. The result shows how many were created, skipped and failed.\n"
            ."- People can also sign in with **Google** or **Microsoft** — filter by **source** to find them.\n\n"
            ."## Giving access\n"
            ."- **Assign Roles** from a user's menu (super admins).\n"
            ."- Select several users to **bulk assign a role** or change their status.\n"
            ."- Researchers and internal reviewers hold the **staff** role; outside reviewers hold **external reviewer**.\n\n"
            ."## Account status\n"
            ."**Active**, **Inactive** or **Suspended**. Only active users can sign in.\n\n"
            ."## If someone can't sign in\n"
            ."Check that the account is **active**, that they're using the right email, and whether it's **locked** after 5 failed attempts (it unlocks after 15 minutes).\n\n"
            ."## Good to know\n"
            ."- **Login as User** lets you see the platform exactly as that person does; use **Return to Admin** to come back. It's recorded in the audit log and isn't available for admin accounts.\n"
            ."- College officers manage users in their own college.\n"
            ."- To remove someone's personal data, use **Data Requests** rather than deleting the account.",
        'page_paths' => ['/admin/users'], 'action_label' => 'Open users', 'action_url' => '/admin/users',
    ],
    [
        'slug' => 'roles-permissions', 'category' => $c, 'roles' => R::SUPER,
        'title' => 'Roles, permissions and features',
        'summary' => 'Control what each role can do, and switch whole features on or off.',
        'keywords' => 'roles permissions access control features modules enable disable feature management hide menu',
        'questions' => [
            'How do I change what a role can do?', 'How do I create a new role?', 'How do I turn a feature off?',
            'Why can\'t a user see a menu item?', 'Which roles exist?', 'What is the difference between a role and a permission?',
        ],
        'body' => "## The pieces\n"
            ."- A **permission** is one action (e.g. view reports).\n"
            ."- A **role** is a bundle of permissions given to users (e.g. college officer).\n"
            ."- **Feature Management** switches whole modules or individual features on or off for everyone.\n\n"
            ."## Main roles\n"
            ."staff (researchers and internal reviewers), external reviewer, college officer, the category directors (research, community, technology), central officer, finance officer, proposal archivist, admin and super admin.\n\n"
            ."## If someone can't see a page\n"
            ."Check their **roles**, that the role has the **permission**, and that the **feature** is switched on.\n\n"
            ."## Good to know\n"
            .'Changes apply immediately — removing a permission hides the related screens at once.',
        'page_paths' => ['/admin/roles', '/admin/permissions', '/admin/features'],
    ],
    [
        'slug' => 'admin-settings', 'category' => $c, 'roles' => R::ADMIN,
        'title' => 'Key settings administrators should know',
        'summary' => 'Pass marks, eligibility rules, certificates, sign-in security, email, retention and the public site live in Settings.',
        'keywords' => 'settings configuration thresholds eligibility retention admin configure pass mark lockout session upload size backup turn off switch ai coach feedback',
        'questions' => [
            'Where do I change the pass mark?', 'How do I change the progress report interval?', 'How do I turn off the overdue report rule?',
            'Where is the reviewer agreement text?', 'How do I set data retention?', 'How do I change the reviewer workload limit?',
            'How do I change the maximum upload size?', 'How do I change the login lockout or session timeout?', 'How do I turn the AI coach off?',
            'Where are backup settings?', 'How do I limit how many grants a PI can hold?',
        ],
        'body' => "Open **Settings**. The groups that matter most:\n\n"
            ."## Review Thresholds\n"
            ."- **Pass marks**: blind (default 60), combined (default 70), defence (informational). They're raw points, not percentages.\n"
            ."- **Reviewer workload limit** (default 5) and the overdue reminder interval (default every 3 days).\n"
            ."- **Similarity** flag threshold (default 0.70).\n"
            ."- **Progress report interval** (default every 3 months).\n"
            ."- **Submission eligibility**: block new submissions while a report is overdue, maximum active grants per PI, and unsettled-funds limit.\n"
            ."\n## General\n"
            ."- **Reviewer certificate** minimum reviews (default 3) and signatory.\n"
            ."- **Reviewer agreement** wording (empty = built-in text).\n"
            ."- **AI** switches for the writing coach and review summary.\n\n"
            ."## Authentication\n"
            ."Failed attempts before lockout (5), lockout length (15 minutes), session timeout (60 minutes), concurrent sessions and minimum password length.\n\n"
            ."## Other groups\n"
            ."- **Email & Notifications** — mail setup and **broadcast email**.\n"
            ."- **File Management** — upload size (20 MB) and allowed file types.\n"
            ."- **Audit & Logging** — retention rules (off until you set a number of days).\n"
            .'- **Backup & Recovery**, **Appearance**, **Integrations** and **Public Site**.',
        'page_paths' => ['/admin/settings'], 'action_label' => 'Open settings', 'action_url' => '/admin/settings',
    ],
    [
        'slug' => 'evaluation-criteria', 'category' => $c, 'roles' => [...R::ADMIN, 'central_officer'],
        'title' => 'Setting up evaluation criteria',
        'summary' => 'Define scoring forms per category: sections with weights and questions with maximum scores.',
        'keywords' => 'evaluation criteria scoring form questions weights max score rubric recalculate',
        'questions' => [
            'How do I change the review questions?', 'How do I change the scoring weights?', 'Can each category have its own form?',
            'Will changing criteria affect reviews already done?', 'How is the total score calculated?', 'How do I make a question required?',
        ],
        'body' => "Open **Evaluation Criteria**. There's a scoring form for each **evaluation type** (blind review, open defence) and **proposal category**.\n\n"
            ."## Structure\n"
            ."- **Categories** (sections), each with a **weight**.\n"
            ."- **Questions** inside each, each with a **maximum score**.\n\n"
            ."## How scores add up\n"
            ."Pass marks are compared with **raw points** out of the sum of the category weights — so changing weights changes what a pass mark means.\n\n"
            ."## Good to know\n"
            .'Changes apply to **new reviews**. For proposals already scored, use the **recalculate** tools.',
        'page_paths' => ['/admin/evaluation-criteria'],
    ],
    [
        'slug' => 'reference-data', 'category' => $c, 'roles' => R::ADMIN,
        'title' => 'Colleges, departments, thematic areas and lists',
        'summary' => 'Maintain the reference lists used across the platform.',
        'keywords' => 'colleges departments thematic areas dropdown options lists reference data add college',
        'questions' => [
            'How do I add a college or department?', 'How do I edit thematic areas?', 'How do I change a dropdown list?',
            'How do I rename a department?', 'Can I deactivate a department?',
        ],
        'body' => "- **Colleges** and **Departments** — the university structure used for users, proposals and reports.\n"
            ."- **Thematic Areas** — research priorities shown on the homepage and chosen in proposals.\n"
            ."- **Dropdown Options** — the choices offered in forms across the platform.\n\n"
            ."## Good to know\n"
            ."Prefer **deactivating** over deleting a department or college that's already used — past records keep their links.",
        'page_paths' => ['/admin/colleges', '/admin/departments', '/admin/thematic-areas', '/admin/dropdown-options'],
    ],
    [
        'slug' => 'public-site-admin', 'category' => $c, 'roles' => R::ADMIN,
        'title' => 'Editing the public website',
        'summary' => 'Homepage slides, steps, capability cards, header text, FAQs and downloads.',
        'keywords' => 'public site homepage edit slides hero steps capabilities cards faqs downloads resources header subtitle',
        'questions' => [
            'How do I change the homepage?', 'How do I edit the public FAQs?', 'How do I add a downloadable form?', 'How do I change the header text?',
            'How do I change the hero slides?', 'How do I edit the capability cards?', 'How do I hide a section of the homepage?',
            'How do I change the subtitle under the university name?',
        ],
        'body' => "## Where to edit\n"
            ."- **Public Site** — hero slides, sections, How It Works steps and capability cards.\n"
            ."- **Settings → Public Site** — header bar text, including the **subtitle under the university name**, and which sections are shown.\n"
            ."- **FAQs** — the questions on the homepage.\n"
            ."- **Resources** — files on the public **Downloads** page.\n"
            ."- **Thematic Areas** — the research focus cards.\n\n"
            ."## Good to know\n"
            .'Changes are live straight away. Visitors may need to refresh to see them.',
        'page_paths' => ['/admin/public-site', '/admin/faqs', '/admin/resources'], 'action_label' => 'Open public site', 'action_url' => '/admin/public-site',
    ],
    [
        'slug' => 'announcements', 'category' => $c, 'roles' => R::ADMIN,
        'title' => 'Announcements, login notices and feedback',
        'summary' => 'Show notices when people sign in, email broadcasts, and read user feedback.',
        'keywords' => 'announcement login notice broadcast email message feedback all users notify everyone',
        'questions' => [
            'How do I show a message when people log in?', 'How do I email all users?', 'Where is user feedback?',
            'How do I email only one college?', 'How do I email everyone with a role?', 'How long does a login notice show?',
        ],
        'body' => "## Login notices\n"
            ."Open **Login Notices** to show a message after sign-in. Set a **start and end date** and a **priority**; it disappears after the end date.\n\n"
            ."## Broadcast email\n"
            ."In **Settings → Email & Notifications**, send to **all users**, a **role**, a **college** or one person. Write the subject and message and send.\n\n"
            ."## Feedback\n"
            .'**Feedback** lists suggestions and problems users send from the feedback form.',
        'page_paths' => ['/admin/login-notices', '/admin/feedback'],
    ],
    [
        'slug' => 'system-monitor', 'category' => $c, 'roles' => R::ADMIN,
        'title' => 'System Monitor, email log and audit log',
        'summary' => 'Server health, the queue worker, failed jobs, sent emails and every change made.',
        'keywords' => 'system monitor health server queue worker failed jobs email log audit log backups slow alerts',
        'questions' => [
            'Is the system healthy?', 'Did an email actually send?', 'Who changed this record?', 'Is the queue worker running?',
            'How do I retry failed jobs?', 'Why didn\'t someone get an email?', 'Why is the system slow?', 'How do I export the audit log?',
            'Do emails still go out if the queue worker is down?',
        ],
        'body' => "## System Monitor\n"
            ."Tabs for **Overview**, **Server** (load, memory, disk), **Requests**, **Database**, **Alerts**, **Email** and **Alerting**.\n\n"
            ."- **Queue Worker** status shows whether background work is being processed.\n"
            ."- **Failed jobs** can be **retried** or deleted.\n"
            ."- The **Email** tab lists every email **sent** or **failed**, with the reason.\n\n"
            ."## If someone didn't get an email\n"
            ."1. Find it in the **Email** tab.\n"
            ."2. If it failed, check the address and the reason.\n"
            ."3. If it's not there, check that their notification settings allow email.\n\n"
            ."## Good to know\n"
            ."If the queue worker isn't running, emails are still sent right after each action, so nothing waits forever.\n\n"
            ."## Audit Logs\n"
            .'Every create, update and delete — who did it, when and what changed. Filter and **export**.',
        'page_paths' => ['/admin/system-monitor', '/admin/audit-logs'], 'action_label' => 'Open system monitor', 'action_url' => '/admin/system-monitor',
    ],
    [
        'slug' => 'data-requests-admin', 'category' => $c, 'roles' => R::ADMIN,
        'title' => 'Handling data deletion requests',
        'summary' => 'Review requests, check blockers, then anonymise or decline.',
        'keywords' => 'data deletion request anonymise privacy remove account decline personal data',
        'questions' => [
            'How do I handle a data deletion request?', 'Why can\'t I approve this deletion?', 'What does anonymise mean?',
            'What happens to the person\'s proposals after deletion?', 'Can I undo an anonymisation?',
        ],
        'body' => "Open **Data Requests**.\n\n"
            ."## What blocks a deletion\n"
            ."- proposals still in progress;\n"
            ."- reviews not finished;\n"
            ."- budget releases not settled;\n"
            ."- being the only super admin.\n\n"
            ."## Approving\n"
            ."When nothing blocks it, **Approve & anonymise**: personal details are removed and sign-in disabled. Proposals, reviews and money records stay, shown as **\"Deleted User\"**.\n\n"
            ."## Declining\n"
            ."**Decline** with a reason the person will see.\n\n"
            ."## Good to know\n"
            ."Anonymisation **can't be undone**.",
        'page_paths' => ['/admin/data-requests'],
    ],
    [
        'slug' => 'help-articles-admin', 'category' => $c, 'roles' => R::ADMIN,
        'title' => 'Editing help articles and seeing what people ask',
        'summary' => 'Keep the help centre accurate and write articles for unanswered questions.',
        'keywords' => 'help articles edit assistant questions unanswered faq knowledge base write article',
        'questions' => [
            'How do I add a help article?', 'What questions can the assistant not answer?', 'How do I make an article show only for some roles?',
            'How do I improve an assistant answer?', 'How do I format a help article?', 'Which articles are not helpful?',
            'Will my edits be overwritten by updates?',
        ],
        'body' => "Open **Help Articles**.\n\n"
            ."## Writing an article\n"
            ."1. Give it a clear **title** and one-line **summary**.\n"
            ."2. Choose the **roles** that should see it (none = everyone signed in).\n"
            ."3. Under **Common questions**, list the ways people ask about it, one per line — the assistant matches on these most.\n"
            ."4. Add other words under **Keywords**, and the **pages** where it should be suggested.\n\n"
            ."## Formatting\n"
            ."Start a line with **## ** for a heading, **1.** for steps, **- ** for bullets, and wrap words in **double asterisks** for bold.\n\n"
            ."## Improving answers\n"
            ."The **What people ask** tab shows the most common questions, those the assistant **couldn't answer**, and articles marked not helpful. Add those questions to the right article, or write a new one.\n\n"
            ."## Good to know\n"
            .'Articles you edit are never overwritten by platform updates.',
        'page_paths' => ['/admin/help-articles'], 'action_label' => 'Open help articles', 'action_url' => '/admin/help-articles',
    ],
];
