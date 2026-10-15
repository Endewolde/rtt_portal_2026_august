<?php

namespace Database\Seeders;

use App\Models\HelpArticle;
use Illuminate\Database\Seeder;

/**
 * The help centre's content, with the questions people ask about each feature.
 *
 * Re-running is safe: new articles are added, articles the office has never edited are
 * refreshed with the latest wording, and any article an admin has edited is left alone.
 */
class HelpArticleSeeder extends Seeder
{
    private const RESEARCHER = ['staff'];

    private const REVIEWER = ['staff', 'external_reviewer'];

    private const COLLEGE = ['college_officer', 'central_officer'];

    private const DIRECTORS = ['research_officer', 'community_officer', 'technology_officer', 'central_officer'];

    private const OFFICERS = ['college_officer', 'research_officer', 'community_officer', 'technology_officer', 'central_officer'];

    private const CENTRAL = ['central_officer'];

    private const FINANCE = ['finance_officer', 'central_officer'];

    private const ADMIN = ['super_admin', 'admin'];

    private const SUPER = ['super_admin'];

    public function run(): void
    {
        foreach ($this->articles() as $i => $data) {
            $data['questions'] = implode("\n", $data['questions'] ?? []);
            $data += ['sort_order' => $i, 'is_published' => true, 'roles' => null, 'page_paths' => null, 'action_label' => null, 'action_url' => null, 'keywords' => null];

            $article = HelpArticle::where('slug', $data['slug'])->first();
            if (! $article) {
                HelpArticle::create($data);

                continue;
            }

            // Never overwrite an article someone has edited in the admin screen.
            if ($article->updated_at && $article->created_at && $article->updated_at->ne($article->created_at)) {
                continue;
            }

            $article->fill($data);
            if ($article->isDirty()) {
                $article->save();
                // Keep it marked as "not edited by a person" so future runs can still refresh it.
                HelpArticle::whereKey($article->id)->update(['updated_at' => $article->created_at]);
            }
        }
    }

    /** @return list<array<string, mixed>> */
    private function articles(): array
    {
        return [
            ...$this->gettingStarted(),
            ...$this->proposals(),
            ...$this->fundedProjects(),
            ...$this->reviewing(),
            ...$this->collegeOfficers(),
            ...$this->decisions(),
            ...$this->finance(),
            ...$this->monitoring(),
            ...$this->eventsAndFunds(),
            ...$this->reports(),
            ...$this->administration(),
        ];
    }

    private function gettingStarted(): array
    {
        $c = 'Getting started';

        return [
            [
                'slug' => 'getting-around', 'category' => $c,
                'title' => 'Finding your way around the platform',
                'summary' => 'The sidebar, the dashboard, notifications, search and the Ask assistant.',
                'keywords' => 'navigation menu sidebar start begin overview dashboard search find home',
                'questions' => ['Where do I start?', 'How do I find a page?', 'What is on the dashboard?', 'Is there a search?', 'Where is the menu?'],
                'body' => "The **sidebar** on the left lists everything your role can use, grouped into sections such as Proposals, Review & Evaluation, Budget and Reports. The **Dashboard** shows what needs your attention first.\n\n- The **bell** at the top shows notifications; click one to jump to the related item.\n- Press **Ctrl+K** (⌘K on a Mac) to search for any page by name.\n- Click **Ask** at the bottom right of any page to ask a question, or open the **Help Centre** from the sidebar.\n- Collapse the sidebar with **Collapse Sidebar** at the bottom for more room.",
                'page_paths' => ['/dashboard'], 'action_label' => 'Open dashboard', 'action_url' => '/dashboard',
            ],
            [
                'slug' => 'sign-in', 'category' => $c,
                'title' => 'Signing in, SSO and forgotten passwords',
                'summary' => 'Sign in with your university Google or Microsoft account, or with email and password.',
                'keywords' => 'login sign in sso google microsoft password forgot reset locked account register create account',
                'questions' => ['How do I log in?', 'I forgot my password', 'How do I reset my password?', 'Can I sign in with Google or Microsoft?', 'My account is locked', 'How do I create an account?', 'Why does it say my account is not active?'],
                'body' => "On the sign-in page choose **Sign in with Google** or **Sign in with Microsoft** to use your university account, or enter your email and password.\n\n- **Forgot your password?** Click *Forgot password* and follow the link sent to your email.\n- **Locked out?** Several wrong passwords lock the account for a short time — wait and try again.\n- **New here?** Use **Create Account** with your university email, then confirm the email we send you.\n- If it says your account isn't active, contact the Research & Technology Transfer office.",
            ],
            [
                'slug' => 'two-step-login', 'category' => $c,
                'title' => 'Two-step sign-in and active sessions',
                'summary' => 'Turn on an emailed sign-in code, see where you are signed in and sign out other devices.',
                'keywords' => 'two factor 2fa security code verification sessions devices sign out logout other devices',
                'questions' => ['How do I turn on two-factor authentication?', 'What is the 6-digit code?', 'How do I sign out of other devices?', 'Where can I see my active sessions?', 'How do I change my password?'],
                'body' => "Open **My Profile**.\n\n- **Security → Two-Factor Authentication:** when on, you receive a 6-digit code by email each time you sign in with a password.\n- **Change Password:** set a new password (you'll need your current one).\n- **Active Sessions:** see the devices where you're signed in and sign out any you don't recognise.\n\nIf you sign in with Google or Microsoft, two-step security is handled by your university account.",
                'page_paths' => ['/profile'], 'action_label' => 'Open my profile', 'action_url' => '/profile',
            ],
            [
                'slug' => 'profile', 'category' => $c,
                'title' => 'Updating your profile and research expertise',
                'summary' => 'Keep your name, title, department and expertise current — expertise helps match you to reviews.',
                'keywords' => 'profile name title photo avatar department college phone expertise areas update edit',
                'questions' => ['How do I change my name or title?', 'How do I update my department?', 'How do I add my research expertise?', 'Why should I fill in expertise areas?', 'How do I change my photo?'],
                'body' => "Open **My Profile** to update your personal information, academic title, college and department, phone number and photo.\n\nAdd your **Research Expertise Areas** — they're used to suggest you as a reviewer for proposals in your field, so keep them specific (e.g. *soil fertility*, *machine learning*).",
                'page_paths' => ['/profile'], 'action_label' => 'Open my profile', 'action_url' => '/profile',
            ],
            [
                'slug' => 'notifications', 'category' => $c,
                'title' => 'Notifications, emails and digests',
                'summary' => 'Where notifications appear and how to choose email, in-app alerts or a daily or weekly digest.',
                'keywords' => 'alerts emails bell digest messages notify inbox too many emails turn off',
                'questions' => ['Where are my notifications?', 'How do I stop so many emails?', 'Can I get a daily summary instead?', 'Why didn\'t I get an email?', 'How do I mark notifications as read?'],
                'body' => "Important events — a decision, a review assignment, a deadline — appear under the **bell** and on the **Notifications** page, and are emailed to you.\n\nTo change what you receive, open **My Profile → Notification Preferences**:\n\n- switch **email** or **in-app** notifications on or off;\n- choose a **daily or weekly digest** instead of individual emails.\n\nIf an email didn't arrive, check your spam folder — the notification is always kept under the bell.",
                'page_paths' => ['/notifications', '/profile'], 'action_label' => 'Open notifications', 'action_url' => '/notifications',
            ],
            [
                'slug' => 'calendar', 'category' => $c,
                'title' => 'Your calendar and adding deadlines to Google or Outlook',
                'summary' => 'See deadlines and events in one calendar and export them to your own calendar app.',
                'keywords' => 'calendar deadlines events schedule ical ics google outlook export subscribe',
                'questions' => ['Where can I see all my deadlines?', 'Can I add deadlines to Google Calendar?', 'How do I export to Outlook?', 'What is shown on the calendar?'],
                'body' => "Open **Calendar** from the sidebar to see call deadlines, review due dates, defences and other events relevant to you.\n\nClick **Export iCal** to download them as a file you can import into Google Calendar, Outlook or Apple Calendar.",
                'page_paths' => ['/calendar'], 'action_label' => 'Open calendar', 'action_url' => '/calendar',
            ],
            [
                'slug' => 'research-hub', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'My Research Hub',
                'summary' => 'Your proposals, pending reviews, outputs, awards and deadlines on one page.',
                'keywords' => 'research hub overview summary my research portfolio',
                'questions' => ['Where can I see all my research activity?', 'What is My Research Hub?', 'How much funding have I been awarded?'],
                'body' => "**My Research Hub** brings together your active proposals, pending reviews, recorded research outputs, total funding awarded and upcoming deadlines.\n\nUse it as your starting point each week.",
                'page_paths' => ['/researcher-hub'], 'action_label' => 'Open my research hub', 'action_url' => '/researcher-hub',
            ],
            [
                'slug' => 'install-app', 'category' => $c,
                'title' => 'Installing the platform as an app on your phone',
                'summary' => 'Add the platform to your home screen for full-screen use, e.g. when scoring a defence.',
                'keywords' => 'mobile phone android iphone home screen install app pwa tablet',
                'questions' => ['Is there a mobile app?', 'How do I install it on my phone?', 'Can I use it on Android or iPhone?', 'Does it work offline?'],
                'body' => "**Android (Chrome):** open the platform, tap the ⋮ menu and choose **Install app** or **Add to Home screen**.\n\n**iPhone (Safari):** tap the Share button and choose **Add to Home Screen**.\n\nThe app opens full screen with shortcuts to My Reviews and Notifications. It needs an internet connection; nothing private is stored on the phone.",
            ],
            [
                'slug' => 'language', 'category' => $c,
                'title' => 'Switching to Amharic',
                'summary' => 'Use the EN / አማ switch to change the language of the interface.',
                'keywords' => 'amharic english language translate አማርኛ switch',
                'questions' => ['Can I use the system in Amharic?', 'How do I change the language?', 'Why is some text still in English?'],
                'body' => "On the public site, use the **EN / አማ** switch in the top bar (or in the menu on a phone). Your choice is remembered on that device.\n\nMain screens and your proposal's status guide are translated. Text entered by staff — call descriptions, FAQs, thematic areas — stays in the language it was written in.",
            ],
            [
                'slug' => 'my-data', 'category' => $c,
                'title' => 'Downloading or deleting your personal data',
                'summary' => 'Get a copy of your data or ask for your account to be removed.',
                'keywords' => 'privacy personal data download export delete account remove gdpr',
                'questions' => ['How do I download my data?', 'How do I delete my account?', 'What happens to my proposals if I delete my account?', 'Why can\'t my account be deleted yet?'],
                'body' => "Open **My Profile → Your Data & Privacy**.\n\n- **Download** gives you a file with your profile, proposals, team memberships, reviews and notifications.\n- **Request deletion** sends a request to the administrators. Your name, contact details and sign-in are removed; proposals and reviews you took part in stay as university records without identifying you.\n\nDeletion can't happen while you have active proposals, unfinished reviews or unsettled funds.",
                'page_paths' => ['/profile'], 'action_label' => 'Open my profile', 'action_url' => '/profile',
            ],
            [
                'slug' => 'public-website', 'category' => $c,
                'title' => 'What the public website offers',
                'summary' => 'Open calls, proposal tracking, certificate checks, the repository, conferences and downloads.',
                'keywords' => 'public website homepage visitors track explore repository downloads funding opportunities showcase',
                'questions' => ['What can people see without logging in?', 'Where are the open calls listed publicly?', 'Can I track a proposal without logging in?', 'Where can I download forms and guidelines?'],
                'body' => "Anyone can use the public site without signing in:\n\n- **Open Calls** and **Funding Opportunities** — current university and external funding.\n- **Track Proposal** — check a proposal's stage with its tracker number.\n- **Verify Certificate** — confirm a reviewer certificate is genuine.\n- **Repository**, **Explore** and **Research Showcase** — completed and funded research.\n- **Conferences** — events and abstract submission.\n- **Downloads** — guidelines, templates and forms.",
            ],
        ];
    }

