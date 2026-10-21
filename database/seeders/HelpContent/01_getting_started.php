<?php

use Database\Seeders\HelpArticleSeeder as R;

$c = 'Getting started';

return [
    [
        'slug' => 'getting-around', 'category' => $c,
        'title' => 'Finding your way around the platform',
        'summary' => 'The sidebar, the dashboard, notifications, search and the Ask assistant.',
        'keywords' => 'navigation menu sidebar start begin overview dashboard search find home where is page',
        'questions' => [
            'Where do I start?', 'How do I find a page?', 'What is on the dashboard?', 'Is there a search?',
            'Where is the menu?', 'Why can\'t I see a menu item my colleague has?', 'How do I go back to the dashboard?',
            'What does the number on a menu item mean?', 'How do I make the sidebar smaller?', 'Where do I get help?',
        ],
        'body' => "The platform manages the whole research funding cycle: calls, proposals, review, open defence, funding decisions and project monitoring. What you see depends on your **role** — a researcher, a reviewer, a college officer, a director or the central office each get their own menu.\n\n"
            ."## Finding things\n"
            ."- The **sidebar** on the left lists everything your role can use, grouped into sections such as Proposals, Review & Evaluation, Budget, Monitoring and Reports. Click a section to expand it.\n"
            ."- A **number badge** on a menu item shows how many things are waiting for you there.\n"
            ."- Press **Ctrl+K** (⌘K on a Mac) and type any page name to jump straight to it.\n"
            ."- The **Dashboard** is your home page: what needs your attention first, plus quick actions.\n\n"
            ."## Getting help\n"
            ."- Click **Ask** at the bottom right of any page and type a question in your own words.\n"
            ."- Open **Help Centre** in the sidebar to browse every topic.\n"
            ."- The **bell** shows your notifications; click one to go to the related item.\n\n"
            ."## Good to know\n"
            ."- If a colleague sees a menu item you don't, it's because of your role. Ask the Research & Technology Transfer office if you need access.\n"
            .'- **Collapse Sidebar** at the bottom of the menu gives you more room on small screens.',
        'page_paths' => ['/dashboard'], 'action_label' => 'Open dashboard', 'action_url' => '/dashboard',
    ],
    [
        'slug' => 'sign-in', 'category' => $c,
        'title' => 'Signing in, SSO and forgotten passwords',
        'summary' => 'Sign in with your university Google or Microsoft account, or with email and password.',
        'keywords' => 'login sign in sso google microsoft password forgot reset locked account register create account verify email',
        'questions' => [
            'How do I log in?', 'I forgot my password', 'How do I reset my password?', 'Can I sign in with Google or Microsoft?',
            'My account is locked', 'How do I create an account?', 'Why does it say my account is not active?',
            'I didn\'t receive the verification email', 'Why was I logged out?', 'Why was I signed out when I logged in on another device?',
            'How long can I stay signed in?', 'What email should I register with?',
        ],
        'body' => "You can sign in with your **university Google or Microsoft account** (single sign-on) or with your **email and password**.\n\n"
            ."## Signing in\n"
            ."1. Open the platform and click **Sign In**.\n"
            ."2. Choose **Sign in with Google** or **Sign in with Microsoft**, or enter your email and password.\n"
            ."3. If two-step sign-in is on, enter the 6-digit code emailed to you.\n\n"
            ."## Creating an account\n"
            ."1. Click **Create Account** and register with your **university email address**.\n"
            ."2. Open the confirmation email and click the link to verify your address — you can't sign in until it's verified.\n"
            ."3. Check your spam folder if the email doesn't arrive within a few minutes.\n\n"
            ."## Forgotten password\n"
            ."Click **Forgot password** on the sign-in page, enter your email and follow the link we send. Passwords must be at least 8 characters.\n\n"
            ."## Good to know\n"
            ."- **5 wrong passwords** lock the account for **15 minutes**. Wait, then try again or reset your password.\n"
            ."- You're signed out automatically after **60 minutes** without activity.\n"
            ."- By default you can be signed in on **one device at a time** — signing in somewhere else signs out the older session.\n"
            .'- "Account not active" means an administrator has deactivated it — contact the Research & Technology Transfer office.',
    ],
    [
        'slug' => 'two-step-login', 'category' => $c,
        'title' => 'Two-step sign-in and active sessions',
        'summary' => 'Turn on an emailed sign-in code, see where you are signed in and sign out other devices.',
        'keywords' => 'two factor 2fa security code verification sessions devices sign out logout other devices change password',
        'questions' => [
            'How do I turn on two-factor authentication?', 'What is the 6-digit code?', 'I didn\'t get my sign-in code',
            'How do I sign out of other devices?', 'Where can I see my active sessions?', 'How do I change my password?',
            'Is two-step sign-in required?', 'How do I keep my account secure?', 'Someone else may know my password, what do I do?',
        ],
        'body' => "Open **My Profile** to manage your account security.\n\n"
            ."## Two-step sign-in\n"
            ."In **Security → Two-Factor Authentication**, switch it on. From then on, after entering your password you'll get a **6-digit code by email** that you must type in to finish signing in.\n\n"
            ."If you sign in with **Google or Microsoft**, two-step security is handled by your university account instead.\n\n"
            ."## Active sessions\n"
            ."**Active Sessions** lists the devices where you're signed in. Sign out any you don't recognise.\n\n"
            ."## Changing your password\n"
            ."Use **Change Password**: enter your current password, then the new one (at least 8 characters).\n\n"
            ."## If you think someone knows your password\n"
            ."1. Change your password straight away.\n"
            ."2. Sign out all other sessions.\n"
            ."3. Turn on two-step sign-in.\n"
            .'4. Tell the Research & Technology Transfer office.',
        'page_paths' => ['/profile'], 'action_label' => 'Open my profile', 'action_url' => '/profile',
    ],
    [
        'slug' => 'profile', 'category' => $c,
        'title' => 'Updating your profile and research expertise',
        'summary' => 'Keep your name, title, department and expertise current — expertise helps match you to reviews.',
        'keywords' => 'profile name title photo avatar department college phone expertise areas update edit employee id gender',
        'questions' => [
            'How do I change my name or title?', 'How do I update my department?', 'How do I add my research expertise?',
            'Why should I fill in expertise areas?', 'How do I change my photo?', 'How do I update my phone number?',
            'My college is wrong, how do I fix it?', 'Why am I not being assigned reviews?',
        ],
        'body' => "Open **My Profile** from the menu under your name.\n\n"
            ."## What you can update\n"
            ."- **Personal information:** full name, academic title (e.g. Dr., Prof.), phone and photo.\n"
            ."- **Academic profile:** college and department.\n"
            ."- **Research Expertise Areas:** the topics you know well.\n\n"
            ."## Why expertise matters\n"
            ."Your expertise areas are used to **suggest you as a reviewer** for proposals in your field. Be specific — *soil fertility management* is more useful than *agriculture*. If you're never assigned reviews, adding expertise areas usually helps.\n\n"
            ."## Good to know\n"
            ."- Your title appears on certificates and documents, so keep it accurate.\n"
            ."- If you can't change your college or department, ask your college officer or an administrator.",
        'page_paths' => ['/profile'], 'action_label' => 'Open my profile', 'action_url' => '/profile',
    ],
    [
        'slug' => 'notifications', 'category' => $c,
        'title' => 'Notifications, emails and digests',
        'summary' => 'Where notifications appear and how to choose email, in-app alerts or a daily or weekly digest.',
        'keywords' => 'alerts emails bell digest messages notify inbox too many emails turn off spam not receiving',
        'questions' => [
            'Where are my notifications?', 'How do I stop so many emails?', 'Can I get a daily summary instead?',
            'Why didn\'t I get an email?', 'How do I mark notifications as read?', 'When is the daily digest sent?',
            'Can I turn off email notifications?', 'Will I still see notifications if I turn off email?',
            'Why did I get a reminder?',
        ],
        'body' => "Important events — a decision on your proposal, a new review assignment, an approaching deadline — appear under the **bell** at the top and on the **Notifications** page, and are emailed to you.\n\n"
            ."## Choosing what you receive\n"
            ."Open **My Profile → Notification Preferences**:\n"
            ."- switch **email** notifications on or off;\n"
            ."- switch **in-app** notifications on or off;\n"
            ."- choose a **daily** or **weekly digest** — one summary email instead of many.\n\n"
            ."## Good to know\n"
            ."- The daily digest is sent at **7:00** each morning; the weekly digest on **Monday at 7:00**.\n"
            ."- Turning off email doesn't hide anything — notifications are always kept under the bell.\n"
            ."- Reminders are automatic: for example **7, 3 and 1 days** before a call or review deadline.\n\n"
            ."## If you didn't get an email\n"
            ."Check your spam or junk folder and add the platform's address to your contacts. The notification is still under the bell.",
        'page_paths' => ['/notifications', '/profile'], 'action_label' => 'Open notifications', 'action_url' => '/notifications',
    ],
    [
        'slug' => 'calendar', 'category' => $c,
        'title' => 'Your calendar and adding deadlines to Google or Outlook',
        'summary' => 'See deadlines and events in one calendar and export them to your own calendar app.',
        'keywords' => 'calendar deadlines events schedule ical ics google outlook export subscribe apple',
        'questions' => [
            'Where can I see all my deadlines?', 'Can I add deadlines to Google Calendar?', 'How do I export to Outlook?',
            'What is shown on the calendar?', 'How do I add the calendar to my phone?', 'Does the calendar update automatically?',
        ],
        'body' => "Open **Calendar** from the sidebar to see the dates that matter to you: call deadlines, review due dates, open defences and other events.\n\n"
            ."## Adding them to your own calendar\n"
            ."1. Click **Export iCal** to download an *.ics* file.\n"
            ."2. Import it into **Google Calendar** (Settings → Import), **Outlook** (File → Open & Export → Import) or **Apple Calendar** (File → Import).\n\n"
            ."## Good to know\n"
            ."- An exported file is a snapshot — export again after new dates are added.\n"
            .'- You can also ask the assistant *"What are my upcoming deadlines?"* for a live list.',
        'page_paths' => ['/calendar'], 'action_label' => 'Open calendar', 'action_url' => '/calendar',
    ],
    [
        'slug' => 'research-hub', 'category' => $c, 'roles' => R::RESEARCHER,
        'title' => 'My Research Hub',
        'summary' => 'Your proposals, pending reviews, outputs, awards and deadlines on one page.',
        'keywords' => 'research hub overview summary my research portfolio activity active proposals outputs listed',
        'questions' => [
            'Where can I see all my research activity?', 'What is My Research Hub?', 'How much funding have I been awarded?',
            'Where can I see my active proposals?', 'Where are my research outputs listed?',
        ],
        'body' => "**My Research Hub** brings your research activity together on one page:\n\n"
            ."- **Active proposals** and their stages;\n"
            ."- **pending reviews** you've been asked to do;\n"
            ."- your recorded **research outputs**;\n"
            ."- the **total funding awarded** to you;\n"
            ."- **upcoming deadlines**.\n\n"
            .'Use it as your weekly starting point. **Funded Proposals** (My Research) lists your funded and completed projects.',
        'page_paths' => ['/researcher-hub', '/my-research'], 'action_label' => 'Open my research hub', 'action_url' => '/researcher-hub',
    ],
    [
        'slug' => 'install-app', 'category' => $c,
        'title' => 'Installing the platform as an app on your phone',
        'summary' => 'Add the platform to your home screen for full-screen use, e.g. when scoring a defence.',
        'keywords' => 'mobile phone android iphone home screen install app pwa tablet download app store',
        'questions' => [
            'Is there a mobile app?', 'How do I install it on my phone?', 'Can I use it on Android or iPhone?',
            'Does it work offline?', 'Do I need to download it from the app store?', 'Can I score a defence on my phone?',
        ],
        'body' => "The platform works in any phone browser and can be **installed like an app** — no app store needed.\n\n"
            ."## Android (Chrome)\n"
            ."1. Open the platform in Chrome.\n"
            ."2. Tap the **⋮** menu.\n"
            ."3. Choose **Install app** or **Add to Home screen**.\n\n"
            ."## iPhone (Safari)\n"
            ."1. Open the platform in Safari.\n"
            ."2. Tap the **Share** button.\n"
            ."3. Choose **Add to Home Screen**.\n\n"
            ."## Good to know\n"
            ."- The app opens full screen, with shortcuts to **My Reviews** and **Notifications** when you press and hold its icon.\n"
            ."- It needs an internet connection. If the connection drops you'll see a friendly offline page.\n"
            .'- Nothing private is stored on the phone.',
    ],
    [
        'slug' => 'language', 'category' => $c,
        'title' => 'Switching to Amharic',
        'summary' => 'Use the EN / አማ switch to change the language of the interface.',
        'keywords' => 'amharic english language translate አማርኛ switch',
        'questions' => [
            'Can I use the system in Amharic?', 'How do I change the language?', 'Why is some text still in English?',
            'Will my choice be remembered?', 'Can I write my proposal in Amharic?',
        ],
        'body' => "Use the **EN / አማ** switch in the public site's top bar (or in the menu on a phone). Your choice is remembered on that device.\n\n"
            ."## What is translated\n"
            ."- The public website's menus, headings and pages.\n"
            ."- Your proposal's **status guide** on the proposal page.\n\n"
            ."## What stays as written\n"
            ."Text entered by staff — call descriptions, FAQs, thematic areas — appears in the language it was written in. More screens are being translated over time.\n\n"
            .'For the language your proposal must be written in, follow the call guidelines.',
    ],
    [
        'slug' => 'my-data', 'category' => $c,
        'title' => 'Downloading or deleting your personal data',
        'summary' => 'Get a copy of your data or ask for your account to be removed.',
        'keywords' => 'privacy personal data download export delete account remove gdpr anonymise',
        'questions' => [
            'How do I download my data?', 'How do I delete my account?', 'What happens to my proposals if I delete my account?',
            'Why can\'t my account be deleted yet?', 'Who can see my personal data?', 'How long does a deletion request take?',
            'Can I cancel a deletion request?',
        ],
        'body' => "Open **My Profile → Your Data & Privacy**.\n\n"
            ."## Download your data\n"
            ."Click **Download** to get a file with your profile, proposals, team memberships, reviews and notifications.\n\n"
            ."## Request deletion\n"
            ."1. Click **Request deletion** and optionally say why.\n"
            ."2. An administrator reviews the request; you're notified of the outcome.\n"
            ."3. You can **cancel** the request while it's pending.\n\n"
            ."When approved, your name, contact details and sign-in are removed. Proposals and reviews you took part in **stay as university records** but no longer identify you.\n\n"
            ."## Why it might not be possible yet\n"
            .'Deletion waits until you have no **active proposals**, no **unfinished reviews** and no **unsettled funds**.',
        'page_paths' => ['/profile'], 'action_label' => 'Open my profile', 'action_url' => '/profile',
    ],
    [
        'slug' => 'public-website', 'category' => $c,
        'title' => 'What the public website offers',
        'summary' => 'Open calls, proposal tracking, certificate checks, the repository, conferences and downloads.',
        'keywords' => 'public website homepage visitors track explore repository downloads funding opportunities showcase guest',
        'questions' => [
            'What can people see without logging in?', 'Where are the open calls listed publicly?', 'Can I track a proposal without logging in?',
            'Where can I download forms and guidelines?', 'Where can I see completed research?', 'How do I verify a certificate?',
            'Where are external funding opportunities listed?',
        ],
        'body' => "Anyone can use the public site without signing in.\n\n"
            ."## What's there\n"
            ."- **Open Calls** — current university funding calls with deadlines and guidelines.\n"
            ."- **Funding Opportunities** — external grants published by the office.\n"
            ."- **Track Proposal** — check a proposal's stage with its tracker number.\n"
            ."- **Verify Certificate** — confirm a reviewer certificate is genuine (by number or QR code).\n"
            ."- **Repository**, **Explore** and **Research Showcase** — completed and funded research.\n"
            ."- **Conferences** — upcoming events and abstract submission.\n"
            ."- **Downloads** — guidelines, templates and forms.\n"
            .'- **FAQ** — common questions on the homepage.',
    ],
    [
        'slug' => 'guided-tours', 'category' => $c,
        'title' => 'Guided tours and your getting-started checklist',
        'summary' => 'Interactive tours of the pages your role uses, and a checklist that tracks your first steps.',
        'keywords' => 'tour guided tour walkthrough onboarding checklist getting started replay restart skip resume welcome',
        'questions' => [
            'How do I take the tour again?', 'Where is my getting-started checklist?', 'How do I resume a tour I closed?',
            'Can I skip the tour?', 'How do I restart onboarding?', 'Why did a checklist item tick itself?',
            'Why doesn\'t the tour show some pages?', 'I closed the welcome message, how do I see it again?',
        ],
        'body' => "The first time you sign in, a short **welcome** introduces what your role can do. Guided tours then walk you through the real pages and buttons you'll use.\n\n"
            ."## The Help button\n"
            ."The **Help** button at the top of every page lets you:\n"
            ."- **resume** a tour you closed, from the step you stopped at;\n"
            ."- **skip** the tour that's running;\n"
            ."- **start or replay** any tour for your role;\n"
            ."- open your **getting-started checklist** and the **welcome** again.\n\n"
            ."## During a tour\n"
            ."Use **Next** and **Back** (or the arrow keys). Close it with **×** or **Esc** — your place is saved. When a step is on another page, the tour takes you there.\n\n"
            ."## The checklist\n"
            ."Your checklist shows what's done and what's left. Items tick themselves when you finish a tour or when the system sees you've done the task — for example submitting a proposal or assigning reviewers. You can also mark items done or undo them.\n\n"
            ."## Good to know\n"
            ."- Tours only show pages your role can open.\n"
            ."- If you hold several roles, the checklist has a tab for each; progress is kept separately.\n"
            ."- **Restart onboarding** at the bottom of the checklist starts your role's onboarding again.",
    ],
];
