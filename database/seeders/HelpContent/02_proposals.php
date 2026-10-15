<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Proposals';

return [
    [
        'slug' => 'submit-proposal', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Submitting a research proposal',
        'summary' => 'Choose an open call, complete the 7-step wizard, then submit before the deadline.',
        'keywords' => 'apply application new proposal create wizard submit call how to apply start steps',
        'questions' => [
            'How do I apply for funding?', 'How do I submit a proposal?', 'How do I start a new proposal?', 'What are the steps to submit?',
            'Can I save my proposal and finish later?', 'How long does it take to fill in a proposal?', 'Can I edit my proposal after submitting?',
            'Do I need to finish all steps at once?', 'What happens after I submit?', 'Can I submit more than one proposal?',
            'Who can submit a proposal?',
        ],
        'body' => "Any registered staff researcher can apply while a call is open. The proposal is completed in a guided **7-step wizard** and can be saved as a draft at any point.\n\n"
            ."## Step by step\n"
            ."1. Go to **Proposals → New Proposal** and choose an open call.\n"
            ."2. **Basic information** — title, abstract (at least 100 characters), keywords, focus area, research type and duration.\n"
            ."3. **PI details** — confirm your details as Principal Investigator.\n"
            ."4. **Co-investigators** — invite your team (at least one is required).\n"
            ."5. **Budget** — add each cost with a justification.\n"
            ."6. **Documents** — upload the proposal document and budget spreadsheet.\n"
            ."7. **Review and submit** — check the summary, optionally use **Check my proposal**, tick the confirmation and click **Submit Proposal**.\n\n"
            ."## Good to know\n"
            ."- Use **Save as Draft** any time; return later from **My Proposals**.\n"
            ."- On submission you get a **tracker number** such as *RES-2026-2027-000123*.\n"
            ."- After submission the proposal is **locked** — you can only change it if it's returned for corrections.\n"
            ."- Some calls limit how many proposals each PI may submit.\n\n"
            ."## What happens next\n"
            .'The research office **validates** it (usually about a week), then it goes to **blind review**. Your proposal page shows each stage as it happens.',
        'page_paths' => ['/proposals/create', '/my-proposals'], 'action_label' => 'Start a proposal', 'action_url' => '/proposals/create',
    ],
    [
        'slug' => 'choosing-a-call', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Choosing the right call',
        'summary' => 'Read each call\'s category, eligibility, guidelines and deadline before you start.',
        'keywords' => 'call which call eligibility guidelines category research community engagement technology transfer limit thematic',
        'questions' => [
            'Which call should I apply to?', 'Where are the call guidelines?', 'Am I eligible for this call?',
            'How many proposals can I submit to one call?', 'What is the difference between research, community engagement and technology transfer?',
            'When does the call close?', 'Why can\'t I see any open calls?', 'What are the thematic areas?',
        ],
        'body' => "Every call belongs to one **category** and has its own rules.\n\n"
            ."## The three categories\n"
            ."- **Research** — studies that generate new knowledge.\n"
            ."- **Community engagement** — projects that work with and benefit communities.\n"
            ."- **Technology transfer** — turning research into products, services or practice.\n\n"
            ."## Before you start\n"
            ."1. Read the call's **eligibility** statement.\n"
            ."2. Download and read the **guidelines** — reviewers score against them.\n"
            ."3. Note the **deadline** and the **maximum proposals per PI**.\n"
            ."4. Check that your topic fits the university's **thematic areas** (shown on the homepage).\n\n"
            ."## Good to know\n"
            ."- Calls close **automatically** at their end date and time.\n"
            ."- You're reminded **7, 3 and 1 days** before the deadline if you have a draft.\n"
            .'- If no calls are listed, none are open right now — check the public **Open Calls** page later.',
        'page_paths' => ['/proposals/create'], 'action_label' => 'See open calls', 'action_url' => '/proposals/create',
    ],
    [
        'slug' => 'co-investigators', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Adding co-investigators to your team',
        'summary' => 'Invite colleagues in step 3; each must accept before you can submit.',
        'keywords' => 'team members co-pi coinvestigator invite collaborator colleague add member remove accept decline invitation',
        'questions' => [
            'How do I add a co-investigator?', 'How do I invite team members?', 'Why can\'t I find my colleague?',
            'My co-investigator declined, what now?', 'How many co-investigators do I need?', 'How does a co-investigator accept?',
            'Can I remove a team member?', 'Can someone outside the university join my team?', 'Can I change the team after funding?',
        ],
        'body' => "Every proposal needs **at least one co-investigator**. You invite them in **step 3** of the wizard.\n\n"
            ."## Step by step\n"
            ."1. In step 3, search for your colleague by name or email.\n"
            ."2. Select them and send the invitation.\n"
            ."3. They receive a notification and must **accept** it.\n"
            ."4. You can submit once every invited co-investigator has accepted.\n\n"
            ."## If something goes wrong\n"
            ."- **Can't find a colleague?** They need an account on the platform first — ask them to register.\n"
            ."- **Someone declined?** Remove them or invite someone else, or the proposal can't be submitted.\n"
            ."- **Still pending?** Remind them to check their notifications or email.\n\n"
            ."## Good to know\n"
            .'Team members can follow the proposal and help with progress reports. Changing the team after funding goes through the office.',
        'page_paths' => ['/proposals/create'],
    ],
    [
        'slug' => 'budget-in-proposal', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Preparing your proposal budget',
        'summary' => 'Add budget lines with amounts and a justification for each in step 4.',
        'keywords' => 'budget lines cost items amount justification equipment travel personnel step 4 etb',
        'questions' => [
            'How do I add budget items?', 'What should I write as justification?', 'Is there a budget limit?',
            'Can I change the budget after submitting?', 'What budget categories can I use?', 'Do reviewers look at my budget?',
            'Will I get the full amount I ask for?',
        ],
        'body' => "In **step 4** you list what the project will cost, in Ethiopian birr (ETB).\n\n"
            ."## For each budget line\n"
            ."- choose a **category** (e.g. equipment, travel, supplies);\n"
            ."- describe the **item**;\n"
            ."- enter the **amount**;\n"
            ."- write a short **justification** that links the cost to a specific activity.\n\n"
            ."## Good to know\n"
            ."- Reviewers check that the budget **matches the planned work** — unexplained or inflated costs lower your score.\n"
            ."- Respect any limits in the call guidelines.\n"
            ."- The central office decides the **awarded amount**, which may be less than you request.\n"
            .'- After funding, moving money between lines needs a **budget revision** request.',
        'page_paths' => ['/proposals/create'],
    ],
    [
        'slug' => 'documents', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Uploading proposal documents',
        'summary' => 'Which files to upload, accepted formats, and keeping blind review anonymous.',
        'keywords' => 'upload file pdf docx document attachment cv budget spreadsheet format size anonymous identifying 20mb',
        'questions' => [
            'What documents do I need to upload?', 'What file types are accepted?', 'What is the maximum file size?',
            'Can I put my name in the proposal document?', 'Can I delete a document after submitting?', 'What is the anonymity check?',
            'Which documents do reviewers see?', 'My upload failed', 'Can I replace a document?',
        ],
        'body' => "In **step 5** you upload the files reviewers will read.\n\n"
            ."## What to upload\n"
            ."- the **proposal document** (the full proposal);\n"
            ."- the **budget spreadsheet**;\n"
            ."- a **CV** or other documents if the call asks for them.\n\n"
            ."Reviewers see only the proposal document and the budget spreadsheet.\n\n"
            ."## Formats and size\n"
            ."PDF is recommended; DOC, DOCX, XLS, XLSX, JPG and PNG are also accepted. Each file can be up to **20 MB**.\n\n"
            ."## Keep it anonymous\n"
            ."Blind review means reviewers must not know who wrote the proposal. **Remove names, emails and phone numbers** of your team from the proposal document. On submission the system scans the documents reviewers will see and flags anything that identifies you — the office may return the proposal to fix it.\n\n"
            ."## Good to know\n"
            ."You can replace files while it's a draft. After submission documents **can't be deleted**.",
        'page_paths' => ['/proposals/create'],
    ],
    [
        'slug' => 'ai-writing-coach', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Getting feedback before you submit',
        'summary' => 'Check my proposal gives private suggestions against the call\'s scoring criteria.',
        'keywords' => 'ai coach feedback check my proposal suggestions improve before submitting writing',
        'questions' => [
            'Can I get feedback on my proposal before submitting?', 'What does Check my proposal do?', 'Do reviewers see the AI feedback?',
            'Does the feedback affect my score?', 'How many times can I check my proposal?', 'Why don\'t I see Check my proposal?',
        ],
        'body' => "On the last step of the wizard, **Check my proposal** (when the office has switched it on) reads your proposal and compares it with the call's **blind-review criteria** — the same questions reviewers will score.\n\n"
            ."## What you get\n"
            ."- an overall verdict: *Looks ready*, *Almost there* or *Needs more work*;\n"
            ."- an assessment and a suggestion for **each criterion**;\n"
            ."- anything **missing**, your **strengths**, and whether the **budget** fits the activities.\n\n"
            ."## Good to know\n"
            ."- **Only your team sees it.** Reviewers never see it and it **doesn't affect your score**.\n"
            ."- You can check up to **5 times a day** per proposal.\n"
            ."- Upload your proposal document first — the feedback is much better when it can read the full text.\n"
            ."- It's a second opinion, not a rule: AI can be wrong.",
        'page_paths' => ['/proposals/create'],
    ],
    [
        'slug' => 'cannot-submit', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Why can\'t I submit my proposal?',
        'summary' => 'Common reasons: missing items, deadline passed, pending co-investigators, or an overdue report.',
        'keywords' => 'cannot submit blocked error not allowed submit button disabled eligibility deadline passed overdue report active grants',
        'questions' => [
            'Why is the submit button disabled?', 'Why can\'t I submit?', 'It says I have an overdue report',
            'The deadline passed, can I still submit?', 'It says I have too many active grants', 'It says funds are unsettled',
            'It says my co-investigator hasn\'t accepted', 'It says I reached the limit for this call',
        ],
        'body' => "The submit step shows a checklist, and the page explains any block with a link to fix it.\n\n"
            ."## Missing information\n"
            ."Title, abstract (100+ characters), at least one co-investigator, budget lines and the documents must all be complete.\n\n"
            ."## Team not ready\n"
            ."Every invited co-investigator must **accept**. Remove anyone who declined.\n\n"
            ."## Deadline passed\n"
            ."The call has closed. Request a **deadline extension** from your draft if you have a good reason.\n\n"
            ."## Obligations on earlier projects\n"
            ."You can prepare a draft, but can't submit a new proposal while you have:\n"
            ."- an **overdue progress report** on a funded project;\n"
            ."- **funds released but not settled** past the allowed time (if the office uses this rule);\n"
            ."- reached the **maximum number of active grants** (if set).\n\n"
            ."Fix the item shown and you can submit. A proposal returned for corrections can always be resubmitted.\n\n"
            ."## Call limit\n"
            .'Some calls allow only a set number of proposals per PI.',
        'page_paths' => ['/proposals/create'],
    ],
    [
        'slug' => 'draft-deadline-extension', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Asking for more time to submit',
        'summary' => 'Request a deadline extension for your draft from the proposal page.',
        'keywords' => 'extension more time late deadline passed submit late extend draft missed',
        'questions' => [
            'Can I get more time to submit?', 'How do I request a deadline extension?', 'I missed the deadline',
            'Who approves deadline extensions?', 'How long does an extension take to approve?', 'Can I submit after my extension is approved?',
        ],
        'body' => "If you can't finish before the call closes, ask for more time.\n\n"
            ."## Step by step\n"
            ."1. Open your draft from **My Proposals**.\n"
            ."2. Click **Request deadline extension**.\n"
            ."3. Choose the date you need and explain why.\n\n"
            ."A director or the central office reviews the request and you're notified. If approved, you can submit until the new date even though the call has closed for others.\n\n"
            ."## Good to know\n"
            ."Ask as early as possible and give a clear reason — extensions aren't guaranteed.",
        'page_paths' => ['/my-proposals'],
    ],
    [
        'slug' => 'track-proposal', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Following your proposal\'s progress',
        'summary' => 'Use the status guide on the proposal page or your tracker number.',
        'keywords' => 'status where is my proposal progress stage tracker number timeline when result how long stuck',
        'questions' => [
            'Where is my proposal?', 'What stage is my proposal at?', 'How long does review take?', 'When will I get a result?',
            'What is a tracker number?', 'Where do I get my tracker number?', 'My proposal has been at the same stage for a long time',
            'Can someone else check my proposal status?', 'What do the stages mean?',
        ],
        'body' => "Open your proposal from **My Proposals**. At the top, the **status guide** shows the journey, what's happening now, how long that stage usually takes, and anything you need to do.\n\n"
            ."## The stages\n"
            ."1. **Validation** — the office checks completeness and eligibility (about 1 week).\n"
            ."2. **Blind review** — independent reviewers score it anonymously (about 3 weeks).\n"
            ."3. **Open defence** — you present to a panel (scheduled within about 2 weeks of passing blind review).\n"
            ."4. **Central evaluation** — the committee makes the funding decision (about 2 weeks).\n"
            ."5. **Project** — funded work, reports and evaluations, then completion.\n\n"
            ."From submission to a funding decision usually takes **about ten weeks**.\n\n"
            ."## Tracker number\n"
            ."You get a **tracker number** (e.g. *RES-2026-2027-000123*) when you submit. Anyone can enter it on the public **Track Proposal** page to see the stage — no login needed. You can also ask this assistant *\"Where is my proposal?\"*.\n\n"
            ."## If it seems stuck\n"
            .'The status guide says when a stage is taking longer than usual. The office tracks delays and is reminded automatically; you can also contact them.',
        'page_paths' => ['/my-proposals', '/proposals'], 'action_label' => 'Open my proposals', 'action_url' => '/my-proposals',
    ],
    [
        'slug' => 'returned-for-corrections', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'My proposal was returned for corrections',
        'summary' => 'Fix what the validation office asked for and resubmit — you keep the same tracker number.',
        'keywords' => 'returned revision correction resubmit sent back fix edit after submission',
        'questions' => [
            'My proposal was returned, what do I do?', 'How do I resubmit?', 'Will I get a new tracker number?',
            'Where is the reason it was returned?', 'Is there a deadline for resubmitting?', 'Does the office see what I changed?',
        ],
        'body' => "If the validation office returns your proposal, it goes back to **draft** with a note explaining what to fix — often a missing item or identifying details in the documents.\n\n"
            ."## Step by step\n"
            ."1. Open the proposal from **My Proposals** and read the note at the top.\n"
            ."2. Make the corrections in the wizard.\n"
            ."3. Submit again.\n\n"
            ."## Good to know\n"
            ."- You keep the **same tracker number**.\n"
            ."- The office sees **exactly what changed** since your last submission, so focus on what was asked.\n"
            ."- Resubmit promptly — the rules about other obligations don't block a resubmission.",
        'page_paths' => ['/my-proposals'],
    ],
    [
        'slug' => 'open-defence-presenter', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Preparing for your open defence',
        'summary' => 'Proposals that pass blind review are presented to a panel on a scheduled day.',
        'keywords' => 'defence defense presentation panel present schedule venue date what is open defence my defence when presenter who scores applicant',
        'questions' => [
            'What is the open defence?', 'When is my defence?', 'How do I prepare for the defence?', 'Who scores the defence?',
            'How long is the presentation?', 'Where is my defence held?', 'Can I present online?', 'How is the defence score used?',
        ],
        'body' => "If your proposal passes blind review, your **college officer schedules an open defence** where you present it to a panel.\n\n"
            ."## Before the day\n"
            ."- You're notified of the **date, time and venue** (or online link); they also show in your status guide and calendar.\n"
            ."- Prepare a clear presentation of your problem, objectives, methods, budget and expected results.\n"
            ."- Be ready to answer questions — panel members score you on the defence criteria.\n\n"
            ."## On the day and after\n"
            ."Panel members score during the session or **by the end of the following day**. When all scores are in, your **blind review and defence scores are combined** and compared with the pass mark. If it passes, your proposal moves to **central evaluation**.\n\n"
            ."## Good to know\n"
            ."Follow your college officer's instructions on presentation length and format.",
    ],
    [
        'slug' => 'scores-and-comments', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'Seeing your scores and reviewer comments',
        'summary' => 'The Reviews tab shows each reviewer\'s scores and comments once results are in.',
        'keywords' => 'scores marks results reviewer comments feedback see my score pass mark threshold how calculated',
        'questions' => [
            'Where can I see my scores?', 'Can I see what reviewers said?', 'Why did I get a low score?',
            'How is the final score calculated?', 'What is the pass mark?', 'Can I know who reviewed my proposal?',
            'Why does my score look different from what I expected?',
        ],
        'body' => "Open your proposal and go to the **Reviews** tab.\n\n"
            ."## What you see\n"
            ."Each reviewer's score per criterion and their **comments**. Reviewers stay **anonymous**.\n\n"
            ."## How the result is decided\n"
            ."1. **Blind review:** when all reviewers have scored, their average is compared with the **blind review pass mark**. Below it, the proposal isn't selected; above it, it goes to open defence.\n"
            ."2. **Open defence:** when the panel has scored, the **blind and defence scores are added** and compared with the **combined pass mark**.\n"
            ."3. **Central evaluation:** proposals that pass are ranked, and the committee decides funding within the call's budget.\n\n"
            ."## Good to know\n"
            ."Pass marks are set by the central office. If reviewers disagree strongly, an officer looks at the proposal before it's decided.",
    ],
    [
        'slug' => 'decision-and-appeal', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'If your proposal was not selected',
        'summary' => 'See the reason and reviewer comments, and ask for reconsideration or file a complaint.',
        'keywords' => 'rejected not selected decline appeal complaint reconsider reason unfair',
        'questions' => [
            'Why was my proposal rejected?', 'How do I appeal?', 'Can I ask for reconsideration?', 'How do I file a complaint?',
            'Can I apply again next year?', 'Is there a deadline to appeal?', 'Who decides on appeals?', 'What is the difference between an appeal and a complaint?',
        ],
        'body' => "Open the proposal: the status guide shows the **reason given**, and the **Reviews** tab shows reviewers' scores and comments.\n\n"
            ."## Your options\n"
            ."- **Request reconsideration (appeal):** if you believe the decision itself was wrong — for example a scoring error. Directors or the central office review it and can reopen the proposal.\n"
            ."- **File a complaint:** if you're concerned about how the process was handled.\n\n"
            ."Both are started from the proposal page. Explain clearly what you think went wrong and why.\n\n"
            ."## Next time\n"
            ."Use the reviewers' comments to strengthen the proposal and apply to a future call. **Check my proposal** can help before you submit.",
    ],
    [
        'slug' => 'complaints', 'category' => $c,
        'title' => 'Filing and following a complaint',
        'summary' => 'Raise a concern, follow its status, and withdraw it if it\'s resolved.',
        'keywords' => 'complaint concern grievance report problem escalate withdraw respond',
        'questions' => [
            'How do I make a complaint?', 'Who handles complaints?', 'How do I check my complaint status?',
            'Can I withdraw a complaint?', 'How long does it take to get a response?', 'What if I\'m not happy with the response?',
        ],
        'body' => "Open **Complaints** (or **File a complaint** on a proposal) and describe the problem clearly, including dates and anything that supports your concern.\n\n"
            ."## What happens\n"
            ."- The complaint is assigned to an officer, who reviews it and **responds**.\n"
            ."- Its status moves from **Open** to **Under Review** to **Resolved**.\n"
            ."- If needed, it can be **escalated** to a higher level.\n"
            ."- You're notified of each response.\n\n"
            ."## Good to know\n"
            ."You can **withdraw** a complaint at any time if it's no longer needed.",
        'page_paths' => ['/complaints'], 'action_label' => 'Open complaints', 'action_url' => '/complaints',
    ],
];