    private function proposals(): array
    {
        $c = 'Proposals';

        return [
            [
                'slug' => 'submit-proposal', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Submitting a research proposal',
                'summary' => 'Choose an open call, complete the 7-step wizard, then submit before the deadline.',
                'keywords' => 'apply application new proposal create wizard submit call how to apply start',
                'questions' => ['How do I apply for funding?', 'How do I submit a proposal?', 'How do I start a new proposal?', 'What are the steps to submit?', 'Can I save my proposal and finish later?'],
                'body' => "1. Go to **Proposals → New Proposal** and choose an open call.\n2. Complete each step: basic information, PI details, co-investigators, budget, documents and review.\n3. On the last step, use **Check my proposal** (if available) for private feedback, tick the confirmation and click **Submit Proposal**.\n\nYou can **Save as Draft** at any time and come back later from **My Proposals**. Once submitted you receive a **tracker number** to follow your proposal.",
                'page_paths' => ['/proposals/create', '/my-proposals'], 'action_label' => 'Start a proposal', 'action_url' => '/proposals/create',
            ],
            [
                'slug' => 'choosing-a-call', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Choosing the right call',
                'summary' => 'Read each call\'s category, eligibility, guidelines and deadline before you start.',
                'keywords' => 'call which call eligibility guidelines category research community engagement technology transfer limit',
                'questions' => ['Which call should I apply to?', 'Where are the call guidelines?', 'Am I eligible for this call?', 'How many proposals can I submit to one call?', 'What is the difference between research, community engagement and technology transfer?'],
                'body' => "Each call has a **category** (research, community engagement or technology transfer), an **eligibility** statement, a **guidelines** document and a **deadline**. Read the guidelines before starting — reviewers score against them.\n\nSome calls limit **how many proposals each PI may submit**; the page tells you if you've reached the limit.",
                'page_paths' => ['/proposals/create'], 'action_label' => 'See open calls', 'action_url' => '/proposals/create',
            ],
            [
                'slug' => 'co-investigators', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Adding co-investigators to your team',
                'summary' => 'Invite colleagues in step 3; each must accept before you can submit.',
                'keywords' => 'team members co-pi coinvestigator invite collaborator colleague add member remove',
                'questions' => ['How do I add a co-investigator?', 'How do I invite team members?', 'Why can\'t I find my colleague?', 'My co-investigator declined, what now?', 'How many co-investigators do I need?'],
                'body' => "In **step 3** of the proposal wizard, search for colleagues by name and invite them. They must already have an account on the platform.\n\nEach invited co-investigator gets a notification and **must accept** before the proposal can be submitted. At least one co-investigator is required. If someone declines, remove or replace them.",
                'page_paths' => ['/proposals/create'],
            ],
            [
                'slug' => 'budget-in-proposal', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Preparing your proposal budget',
                'summary' => 'Add budget lines with amounts and a justification for each in step 4.',
                'keywords' => 'budget lines cost items amount justification equipment travel personnel step 4',
                'questions' => ['How do I add budget items?', 'What should I write as justification?', 'Is there a budget limit?', 'Can I change the budget after submitting?'],
                'body' => "In **step 4**, add each cost as a budget line: category, description, amount and a short **justification** linking it to your activities. Reviewers check that the budget matches the work.\n\nRespect any limits in the call guidelines. After funding, changes need a **budget revision** request.",
                'page_paths' => ['/proposals/create'],
            ],
            [
                'slug' => 'documents', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Uploading proposal documents',
                'summary' => 'Which files to upload, accepted formats, and keeping blind review anonymous.',
                'keywords' => 'upload file pdf docx document attachment cv budget spreadsheet format size anonymous',
                'questions' => ['What documents do I need to upload?', 'What file types are accepted?', 'Can I put my name in the proposal document?', 'Can I delete a document after submitting?', 'What is the anonymity check?'],
                'body' => "In **step 5**, upload the proposal document and budget spreadsheet (plus a CV if the call asks for one). PDF is recommended; DOC, DOCX, XLS, XLSX, JPG and PNG are also accepted.\n\n**Keep the proposal document anonymous:** don't include names, emails or phone numbers of the team. On submission the system checks the documents reviewers will see and flags anything that identifies you.\n\nAfter submission, documents can't be deleted.",
                'page_paths' => ['/proposals/create'],
            ],
            [
                'slug' => 'ai-writing-coach', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Getting feedback before you submit',
                'summary' => 'Check my proposal gives private suggestions against the call\'s scoring criteria.',
                'keywords' => 'feedback check review my proposal coach suggestions improve before submit ai check my proposal does',
                'questions' => ['Can I get feedback on my proposal before submitting?', 'What does Check my proposal do?', 'Do reviewers see the AI feedback?', 'Does the feedback affect my score?'],
                'body' => "On the last step of the wizard, **Check my proposal** (when available) reads your proposal and compares it with the call's blind-review criteria. It suggests what to improve, lists anything missing and notes your strengths.\n\nOnly your team sees it. Reviewers never see it and it doesn't affect your score. It can be used a few times a day.",
                'page_paths' => ['/proposals/create'],
            ],
            [
                'slug' => 'cannot-submit', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Why can\'t I submit my proposal?',
                'summary' => 'Common reasons: missing items, deadline passed, pending co-investigators, or an overdue report.',
                'keywords' => 'cannot submit blocked error not allowed submit button disabled eligibility deadline passed',
                'questions' => ['Why is the submit button disabled?', 'Why can\'t I submit?', 'It says I have an overdue report', 'The deadline passed, can I still submit?', 'It says I have too many active grants'],
                'body' => "The most common reasons:\n\n- **Something is missing** — title, abstract, at least one co-investigator, budget lines or documents.\n- **A co-investigator hasn't accepted** their invitation yet.\n- **The call deadline has passed** — request a deadline extension if there's a good reason.\n- **You have an overdue progress report**, unsettled funds, or too many active grants on existing projects. The page shows the exact reason with a link to fix it.",
                'page_paths' => ['/proposals/create'],
            ],
            [
                'slug' => 'draft-deadline-extension', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Asking for more time to submit',
                'summary' => 'Request a deadline extension for your draft from the proposal page.',
                'keywords' => 'extension more time late deadline passed submit late extend draft',
                'questions' => ['Can I get more time to submit?', 'How do I request a deadline extension?', 'I missed the deadline', 'Who approves deadline extensions?'],
                'body' => "Open your draft from **My Proposals** and use **Request deadline extension**. Give the new date you need and the reason.\n\nA director or the central office reviews it. If approved you can submit until the new date.",
                'page_paths' => ['/my-proposals'],
            ],
            [
                'slug' => 'track-proposal', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Following your proposal\'s progress',
                'summary' => 'Use the status guide on the proposal page or your tracker number.',
                'keywords' => 'status where is my proposal progress stage tracker number timeline when result how long',
                'questions' => ['Where is my proposal?', 'What stage is my proposal at?', 'How long does review take?', 'When will I get a result?', 'What is a tracker number?', 'Where do I get my tracker number?'],
                'body' => "Open your proposal from **My Proposals**. At the top, the **status guide** shows the stages (Validation → Blind review → Open defence → Central evaluation → Project), what's happening now, how long it usually takes, and anything you need to do.\n\nAnyone can also check the stage with the **tracker number** on the public **Track Proposal** page — no login needed. You can also ask this assistant *“Where is my proposal?”*.",
                'page_paths' => ['/my-proposals', '/proposals'], 'action_label' => 'Open my proposals', 'action_url' => '/my-proposals',
            ],
            [
                'slug' => 'returned-for-corrections', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'My proposal was returned for corrections',
                'summary' => 'Fix what the validation office asked for and resubmit — you keep the same tracker number.',
                'keywords' => 'returned revision correction resubmit sent back fix edit after submission',
                'questions' => ['My proposal was returned, what do I do?', 'How do I resubmit?', 'Will I get a new tracker number?', 'Where is the reason it was returned?'],
                'body' => "If the validation office returns your proposal, it goes back to **draft** with a note explaining what to fix. Open it from **My Proposals**, make the changes and submit again.\n\nYou keep the **same tracker number**, and the office sees exactly what changed between versions.",
                'page_paths' => ['/my-proposals'],
            ],
            [
                'slug' => 'open-defence-presenter', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Preparing for your open defence',
                'summary' => 'Proposals that pass blind review are presented to a panel on a scheduled day.',
                'keywords' => 'defence defense presentation panel present schedule venue date what is open defence my defence when presenter who scores applicant',
                'questions' => ['What is the open defence?', 'When is my defence?', 'How do I prepare for the defence?', 'Who scores the defence?'],
                'body' => "If your proposal passes blind review, your **college officer schedules an open defence**. You'll be notified of the date, time and venue, and they appear in your status guide.\n\nOn the day you present to a panel, who score your presentation during the session or by the end of the following day. The blind review and defence scores are then combined for central evaluation.",
            ],
            [
                'slug' => 'scores-and-comments', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Seeing your scores and reviewer comments',
                'summary' => 'The Reviews tab shows each reviewer\'s scores and comments once results are in.',
                'keywords' => 'scores marks results reviewer comments feedback see my score',
                'questions' => ['Where can I see my scores?', 'Can I see what reviewers said?', 'Why did I get a low score?', 'How is the final score calculated?'],
                'body' => "Open your proposal and go to the **Reviews** tab to see each reviewer's scores per criterion and their comments. Reviewers stay anonymous.\n\nThe final score combines the blind review average and the open defence average, compared with the pass marks set by the central office.",
            ],
            [
                'slug' => 'decision-and-appeal', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'If your proposal was not selected',
                'summary' => 'See the reason and reviewer comments, and ask for reconsideration or file a complaint.',
                'keywords' => 'rejected not selected decline appeal complaint reconsider reason unfair',
                'questions' => ['Why was my proposal rejected?', 'How do I appeal?', 'Can I ask for reconsideration?', 'How do I file a complaint?', 'Can I apply again next year?'],
                'body' => "Open the proposal: the status guide shows the **reason given**, and the **Reviews** tab shows reviewers' scores and comments.\n\nIf you believe the decision was wrong, you can **request reconsideration** (an appeal) or file a **complaint** from the proposal page. Explain clearly which part of the process you think was mistaken. You're welcome to improve the proposal and apply to a future call.",
            ],
            [
                'slug' => 'complaints', 'category' => $c,
                'title' => 'Filing and following a complaint',
                'summary' => 'Raise a concern, follow its status, and withdraw it if it\'s resolved.',
                'keywords' => 'complaint concern grievance report problem escalate withdraw respond',
                'questions' => ['How do I make a complaint?', 'Who handles complaints?', 'How do I check my complaint status?', 'Can I withdraw a complaint?'],
                'body' => "Open **Complaints** (or use *File a complaint* on a proposal). Describe the problem clearly. Officers review it, respond, and may escalate it if needed. You can follow the status — Open, Under Review, Resolved — and **withdraw** it if it's no longer needed.",
                'page_paths' => ['/complaints'], 'action_label' => 'Open complaints', 'action_url' => '/complaints',
            ],
        ];
    }

