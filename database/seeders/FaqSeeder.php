<?php

namespace Database\Seeders;

use App\Models\Faq;
use Illuminate\Database\Seeder;

class FaqSeeder extends Seeder
{
    public function run(): void
    {
        if (Faq::exists()) {
            return;
        }

        $faqs = [
            [
                'question' => 'Who can submit a research proposal?',
                'answer' => 'Any registered staff member or researcher affiliated with the university can submit a proposal during an active call period. Guest users have read-only access and cannot submit.',
                'sort_order' => 0,
            ],
            [
                'question' => 'How do I know which proposal call to apply to?',
                'answer' => 'Browse the "Open Calls" section on this page or visit the Proposal Calls page. Each call lists its eligible category, focus areas, deadline, and a downloadable guidelines document. Read the guidelines carefully before applying.',
                'sort_order' => 1,
            ],
            [
                'question' => 'Can I edit my proposal after submitting it?',
                'answer' => 'No — once submitted, a proposal is locked for editing unless a validation officer returns it to you for revision. You will receive a notification with comments if a revision is requested.',
                'sort_order' => 2,
            ],
            [
                'question' => 'What is a Tracker Number and how do I use it?',
                'answer' => 'A Tracker Number (for example RES-2026-2027-000123) is assigned to your proposal when you submit it. Enter it on the Track Proposal page to see the current stage at any time — no login required. When you are signed in, the proposal page also shows a step-by-step status guide and anything you need to do next.',
                'sort_order' => 3,
            ],
            [
                'question' => 'How long does the review process take?',
                'answer' => 'Each stage has a target time: validation about 1 week, assigning reviewers about 1 week, blind review about 3 weeks, scheduling the open defence about 2 weeks, scoring the defence about 1 week, and central evaluation about 2 weeks — roughly ten weeks from submission to a funding decision. The office tracks every stage against these targets, and you can follow your proposal with its Tracker Number.',
                'sort_order' => 4,
            ],
            [
                'question' => 'What happens after my proposal is accepted?',
                'answer' => 'After the open defence, the central evaluation committee makes the final funding decision. If your proposal is funded, you receive an award with a grant reference, sign a research contract, and request your budget in stages. You then submit a progress report every few months, take part in a mid-term evaluation, and present your results at a completion workshop.',
                'sort_order' => 5,
            ],
            [
                'question' => 'Can I add co-investigators to my proposal?',
                'answer' => 'Yes. In Step 3 of the proposal wizard you can search for and invite co-investigators. They must be registered system users. Each invited member will receive a notification and must accept before the proposal is submitted.',
                'sort_order' => 6,
            ],
            [
                'question' => 'What file formats are accepted for document uploads?',
                'answer' => 'The system accepts PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files. PDFs are recommended for proposal documents. Each file must be within the size limit set by your administrator (typically 10 MB).',
                'sort_order' => 7,
            ],
            [
                'question' => 'How is my identity kept from the blind reviewers?',
                'answer' => 'Blind reviewers never see who wrote a proposal. When you submit, the system also scans the documents sent to reviewers for the names, emails and phone numbers of your team, so anything that could identify you is caught and removed before review.',
                'sort_order' => 8,
            ],
            [
                'question' => 'What is the open defence?',
                'answer' => 'Proposals that pass blind review are presented by the research team to a panel at a scheduled open defence. Panel members score the presentation during the session or by the end of the following day. The blind review and defence scores are then combined for central evaluation.',
                'sort_order' => 9,
            ],
            [
                'question' => 'Do reviewers receive a certificate, and how can it be verified?',
                'answer' => 'Yes. Reviewers who complete the minimum number of reviews in an academic year receive a certificate of review service once the central office releases that year\'s certificates. Each certificate has a unique number and QR code — anyone can confirm it is genuine on the Verify Certificate page.',
                'sort_order' => 10,
            ],
        ];

        foreach ($faqs as $data) {
            Faq::create(array_merge($data, ['is_active' => true]));
        }
    }
}
