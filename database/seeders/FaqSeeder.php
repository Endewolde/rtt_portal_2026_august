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
                'question'   => 'Who can submit a research proposal?',
                'answer'     => 'Any registered staff member or researcher affiliated with the university can submit a proposal during an active call period. Guest users have read-only access and cannot submit.',
                'sort_order' => 0,
            ],
            [
                'question'   => 'How do I know which proposal call to apply to?',
                'answer'     => 'Browse the "Open Calls" section on this page or visit the Proposal Calls page. Each call lists its eligible category, focus areas, deadline, and a downloadable guidelines document. Read the guidelines carefully before applying.',
                'sort_order' => 1,
            ],
            [
                'question'   => 'Can I edit my proposal after submitting it?',
                'answer'     => 'No — once submitted, a proposal is locked for editing unless a validation officer returns it to you for revision. You will receive a notification with comments if a revision is requested.',
                'sort_order' => 2,
            ],
            [
                'question'   => 'What is a Tracker Number and how do I use it?',
                'answer'     => 'A Tracker Number (e.g., RTT-2026-00123) is automatically assigned to your proposal upon submission. You can use it on the Track Proposal page to check your proposal\'s current status at any time — no login required.',
                'sort_order' => 3,
            ],
            [
                'question'   => 'How long does the review process take?',
                'answer'     => 'Timelines vary by call. Typically: validation takes 1–2 weeks, blind peer review takes 3–6 weeks, open defence is scheduled after reviews complete, and central evaluation takes 1–2 weeks. Check the specific call\'s guidelines for expected timelines.',
                'sort_order' => 4,
            ],
            [
                'question'   => 'What happens after my proposal is accepted?',
                'answer'     => 'Accepted proposals enter the funding stage. Once funded, your PI receives an award letter and can submit a budget request. After disbursement, periodic monitoring (midterm evaluation, completion workshop) tracks your project\'s progress.',
                'sort_order' => 5,
            ],
            [
                'question'   => 'Can I add co-investigators to my proposal?',
                'answer'     => 'Yes. In Step 3 of the proposal wizard you can search for and invite co-investigators. They must be registered system users. Each invited member will receive a notification and must accept before the proposal is submitted.',
                'sort_order' => 6,
            ],
            [
                'question'   => 'What file formats are accepted for document uploads?',
                'answer'     => 'The system accepts PDF, DOC, DOCX, XLS, XLSX, JPG, and PNG files. PDFs are recommended for proposal documents. Each file must be within the size limit set by your administrator (typically 10 MB).',
                'sort_order' => 7,
            ],
        ];

        foreach ($faqs as $data) {
            Faq::create(array_merge($data, ['is_active' => true]));
        }
    }
}