    private function fundedProjects(): array
    {
        $c = 'Funded projects';

        return [
            [
                'slug' => 'after-funding', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Your proposal was funded — what happens next',
                'summary' => 'Sign the contract, get ethical clearance if required, then request your budget.',
                'keywords' => 'funded award grant contract next steps after approval money letter when get money award letter where',
                'questions' => ['My proposal was funded, what next?', 'When will I get the money?', 'Where is my award letter?', 'What do I have to do after funding?'],
                'body' => "1. **Sign and submit the research contract** from the proposal page. Funds are released only after it's approved.\n2. If your study needs it, **upload ethical clearance**.\n3. **Request your budget** in stages through Budget Requests once the allocation is approved.\n4. Submit a **progress report** every few months, take part in the **mid-term evaluation**, and present your results at the **completion workshop**.\n\nThe status guide on your proposal page always lists what's due next.",
                'page_paths' => ['/my-proposals', '/my-research'], 'action_label' => 'Open my funded projects', 'action_url' => '/my-research',
            ],
            [
                'slug' => 'research-contract', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Signing your research contract',
                'summary' => 'Sign and submit the contract from your proposal; officers approve it before funds are released.',
                'keywords' => 'contract sign signature agreement submit rejected resubmit',
                'questions' => ['How do I sign the contract?', 'Why was my contract rejected?', 'Do I need a contract before getting money?', 'Who approves the contract?'],
                'body' => "Open your funded proposal and follow the **contract** step on the Overview tab: review it, sign and submit. Officers check and approve it.\n\nIf it's **rejected**, the reason is shown — correct it and submit again. **No funds are released until the contract is approved.**",
                'page_paths' => ['/my-research'],
            ],
            [
                'slug' => 'ethical-clearance', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Ethical clearance for your study',
                'summary' => 'Upload your ethics certificate if your study needs one, and renew it before it expires.',
                'keywords' => 'ethics ethical clearance irb certificate approval human subjects expired expiry',
                'questions' => ['Do I need ethical clearance?', 'How do I upload my ethics certificate?', 'My ethical clearance expired', 'Why was my clearance rejected?'],
                'body' => "If your proposal says the study needs ethical clearance, upload the **certificate** (with its reference number and expiry date) from the proposal's Documents tab. Officers verify it.\n\nYou'll be reminded before it **expires** — upload a renewed certificate in time. A rejected certificate comes back with a reason.",
            ],
            [
                'slug' => 'progress-reports', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Submitting a progress report',
                'summary' => 'Report every few months from the Progress tab; overdue reports block new submissions.',
                'keywords' => 'progress report quarterly report final report milestones overdue due',
                'questions' => ['How do I submit a progress report?', 'When is my progress report due?', 'What do I write in a progress report?', 'My report was sent back for revision', 'What is the final report?'],
                'body' => "Open your funded proposal and go to the **Progress** tab. Each reporting period shows its due date. Click **Submit report**, describe what was done, problems, next steps, percent complete and spending, and update your milestones. The last period is the **final report**.\n\nOfficers accept the report or send it back for revision. **An overdue report stops you submitting new proposals** until it's in.",
                'page_paths' => ['/my-research'],
            ],
            [
                'slug' => 'budget-requests', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Requesting your budget',
                'summary' => 'Request funds in rounds; the request is signed and approved before money is released.',
                'keywords' => 'budget request money disbursement release funds round signature form',
                'questions' => ['How do I request my budget?', 'When will my money be released?', 'Why is my budget request pending?', 'What signatures does a budget request need?', 'How many funding rounds are there?'],
                'body' => "Once your allocation is approved and your contract signed, go to **Budget Requests** and create a request for the current **funding round**, listing the items you need.\n\nThe request collects the required **signatures**, then goes through college and finance approval. Finance then **disburses** the money. You can follow each step on the request's page.",
                'page_paths' => ['/budget-requests'], 'action_label' => 'Open budget requests', 'action_url' => '/budget-requests',
            ],
            [
                'slug' => 'settlements', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Settling the money you spent',
                'summary' => 'After spending a release, submit a settlement with your expense report.',
                'keywords' => 'settlement expense report receipts unspent liquidate account for money',
                'questions' => ['How do I settle my budget?', 'What is a settlement?', 'What documents do I need for settlement?', 'What happens to unspent money?'],
                'body' => "After spending a released round, submit a **settlement**: upload the **expense report**, enter the total spent and any unspent amount. The college verifies it, then finance gives final verification.\n\nUnsettled funds can block new proposals and stop the project being archived.",
                'page_paths' => ['/settlements'], 'action_label' => 'Open settlements', 'action_url' => '/settlements',
            ],
            [
                'slug' => 'extensions-and-changes', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Asking for more time or a budget change',
                'summary' => 'No-cost extensions extend the project; budget revisions move money between lines.',
                'keywords' => 'extension more time delay no cost extension budget revision change reallocate change my budget after funding',
                'questions' => ['Can I extend my project?', 'How do I change my budget?', 'What is a no-cost extension?', 'Can I move money between budget lines?'],
                'body' => "- **No-cost extension:** more time to finish the project, without extra money.\n- **Budget revision:** move money between budget lines.\n\nBoth are requested from your proposal page and approved by officers. Explain the reason clearly and attach supporting documents if you have them.",
            ],
            [
                'slug' => 'midterm-evaluation', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Your mid-term evaluation',
                'summary' => 'Present progress and spending mid-way through the project; upload your reports.',
                'keywords' => 'midterm mid-term evaluation progress financial report milestones hold',
                'questions' => ['What is the mid-term evaluation?', 'When is my mid-term evaluation?', 'What do I upload for the mid-term?', 'Why is my project on hold?'],
                'body' => "Mid-way through your project, officers schedule a **mid-term evaluation**. Upload your **progress report** and **financial report** (PDF), and list completed and missed milestones.\n\nThe evaluators add notes. If serious problems are found the project can be put **on hold** until they're resolved.",
            ],
            [
                'slug' => 'completion-workshop', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Completing your project',
                'summary' => 'Present your results at the completion workshop; the project is then completed and archived.',
                'keywords' => 'completion workshop final presentation finish project close archive results',
                'questions' => ['How do I finish my project?', 'What is the completion workshop?', 'What happens after my project is completed?', 'When is my project archived?'],
                'body' => "At the end of your project a **completion workshop** is scheduled. Upload your presentation or final report, present your results and answer questions. The evaluators record feedback and a score.\n\nAfter the workshop the project is **completed**, and it's archived 30 days later once outputs are recorded and funds are settled.",
            ],
            [
                'slug' => 'research-outputs', 'category' => $c, 'roles' => self::RESEARCHER,
                'title' => 'Recording publications and other outputs',
                'summary' => 'Record articles, books, patents, software and impact from your funded research.',
                'keywords' => 'outputs publications journal article paper patent book software prototype impact record',
                'questions' => ['How do I record a publication?', 'Where do I add my research outputs?', 'What counts as a research output?', 'Why do outputs matter?'],
                'body' => "Open **Research Outputs** and add each output from your funded project: journal article, conference paper, book, patent, software, prototype, community impact or technology transfer. Officers verify and approve them.\n\nAt least one recorded output is needed before a completed project can be archived, and outputs appear in university reports.",
                'page_paths' => ['/research-outputs'], 'action_label' => 'Open research outputs', 'action_url' => '/research-outputs',
            ],
        ];
    }

    private function reviewing(): array
    {
        $c = 'Reviewing';

        return [
            [
                'slug' => 'reviewer-agreement', 'category' => $c, 'roles' => self::REVIEWER,
                'title' => 'The reviewer confidentiality agreement',
                'summary' => 'Accept it once each academic year before you can open proposals to review.',
                'keywords' => 'agreement confidentiality accept cannot open review blocked nda why cannot open my review',
                'questions' => ['Why can\'t I open my review?', 'What is the confidentiality agreement?', 'Do I have to accept every year?', 'Where do I accept the agreement?'],
                'body' => "Before opening any proposal to review, you accept a short **confidentiality agreement** once per academic year: keep proposals and reviews confidential, don't use the ideas, don't try to identify blind-review authors, declare conflicts and review fairly.\n\nAccept it from the notice at the top of **My Reviews**.",
                'page_paths' => ['/reviews'], 'action_label' => 'Open my reviews', 'action_url' => '/reviews',
            ],
            [
                'slug' => 'scoring-blind-review', 'category' => $c, 'roles' => self::REVIEWER,
                'title' => 'Scoring a blind review',
                'summary' => 'Open the assignment from My Reviews, read the documents, score each criterion and submit.',
                'keywords' => 'score review blind review evaluate marks criteria submit review how to review proposal documents where documents reviewer',
                'questions' => ['How do I review a proposal?', 'How do I score a proposal?', 'Where are the proposal documents?', 'Can I change my score after submitting?', 'Will the applicants see my comments?'],
                'body' => "1. Go to **My Reviews** and open the assignment.\n2. Read the proposal document and budget in the **Documents** tab. The authors' names are hidden.\n3. On the **Score** tab, score every criterion and add comments that justify your scores — the research team sees the comments, but not your name.\n4. Submit before the due date. Submitted scores **cannot be changed**.",
                'page_paths' => ['/reviews'], 'action_label' => 'Open my reviews', 'action_url' => '/reviews',
            ],
            [
                'slug' => 'review-due-dates', 'category' => $c, 'roles' => self::REVIEWER,
                'title' => 'Review due dates and reminders',
                'summary' => 'Each review has a due date; you\'ll be reminded before and after it.',
                'keywords' => 'due date deadline late overdue reminder review time how long',
                'questions' => ['When is my review due?', 'What if I can\'t finish my review on time?', 'Why did I get a reminder?', 'Can I decline a review?'],
                'body' => "Each assignment in **My Reviews** shows its **due date**. You'll get reminders as it approaches and if it becomes overdue.\n\nIf you can't finish in time, contact the officer who assigned it — they can extend the date or reassign the review.",
                'page_paths' => ['/reviews'],
            ],
            [
                'slug' => 'conflict-of-interest', 'category' => $c, 'roles' => self::REVIEWER,
                'title' => 'Declaring a conflict of interest',
                'summary' => 'If you know or work with the applicants, declare it — you won\'t be able to score.',
                'keywords' => 'conflict of interest coi relative colleague know author declare withdraw',
                'questions' => ['What if I know the applicant?', 'How do I declare a conflict of interest?', 'What counts as a conflict of interest?', 'What happens after I declare a conflict?'],
                'body' => "If you recognise the work or have any relationship with the applicants — family, close collaborator, supervisor or student — **declare a conflict** on the assignment. The officers will reassign the review.\n\nWhen in doubt, declare it. It's never held against you.",
                'page_paths' => ['/reviews'],
            ],
            [
                'slug' => 'scoring-open-defence', 'category' => $c, 'roles' => self::REVIEWER,
                'title' => 'Scoring an open defence',
                'summary' => 'Score during the session or by the end of the next day; late scores need an extension.',
                'keywords' => 'defence defense panel score deadline late presentation open defence scoring',
                'questions' => ['How do I score a defence?', 'When can I score the open defence?', 'The defence scoring has closed', 'Can I score after the defence day?'],
                'body' => "Defence scoring opens on the day of the defence. Score in the room during the presentation, or **by the end of the following day**.\n\nAfter that, submissions close. If you have a good reason, contact your **college officer**, who can request a deadline extension. Installing the platform on your phone makes scoring in the room easier.",
                'page_paths' => ['/reviews'],
            ],
            [
                'slug' => 'reviewer-certificates', 'category' => $c, 'roles' => self::REVIEWER,
                'title' => 'Getting your certificate of review service',
                'summary' => 'Released each year by the central office for reviewers who meet the minimum.',
                'keywords' => 'certificate appreciation reviewer service download verify qr',
                'questions' => ['How do I get my reviewer certificate?', 'Why can\'t I download my certificate?', 'How many reviews do I need for a certificate?', 'How can someone verify my certificate?'],
                'body' => "Each academic year, once its reviews are finished, the central office **releases certificates** to reviewers who completed the minimum number of reviews. You'll be notified, and can download yours from **My Reviews**.\n\nEach certificate has a number and QR code that anyone can verify on the public **Verify Certificate** page.",
                'page_paths' => ['/reviews'], 'action_label' => 'Open my reviews', 'action_url' => '/reviews',
            ],
            [
                'slug' => 'abstract-reviewing', 'category' => $c, 'roles' => self::REVIEWER,
                'title' => 'Reviewing conference abstracts',
                'summary' => 'Abstracts assigned to you appear in My Reviews alongside proposal reviews.',
                'keywords' => 'abstract review conference abstract assigned score accept reject',
                'questions' => ['How do I review a conference abstract?', 'Where are my abstract reviews?'],
                'body' => "When conference organisers assign you an abstract, it appears in **My Reviews** under abstracts. Read it, give your recommendation and comments, and submit.",
                'page_paths' => ['/reviews'],
            ],
        ];
    }

    private function collegeOfficers(): array
    {
        $c = 'Managing reviews';

        return [
            [
                'slug' => 'assign-reviewers', 'category' => $c, 'roles' => self::COLLEGE,
                'title' => 'Assigning blind reviewers',
                'summary' => 'Pick reviewers for validated proposals, using suggestions and conflict warnings.',
                'keywords' => 'assign reviewers reviewer selection blind review assign add reviewer suggestions workload replace',
                'questions' => ['How do I assign reviewers?', 'How do I choose good reviewers?', 'What does Possible conflict mean?', 'How do I replace a reviewer?', 'How do I add another reviewer?', 'What is the workload limit?'],
                'body' => "Open **Blind Review** or the proposal's **Assign Reviewers** page.\n\n- **Suggested reviewers** are ranked by matching expertise, on-time record and current workload.\n- A **Possible conflict** badge means the reviewer is in the proposal's department or worked with the team recently. You can still assign them by confirming **Assign Anyway** — the confirmation is recorded.\n- Reviewers at the workload limit also need confirmation.\n\nSet a due date and assign. The proposal moves to blind review and reviewers are notified. To swap a reviewer later, use **Reassign** on the Blind Review page.",
                'page_paths' => ['/admin/blind-review', '/admin/assign-reviewers'], 'action_label' => 'Open blind review', 'action_url' => '/admin/blind-review',
            ],
            [
                'slug' => 'review-deadlines-admin', 'category' => $c, 'roles' => self::COLLEGE,
                'title' => 'Chasing late reviews',
                'summary' => 'See overdue reviews, send reminders, extend due dates or reassign.',
                'keywords' => 'overdue late reviews remind reminder extend due date chase reviewers',
                'questions' => ['How do I see overdue reviews?', 'How do I remind a reviewer?', 'How do I extend a review due date?', 'Can I remind all late reviewers at once?'],
                'body' => "Open **Review Deadlines** to see reviews that are due soon or overdue, with the reminder history. Send a **reminder** to one reviewer or to several at once, **extend** the due date, or **reassign** the review from Blind Review.",
                'page_paths' => ['/admin/review-deadlines'], 'action_label' => 'Open review deadlines', 'action_url' => '/admin/review-deadlines',
            ],
            [
                'slug' => 'coi-reassignment', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Handling declared conflicts of interest',
                'summary' => 'Reviewers who declared a conflict are listed for reassignment.',
                'keywords' => 'coi conflicts declared reassign reviewer conflict of interest dashboard',
                'questions' => ['A reviewer declared a conflict, what do I do?', 'Where are the conflict of interest reports?', 'How do I reassign a conflicted reviewer?'],
                'body' => "Open **COI Conflicts** to see reviewers who declared a conflict of interest. Use **Reassign Reviewer** to choose someone else; the conflict is then marked resolved.",
                'page_paths' => ['/admin/coi-conflicts'], 'action_label' => 'Open COI conflicts', 'action_url' => '/admin/coi-conflicts',
            ],
            [
                'slug' => 'reviewer-disagreement', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'When blind reviewers strongly disagree',
                'summary' => 'Proposals with very different reviewer scores are held for an officer to decide.',
                'keywords' => 'disagreement disagree scores differ spread inconsistent reviewers held',
                'questions' => ['Why is this proposal held after blind review?', 'What does reviewer disagreement mean?', 'How do I resolve a disagreement?'],
                'body' => "If blind reviewers' scores differ by more than the set threshold, or fall on both sides of the pass mark, the automatic decision is **held**. Open the proposal, read the reviews and choose to pass or fail it, or add another reviewer. Your decision and note are recorded.",
                'page_paths' => ['/admin/blind-review'],
            ],
            [
                'slug' => 'schedule-defence', 'category' => $c, 'roles' => self::COLLEGE,
                'title' => 'Scheduling an open defence',
                'summary' => 'Once all your college\'s blind reviews are finished, schedule the defence and panel.',
                'keywords' => 'schedule defence defense panel venue date open defence add reviewer panel members',
                'questions' => ['How do I schedule a defence?', 'Why can\'t I schedule open defence yet?', 'How do I choose panel members?', 'How do I change the defence date?', 'How do I add a panel member?'],
                'body' => "Open defence can be scheduled once **all of your college's proposals have finished blind review**.\n\nFrom **Open Defence**, choose **Schedule Defence**, set the date, time and venue and pick the panel. Panel members are notified. Use **Add Reviewer** on the defence card to change the panel. Scores are due by the end of the day after the defence.",
                'page_paths' => ['/admin/open-defence'], 'action_label' => 'Open open defence', 'action_url' => '/admin/open-defence',
            ],
            [
                'slug' => 'defence-deadline-extension', 'category' => $c, 'roles' => [...self::COLLEGE, ...self::DIRECTORS],
                'title' => 'Extending a defence scoring deadline',
                'summary' => 'Request it on the defence card; a director or the central office approves.',
                'keywords' => 'extension late score deadline passed defence extend panel member late',
                'questions' => ['A panel member missed the scoring deadline', 'How do I extend the defence deadline?', 'Who approves defence extensions?'],
                'body' => "If a panel member couldn't score in time for a good reason, use **Request extension** on the proposal's defence card on **Open Defence**. Give the new deadline and the reason.\n\nThe category director or the central office approves it under **Defence Extensions**. Once approved, the panel member can submit.",
                'page_paths' => ['/admin/open-defence', '/admin/defence-extensions'],
            ],
            [
                'slug' => 'defence-record', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Printing the defence record',
                'summary' => 'Download a one-page PDF of the session, panel scores and outcome for signatures.',
                'keywords' => 'defence record minutes pdf print sign file report session',
                'questions' => ['How do I get the defence minutes?', 'Is there a defence report to sign?', 'Where is the defence record PDF?'],
                'body' => "On **Open Defence** (or a proposal's Reviews tab), click **Defence record**. The PDF lists the session date and venue, the proposal and team, each panel member's score and comments, the combined result and the outcome, with signature lines for filing.",
                'page_paths' => ['/admin/open-defence'],
            ],
            [
                'slug' => 'college-progress', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Following your college\'s progress',
                'summary' => 'See how many proposals are at each stage, per college.',
                'keywords' => 'college phase completion progress pipeline stage counts dashboard',
                'questions' => ['How many of my college\'s proposals are reviewed?', 'Which proposals are still waiting?', 'Where is the college dashboard?'],
                'body' => "- **College Phase Completion** shows, for each college, how many proposals are waiting for assignment, in blind review, in open defence, reviewed or rejected.\n- **Proposal Pipeline** shows every proposal by status.\n- **College Research Dashboard** summarises your college's proposals by department, category and outcome.",
                'page_paths' => ['/admin/college-phase-completion', '/admin/proposal-pipeline', '/reports/college-dashboard'],
            ],
            [
                'slug' => 'report-mistaken-approval', 'category' => $c, 'roles' => ['college_officer'],
                'title' => 'Reporting a mistaken approval',
                'summary' => 'If a proposal was approved by mistake, report it with the issue type for review.',
                'keywords' => 'mistake wrong approval report error approved by mistake undo',
                'questions' => ['A proposal was approved by mistake', 'How do I report a wrong approval?', 'Can I cancel my report?'],
                'body' => "If a proposal was approved by mistake, use **Report mistaken approval** on the proposal, choose the issue and describe it. The proposal is held while the director reviews the report.\n\nYou can cancel the report while it's pending. The director decides whether the approval stands or is revoked.",
            ],
        ];
    }

    private function decisions(): array
    {
        $c = 'Decisions';

        return [
            [
                'slug' => 'manage-calls', 'category' => $c, 'roles' => self::CENTRAL,
                'title' => 'Creating and managing proposal calls',
                'summary' => 'Publish a call with its dates, category, limits, budget and guidelines.',
                'keywords' => 'call create new call publish close reopen guidelines deadline proposal calls submissions',
                'questions' => ['How do I create a new call?', 'How do I close a call?', 'How do I reopen a call?', 'How do I see submissions for a call?', 'How do I upload call guidelines?'],
                'body' => "Open **Proposal Calls** and create a call: title, academic year, category, start and end dates, the maximum proposals per PI, the **total funding budget** and the guidelines document. Published calls appear on the public site and in New Proposal.\n\nUse **Submissions** on a call to see what has been submitted. Calls close automatically at their end date and can be reopened.",
                'page_paths' => ['/proposal-calls'], 'action_label' => 'Open proposal calls', 'action_url' => '/proposal-calls',
            ],
            [
                'slug' => 'validation', 'category' => $c, 'roles' => self::DIRECTORS,
                'title' => 'Validating submitted proposals',
                'summary' => 'Check completeness, eligibility and the anonymity check, then approve, return or reject.',
                'keywords' => 'validate validation queue approve return correction submitted eligibility anonymity bulk',
                'questions' => ['How do I validate proposals?', 'How do I return a proposal for corrections?', 'What does the anonymity flag mean?', 'Can I approve several proposals at once?', 'How do I see what changed in a resubmission?'],
                'body' => "Open the **Validation Queue**. For each proposal check it's complete and fits the call. Look at the **anonymity check** badge — if it found identifying details, open the proposal to see what.\n\n- **Approve** sends it to blind review (you can approve several at once).\n- **Return for correction** sends it back to the PI with your note; when they resubmit you'll see exactly what changed.\n- **Reject** needs a reason from the list.",
                'page_paths' => ['/admin/validation-queue'], 'action_label' => 'Open validation queue', 'action_url' => '/admin/validation-queue',
            ],
            [
                'slug' => 'central-evaluation', 'category' => $c, 'roles' => self::DIRECTORS,
                'title' => 'Making funding decisions in Central Evaluation',
                'summary' => 'Use the merit list and call budget, read the reviews, then approve or reject.',
                'keywords' => 'central evaluation funding decision approve fund merit list ranking budget award',
                'questions' => ['How do I approve a proposal for funding?', 'What is the merit list?', 'How much budget is left in the call?', 'Can I award more than the call budget?', 'How do I reject at central evaluation?'],
                'body' => "Open **Central Evaluation**. The **Merit List & Budget** view ranks proposals by combined score per call and shows where the call's remaining budget runs out.\n\nOn each proposal, review the scores, budget, the PI's existing funding and the **AI summary of the reviews** (if available). Then **Approve for Funding** with the award amount, or **Reject** with a reason. Going over the call's budget needs explicit confirmation.",
                'page_paths' => ['/admin/central-evaluation'], 'action_label' => 'Open central evaluation', 'action_url' => '/admin/central-evaluation',
            ],
            [
                'slug' => 'award-and-letters', 'category' => $c, 'roles' => self::CENTRAL,
                'title' => 'Awards, grant references and grant letters',
                'summary' => 'Approving for funding creates the award; generate the grant letter from Grant Letters.',
                'keywords' => 'award grant letter reference number funding letter generate print template all funded proposals list funded',
                'questions' => ['How do I generate a grant letter?', 'Where do I find the grant reference number?', 'How do I see all funded proposals?'],
                'body' => "Approving a proposal for funding creates its **award** and **grant reference**. Open **Grant Letters** to prepare and print the official letter from the template (best done on a computer).\n\n**Proposal Funding** and **Awarded** list all funded proposals with their award details.",
                'page_paths' => ['/admin/grant-letters', '/admin/funding'], 'action_label' => 'Open grant letters', 'action_url' => '/admin/grant-letters',
            ],
            [
                'slug' => 'contracts-admin', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Approving research contracts',
                'summary' => 'Review submitted contracts and approve or return them.',
                'keywords' => 'contracts approve reject review contract status submitted',
                'questions' => ['How do I approve a contract?', 'Which contracts are pending?', 'How do I reject a contract?'],
                'body' => "Open **Contracts** to see every funded proposal's contract status: Not Submitted, Pending Review, Approved or Rejected. Open a pending contract, check it and approve it, or reject it with a reason so the PI can fix and resubmit.",
                'page_paths' => ['/admin/contracts'], 'action_label' => 'Open contracts', 'action_url' => '/admin/contracts',
            ],
            [
                'slug' => 'ethical-clearance-admin', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Verifying ethical clearance',
                'summary' => 'Approve or return uploaded ethics certificates and watch for expiries.',
                'keywords' => 'ethical clearance verify approve reject certificate expiry ethics',
                'questions' => ['How do I verify an ethics certificate?', 'Which projects need ethical clearance?', 'How do I see expired clearances?'],
                'body' => "Open **Ethical Clearance** to see projects that need it: Not Submitted, Awaiting Review, Approved or Rejected/Expired. Open a certificate to approve it, or **reject and return** it with a reason. PIs are reminded before their clearance expires.",
                'page_paths' => ['/admin/ethical-clearance'], 'action_label' => 'Open ethical clearance', 'action_url' => '/admin/ethical-clearance',
            ],
            [
                'slug' => 'extension-requests-admin', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Handling extension and budget change requests',
                'summary' => 'Approve or decline deadline extensions, no-cost extensions and budget revisions.',
                'keywords' => 'deadline extensions no-cost extension budget revision approve decline requests',
                'questions' => ['How do I approve a deadline extension?', 'How do I approve a no-cost extension?', 'How do I approve a budget revision?'],
                'body' => "- **Deadline Extensions:** PIs asking for more time to submit a draft.\n- **No-Cost Extensions:** more time to finish a funded project.\n- **Budget Revisions:** moving money between budget lines.\n- **Defence Extensions:** more time for panel members to score.\n\nOpen the page, read the reason and approve or decline with a note. The PI is notified.",
                'page_paths' => ['/admin/deadline-extensions', '/admin/no-cost-extensions', '/admin/budget-revisions'],
            ],
            [
                'slug' => 'appeals-admin', 'category' => $c, 'roles' => self::DIRECTORS,
                'title' => 'Resolving appeals',
                'summary' => 'Review reconsideration requests and record your decision for the applicant.',
                'keywords' => 'appeals reconsideration request resolve decision applicant reopen',
                'questions' => ['How do I handle an appeal?', 'Can a rejected proposal be reopened?', 'Where are reconsideration requests?'],
                'body' => "Open **Appeals** to see reconsideration requests. Read the applicant's reasons and the proposal's history, then **Resolve Appeal** with your decision and an explanation for the applicant. Where justified, a rejected proposal can be reopened.",
                'page_paths' => ['/admin/appeals'], 'action_label' => 'Open appeals', 'action_url' => '/admin/appeals',
            ],
            [
                'slug' => 'approval-reports-admin', 'category' => $c, 'roles' => self::DIRECTORS,
                'title' => 'Reviewing mistaken-approval reports',
                'summary' => 'Decide whether a reported approval stands or is revoked.',
                'keywords' => 'approval reports mistaken approval resolve stands revoked',
                'questions' => ['How do I resolve an approval report?', 'What happens if the approval is revoked?'],
                'body' => "Open **Approval Reports**. For each report, read the issue and the college officer's note, then decide: the **approval stands** (the proposal continues) or it is **revoked** (the proposal is rejected with both officers' notes recorded).",
                'page_paths' => ['/admin/approval-reports'],
            ],
            [
                'slug' => 'call-budget', 'category' => $c, 'roles' => self::CENTRAL,
                'title' => 'Setting a call\'s funding budget',
                'summary' => 'Enter the total budget on the call so the merit list can show the cut-off.',
                'keywords' => 'call budget total funding envelope ceiling proposal call create edit',
                'questions' => ['How do I set the call budget?', 'Why doesn\'t the merit list show a budget line?'],
                'body' => "Open **Proposal Calls**, edit the call and fill in **Total Funding Budget (ETB)**. Central Evaluation then shows how much is committed and left, and marks on the merit list where the money runs out.",
                'page_paths' => ['/proposal-calls'], 'action_label' => 'Open proposal calls', 'action_url' => '/proposal-calls',
            ],
            [
                'slug' => 'release-certificates', 'category' => $c, 'roles' => self::CENTRAL,
                'title' => 'Releasing reviewer certificates',
                'summary' => 'Release a year\'s certificates once its reviews are done; revoke if needed.',
                'keywords' => 'release certificates reviewer certificates revoke minimum reviews year',
                'questions' => ['How do I release reviewer certificates?', 'How do I revoke a certificate?', 'Who qualifies for a certificate?'],
                'body' => "Open **Reviewer Certificates**, choose the academic year and click **Release Certificates**. Reviewers who meet the minimum (set in Settings) get a certificate and a notification. This happens once per year.\n\nYou can **revoke** a certificate with a reason, or reinstate it later.",
                'page_paths' => ['/admin/review-certificates'], 'action_label' => 'Open reviewer certificates', 'action_url' => '/admin/review-certificates',
            ],
        ];
    }

    private function finance(): array
    {
        $c = 'Finance';

        return [
            [
                'slug' => 'budget-allocations', 'category' => $c, 'roles' => self::FINANCE,
                'title' => 'Allocating budgets to funded projects',
                'summary' => 'Allocate and approve each funded project\'s budget before requests can be made.',
                'keywords' => 'allocate allocation budget approve bulk funded project fiscal year',
                'questions' => ['How do I allocate a budget?', 'How do I approve several allocations at once?', 'Why can\'t the PI request money yet?'],
                'body' => "Open **Budget Allocations**. Allocate the approved budget to each funded project and approve it — use **Select all pending** to approve several at once. PIs can request funds only after their allocation is approved and their contract signed.",
                'page_paths' => ['/budget-allocations'], 'action_label' => 'Open budget allocations', 'action_url' => '/budget-allocations',
            ],
            [
                'slug' => 'approve-budget-requests', 'category' => $c, 'roles' => [...self::FINANCE, 'college_officer'],
                'title' => 'Reviewing budget requests',
                'summary' => 'Check signatures and items, then approve or return each request.',
                'keywords' => 'budget requests approve review signatures round finance college approval approve budget request',
                'questions' => ['How do I approve a budget request?', 'Why is this request waiting?', 'How do I see the signature status?'],
                'body' => "Open **Budget Requests**. Each request shows its round, items and **signature status**. Once all signatures are in, the college reviews it and finance gives final approval. Return a request with notes if something needs fixing.",
                'page_paths' => ['/budget-requests'],
            ],
            [
                'slug' => 'disbursements', 'category' => $c, 'roles' => self::FINANCE,
                'title' => 'Disbursing funds',
                'summary' => 'Release approved requests and record the transaction and payment proof.',
                'keywords' => 'disburse disbursement pay release money cheque transaction payment proof',
                'questions' => ['How do I disburse funds?', 'How do I record a payment?', 'How much has been disbursed this month?'],
                'body' => "Open **Disbursements**. Pending approved requests are listed. Click **Disburse Funds**, enter the amount, transaction or cheque number and attach payment proof. Totals for the month and overall are shown at the top.",
                'page_paths' => ['/disbursements'], 'action_label' => 'Open disbursements', 'action_url' => '/disbursements',
            ],
            [
                'slug' => 'settlements-admin', 'category' => $c, 'roles' => [...self::FINANCE, 'college_officer'],
                'title' => 'Verifying settlements',
                'summary' => 'The college verifies first, then finance gives final verification.',
                'keywords' => 'settlement verify verification expense report college finance unspent',
                'questions' => ['How do I verify a settlement?', 'Which settlements are waiting for me?', 'What happens after finance verification?'],
                'body' => "Open **Settlements**. Settlements awaiting **college verification** come first; once verified they move to **finance verification**. Check the expense report, total spent and unspent amount, add notes and verify. A finance-verified settlement marks the request as settled.",
                'page_paths' => ['/settlements'], 'action_label' => 'Open settlements', 'action_url' => '/settlements',
            ],
            [
                'slug' => 'milestones', 'category' => $c, 'roles' => self::FINANCE,
                'title' => 'Tracking budget milestones',
                'summary' => 'Follow disbursement milestones for each funded project.',
                'keywords' => 'milestones tracker disbursement milestone deliverable finance',
                'questions' => ['Where can I track milestones?', 'How do I add a milestone?'],
                'body' => "Open **Budget Milestone Tracker** to see and update the milestones tied to each funded project's disbursements. PIs also update milestone status in their progress reports.",
                'page_paths' => ['/finance/milestones'], 'action_label' => 'Open milestones', 'action_url' => '/finance/milestones',
            ],
        ];
    }

    private function monitoring(): array
    {
        $c = 'Monitoring';

        return [
            [
                'slug' => 'ongoing-proposals', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Monitoring ongoing projects',
                'summary' => 'See every funded project\'s contract, mid-term and completion status, and add older grants.',
                'keywords' => 'ongoing proposals monitoring funded projects legacy grant import archive status',
                'questions' => ['Where can I see all ongoing projects?', 'How do I add an old grant that predates the system?', 'Which projects need a mid-term scheduled?', 'How do I archive a project?'],
                'body' => "Open **Ongoing Proposals** to see every funded project with its contract, mid-term and completion-workshop status and days since funding — filter to find ones that need attention.\n\nUse **Grant Legacy Proposal** (or the import template) to add grants that started before the system was in use.",
                'page_paths' => ['/ongoing-proposals'], 'action_label' => 'Open ongoing proposals', 'action_url' => '/ongoing-proposals',
            ],
            [
                'slug' => 'progress-reports-admin', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Reviewing progress reports',
                'summary' => 'Accept reports or send them back, and chase the ones that are late.',
                'keywords' => 'progress reports review accept revision late overdue chase monitoring',
                'questions' => ['How do I review a progress report?', 'Which progress reports are late?', 'How do I send a report back for revision?'],
                'body' => "Open **Progress Reports** to see reports submitted, due and overdue. Open a submitted report to **accept** it or **send it back for revision** with notes. PIs are reminded automatically before and after the due date.",
                'page_paths' => ['/progress-reports'], 'action_label' => 'Open progress reports', 'action_url' => '/progress-reports',
            ],
            [
                'slug' => 'midterm-admin', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Scheduling and recording mid-term evaluations',
                'summary' => 'Schedule the mid-term, review the PI\'s reports and record the outcome.',
                'keywords' => 'midterm mid-term evaluation schedule bulk hold financial report notes',
                'questions' => ['How do I schedule a mid-term evaluation?', 'Can I schedule several mid-terms at once?', 'How do I put a project on hold?'],
                'body' => "Open **Midterm Evaluations**, schedule an evaluation (or several at once), and after the PI uploads their progress and financial reports, add evaluation notes. A project with serious problems can be put on hold.",
                'page_paths' => ['/midterm-evaluations'], 'action_label' => 'Open midterm evaluations', 'action_url' => '/midterm-evaluations',
            ],
            [
                'slug' => 'completion-admin', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Running completion workshops',
                'summary' => 'Schedule the workshop, record feedback and finalize with a score.',
                'keywords' => 'completion workshop schedule finalize score complete project',
                'questions' => ['How do I schedule a completion workshop?', 'How do I finalize a workshop?', 'What happens after finalizing?'],
                'body' => "Open **Completion Workshops**, schedule the workshop and let the PI upload their presentation. Record questions and feedback, then **Finalize Workshop** with a score. The project becomes completed and is archived 30 days later.",
                'page_paths' => ['/completion-workshops'], 'action_label' => 'Open completion workshops', 'action_url' => '/completion-workshops',
            ],
            [
                'slug' => 'outputs-admin', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Verifying research outputs and impact',
                'summary' => 'Verify and approve recorded outputs; track publications, patents and awards.',
                'keywords' => 'research outputs verify approve impact publications patents awards',
                'questions' => ['How do I approve a research output?', 'Where can I see publications and patents?'],
                'body' => "Open **Research Outputs** to verify and approve outputs recorded by research teams. **Research Impact** tracks publications, patents, awards and other outcomes from funded research.",
                'page_paths' => ['/research-outputs', '/research-impact'],
            ],
            [
                'slug' => 'repository-admin', 'category' => $c, 'roles' => [...self::CENTRAL, 'admin', 'super_admin'],
                'title' => 'Publishing to the research repository',
                'summary' => 'Publish completed research to the public repository and curate it.',
                'keywords' => 'repository publish public archive featured completed research',
                'questions' => ['How do I publish research to the repository?', 'How do I remove a record from the public site?'],
                'body' => "Open **Research Repository**. Proposals ready to publish are listed; click **Publish to Repository**, add a public abstract and publish. Edit, feature, or **archive** a record to remove it from the public site.",
                'page_paths' => ['/admin/repository'], 'action_label' => 'Open repository', 'action_url' => '/admin/repository',
            ],
            [
                'slug' => 'archives', 'category' => $c, 'roles' => [...self::CENTRAL, 'proposal_archivist', 'admin', 'super_admin'],
                'title' => 'Finding completed and archived projects',
                'summary' => 'Browse completed projects by year, and search the full proposal archive.',
                'keywords' => 'archive archived completed past projects search history proposal archive documents old proposals previous years',
                'questions' => ['Where are old proposals?', 'How do I find a completed project?', 'How do I search the proposal archive?'],
                'body' => "- **Completed Archive** lists completed and archived projects by academic year.\n- **Proposal Archive** (archivists and admins) lets you search any proposal by title, tracker number or PI and open its documents and team.",
                'page_paths' => ['/admin/completed-archive', '/admin/proposal-archive'],
            ],
        ];
    }

    private function eventsAndFunds(): array
    {
        $c = 'Conferences & external funding';

        return [
            [
                'slug' => 'submit-abstract', 'category' => $c,
                'title' => 'Submitting a conference abstract',
                'summary' => 'Submit an abstract from the conference page and follow it under My Abstracts.',
                'keywords' => 'conference abstract submit presentation poster my abstracts status',
                'questions' => ['How do I submit an abstract?', 'How do I check my abstract status?', 'Can I add co-authors to my abstract?'],
                'body' => "Open the conference on the public **Conferences** page and choose **Submit abstract**. Enter the title, abstract, keywords, presentation type, co-authors and a supporting file if needed.\n\nTo follow it, open **My Abstracts** and enter the email you submitted with.",
            ],
            [
                'slug' => 'conferences-admin', 'category' => $c, 'roles' => [...self::CENTRAL, 'admin', 'super_admin'],
                'title' => 'Running conferences and abstract review',
                'summary' => 'Create events, manage registrations and sessions, and review abstracts.',
                'keywords' => 'conference create event registration sessions speakers abstracts review assign',
                'questions' => ['How do I create a conference?', 'How do I assign abstract reviewers?', 'How do I accept or reject an abstract?'],
                'body' => "Open **Conferences** to create an event: dates, location (in person or online), capacity, abstract deadline, sessions and speakers. Published conferences appear on the public site.\n\nOpen **Abstracts** to assign reviewers to submissions and update each abstract's status.",
                'page_paths' => ['/admin/conferences', '/admin/abstracts'],
            ],
            [
                'slug' => 'external-funds', 'category' => $c, 'roles' => [...self::CENTRAL, 'admin', 'super_admin', 'finance_officer'],
                'title' => 'Managing external funding',
                'summary' => 'Track funding agencies, opportunities, applications and awards outside the university.',
                'keywords' => 'external funds agencies donors grants opportunities applications awards milestones',
                'questions' => ['How do I record an external grant?', 'How do I publish an external funding opportunity?', 'How do I track an application to a donor?'],
                'body' => "Open **External Funds** to manage funding **agencies**, publish **opportunities** (shown on the public Funding Opportunities page), record **applications** and **awards**, and track milestones and budget use by college.",
                'page_paths' => ['/admin/external-funds'], 'action_label' => 'Open external funds', 'action_url' => '/admin/external-funds',
            ],
        ];
    }

    private function reports(): array
    {
        $c = 'Reports';

        return [
            [
                'slug' => 'reports-analytics', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'The analytics dashboard',
                'summary' => 'Submissions, pass rate, funnel, money and review quality, filtered by year, category and college.',
                'keywords' => 'analytics statistics dashboard pass rate funnel charts numbers',
                'questions' => ['Where can I see statistics?', 'What is the pass rate?', 'How many proposals were funded this year?', 'How do I filter by college?'],
                'body' => "Open **Analytics Dashboard**. It shows submissions, funded and not selected, the **pass rate** (funded ÷ decided), the proposal **funnel**, money awarded and disbursed, time per stage and review quality. Filter by academic year (or all years), category and college.",
                'page_paths' => ['/admin/analytics'], 'action_label' => 'Open analytics', 'action_url' => '/admin/analytics',
            ],
            [
                'slug' => 'turnaround', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Finding delays with Turnaround',
                'summary' => 'See how long proposals wait at each stage and remind whoever has to act.',
                'keywords' => 'turnaround delays stuck slow waiting stage remind nudge time',
                'questions' => ['Which proposals are stuck?', 'How long does each stage take?', 'How do I remind someone a proposal is waiting?'],
                'body' => "Open **Turnaround** to see median days per stage against targets, which proposals are stuck longest, and which reviewers are slow. Use **Remind** to notify whoever has to act next.",
                'page_paths' => ['/admin/turnaround'], 'action_label' => 'Open turnaround', 'action_url' => '/admin/turnaround',
            ],
            [
                'slug' => 'reviewer-workload', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Reviewer workload and performance',
                'summary' => 'See each reviewer\'s load, on-time rate and scoring tendency.',
                'keywords' => 'reviewer workload performance on-time leniency overdue at risk',
                'questions' => ['Which reviewers are overloaded?', 'Which reviewers are always late?', 'Who are the strictest reviewers?'],
                'body' => "Open **Reviewer Workload** for each reviewer's assigned, completed and overdue reviews, average days to complete, on-time rate and scoring leniency, plus reviewers at risk of missing deadlines.",
                'page_paths' => ['/admin/reviewer-workload'],
            ],
            [
                'slug' => 'report-builder', 'category' => $c, 'roles' => self::OFFICERS,
                'title' => 'Building and exporting reports',
                'summary' => 'Ready-made reports, your own custom reports, and the annual report.',
                'keywords' => 'report builder export excel pdf custom annual report download export data spreadsheet',
                'questions' => ['How do I export data?', 'How do I make a custom report?', 'Where is the annual report?', 'Can I download a report as Excel?'],
                'body' => "- **Reports** has ready-made reports you can filter and export.\n- **Report Builder** lets you choose a subject, filters, dimensions and metrics and save your own reports.\n- **Annual RTT Report** summarises the year: calls, proposals, funding, outputs and college performance.",
                'page_paths' => ['/reports', '/reports/builder', '/reports/annual'], 'action_label' => 'Open reports', 'action_url' => '/reports',
            ],
            [
                'slug' => 'similarity-flags', 'category' => $c, 'roles' => [...self::CENTRAL, 'admin', 'super_admin'],
                'title' => 'Similarity (plagiarism) flags',
                'summary' => 'Proposals that are very similar to others are flagged for review.',
                'keywords' => 'similarity plagiarism duplicate copy flag detection',
                'questions' => ['How does plagiarism checking work?', 'Where are similarity flags?', 'What should I do with a flagged proposal?'],
                'body' => "When a proposal is submitted it's compared with other proposals. Pairs that are very similar appear in **Similarity Flags** with their similarity score. Open both proposals, judge whether it's a genuine problem, and act through validation or the central office.",
                'page_paths' => ['/admin/similarity-flags'],
            ],
        ];
    }

    private function administration(): array
    {
        $c = 'Administration';

        return [
            [
                'slug' => 'manage-users', 'category' => $c, 'roles' => [...self::ADMIN, 'college_officer'],
                'title' => 'Managing users and roles',
                'summary' => 'Create or import users, assign roles, and activate or deactivate accounts.',
                'keywords' => 'users create import roles assign deactivate activate account add user bulk',
                'questions' => ['How do I add a new user?', 'How do I import users from Excel?', 'How do I give someone a role?', 'How do I deactivate an account?', 'Why can\'t a user log in?'],
                'body' => "Open **Users**.\n\n- **Create New User**, or **Import Users** from the downloadable template.\n- **Assign Roles** to give access — select several users for bulk actions.\n- Activate or deactivate accounts. Deactivated users can't sign in.\n\nCollege officers can manage users in their own college.",
                'page_paths' => ['/admin/users'], 'action_label' => 'Open users', 'action_url' => '/admin/users',
            ],
            [
                'slug' => 'roles-permissions', 'category' => $c, 'roles' => self::SUPER,
                'title' => 'Roles, permissions and features',
                'summary' => 'Control what each role can do, and switch whole features on or off.',
                'keywords' => 'roles permissions access control features modules enable disable',
                'questions' => ['How do I change what a role can do?', 'How do I create a new role?', 'How do I turn a feature off?'],
                'body' => "- **Roles** and **Permissions** control what each role can see and do.\n- **Feature Management** switches whole modules or individual features on or off for everyone.\n\nChange these carefully — removing a permission immediately hides the related screens.",
                'page_paths' => ['/admin/roles', '/admin/permissions', '/admin/features'],
            ],
            [
                'slug' => 'admin-settings', 'category' => $c, 'roles' => self::ADMIN,
                'title' => 'Key settings administrators should know',
                'summary' => 'Thresholds, eligibility rules, certificates, retention and AI switches live in Settings.',
                'keywords' => 'settings configuration thresholds eligibility retention admin configure pass mark',
                'questions' => ['Where do I change the pass mark?', 'How do I change the progress report interval?', 'How do I turn off the overdue report rule?', 'Where is the reviewer agreement text?', 'How do I set data retention?'],
                'body' => "Open **Settings**. Important groups:\n\n- **Thresholds:** blind, defence and combined pass marks; reviewer workload limit; progress report interval; submission eligibility rules.\n- **General:** reviewer certificate rules and signatory, the reviewer agreement text, AI feature switches.\n- **Audit:** data retention rules (all off until you set a number of days).\n- **Public Site:** homepage content, steps, capability cards and header text.",
                'page_paths' => ['/admin/settings'], 'action_label' => 'Open settings', 'action_url' => '/admin/settings',
            ],
            [
                'slug' => 'evaluation-criteria', 'category' => $c, 'roles' => [...self::ADMIN, 'central_officer'],
                'title' => 'Setting up evaluation criteria',
                'summary' => 'Define scoring forms per category: sections with weights and questions with maximum scores.',
                'keywords' => 'evaluation criteria scoring form questions weights max score rubric',
                'questions' => ['How do I change the review questions?', 'How do I change the scoring weights?', 'Can each category have its own form?'],
                'body' => "Open **Evaluation Criteria**. Each evaluation type (blind review, open defence) per proposal category has **categories** with a weight and **questions** with a maximum score. Changes apply to new reviews; use the recalculate tools for proposals already scored.",
                'page_paths' => ['/admin/evaluation-criteria'],
            ],
            [
                'slug' => 'reference-data', 'category' => $c, 'roles' => self::ADMIN,
                'title' => 'Colleges, departments, thematic areas and lists',
                'summary' => 'Maintain the reference lists used across the platform.',
                'keywords' => 'colleges departments thematic areas dropdown options lists reference data',
                'questions' => ['How do I add a college or department?', 'How do I edit thematic areas?', 'How do I change a dropdown list?'],
                'body' => "- **Colleges** and **Departments** — the university structure.\n- **Thematic Areas** — research priorities shown on the homepage and used in proposals.\n- **Dropdown Options** — the choices offered in forms across the platform.",
                'page_paths' => ['/admin/colleges', '/admin/departments', '/admin/thematic-areas', '/admin/dropdown-options'],
            ],
            [
                'slug' => 'public-site-admin', 'category' => $c, 'roles' => self::ADMIN,
                'title' => 'Editing the public website',
                'summary' => 'Homepage slides, steps, capability cards, header text, FAQs and downloads.',
                'keywords' => 'public site homepage edit slides hero steps capabilities faqs downloads resources',
                'questions' => ['How do I change the homepage?', 'How do I edit the public FAQs?', 'How do I add a downloadable form?', 'How do I change the header text?'],
                'body' => "- **Public Site** — hero slides, sections, How It Works steps, capability cards and header text.\n- **FAQs** — the questions on the homepage.\n- **Resources** — files on the public Downloads page.\n- **Thematic Areas** — the research focus cards.",
                'page_paths' => ['/admin/public-site', '/admin/faqs', '/admin/resources'], 'action_label' => 'Open public site', 'action_url' => '/admin/public-site',
            ],
            [
                'slug' => 'announcements', 'category' => $c, 'roles' => self::ADMIN,
                'title' => 'Announcements, login notices and feedback',
                'summary' => 'Show notices when people sign in, email broadcasts, and read user feedback.',
                'keywords' => 'announcement login notice broadcast email message feedback',
                'questions' => ['How do I show a message when people log in?', 'How do I email all users?', 'Where is user feedback?'],
                'body' => "- **Login Notices** — messages shown after sign-in, with a start and end date and priority.\n- **Broadcast email** (Settings) — email all users, a role or a college.\n- **Feedback** — suggestions and problems users send from the feedback form.",
                'page_paths' => ['/admin/login-notices', '/admin/feedback'],
            ],
            [
                'slug' => 'system-monitor', 'category' => $c, 'roles' => self::ADMIN,
                'title' => 'System Monitor, email log and audit log',
                'summary' => 'Server health, the queue worker, failed jobs, sent emails and every change made.',
                'keywords' => 'system monitor health server queue worker failed jobs email log audit log backups',
                'questions' => ['Is the system healthy?', 'Did an email actually send?', 'Who changed this record?', 'Is the queue worker running?', 'How do I retry failed jobs?'],
                'body' => "- **System Monitor** — server load, memory and disk, active users, the **Queue Worker** status, failed jobs (retry or delete) and the **Email** tab showing every email sent or failed.\n- **Audit Logs** — every create, update and delete, who did it and when; exportable.",
                'page_paths' => ['/admin/system-monitor', '/admin/audit-logs'], 'action_label' => 'Open system monitor', 'action_url' => '/admin/system-monitor',
            ],
            [
                'slug' => 'data-requests-admin', 'category' => $c, 'roles' => self::ADMIN,
                'title' => 'Handling data deletion requests',
                'summary' => 'Review requests, check blockers, then anonymise or decline.',
                'keywords' => 'data deletion request anonymise privacy remove account decline',
                'questions' => ['How do I handle a data deletion request?', 'Why can\'t I approve this deletion?', 'What does anonymise mean?'],
                'body' => "Open **Data Requests**. Each request shows anything blocking deletion (active proposals, unfinished reviews, unsettled funds). When clear, **Approve & anonymise**: personal details are removed and sign-in disabled, while records stay as \"Deleted User\". Or **Decline** with a reason.",
                'page_paths' => ['/admin/data-requests'],
            ],
            [
                'slug' => 'help-articles-admin', 'category' => $c, 'roles' => self::ADMIN,
                'title' => 'Editing help articles and seeing what people ask',
                'summary' => 'Keep the help centre accurate and write articles for unanswered questions.',
                'keywords' => 'help articles edit assistant questions unanswered faq knowledge base',
                'questions' => ['How do I add a help article?', 'What questions can the assistant not answer?', 'How do I make an article show only for some roles?'],
                'body' => "Open **Help Articles** to add or edit articles. Choose the roles that should see each one, add the ways people ask about it under **Common questions**, other words under **Keywords**, and the pages where it should be suggested.\n\nThe **What people ask** tab shows the most common questions and the ones the assistant couldn't answer — write articles for those first.",
                'page_paths' => ['/admin/help-articles'],
            ],
        ];
    }
}
