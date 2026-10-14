<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Bring the public FAQ in line with the current review process. Answers an admin has
 * already edited are left alone; new questions are added only if missing.
 */
return new class extends Migration
{
    /** @var array<string, array{0: string, 1: string}> question => [old answer, new answer] */
    private const UPDATED = [
        'What is a Tracker Number and how do I use it?' => [
            'A Tracker Number (e.g., RTT-2026-00123) is automatically assigned to your proposal upon submission. You can use it on the Track Proposal page to check your proposal\'s current status at any time — no login required.',
            'A Tracker Number (for example RES-2026-2027-000123) is assigned to your proposal when you submit it. Enter it on the Track Proposal page to see the current stage at any time — no login required. When you are signed in, the proposal page also shows a step-by-step status guide and anything you need to do next.',
        ],
        'How long does the review process take?' => [
            'Timelines vary by call. Typically: validation takes 1–2 weeks, blind peer review takes 3–6 weeks, open defence is scheduled after reviews complete, and central evaluation takes 1–2 weeks. Check the specific call\'s guidelines for expected timelines.',
            'Each stage has a target time: validation about 1 week, assigning reviewers about 1 week, blind review about 3 weeks, scheduling the open defence about 2 weeks, scoring the defence about 1 week, and central evaluation about 2 weeks — roughly ten weeks from submission to a funding decision. The office tracks every stage against these targets, and you can follow your proposal with its Tracker Number.',
        ],
        'What happens after my proposal is accepted?' => [
            'Accepted proposals enter the funding stage. Once funded, your PI receives an award letter and can submit a budget request. After disbursement, periodic monitoring (midterm evaluation, completion workshop) tracks your project\'s progress.',
            'After the open defence, the central evaluation committee makes the final funding decision. If your proposal is funded, you receive an award with a grant reference, sign a research contract, and request your budget in stages. You then submit a progress report every few months, take part in a mid-term evaluation, and present your results at a completion workshop.',
        ],
    ];

    /** @var array<string, string> */
    private const ADDED = [
        'How is my identity kept from the blind reviewers?' => 'Blind reviewers never see who wrote a proposal. When you submit, the system also scans the documents sent to reviewers for the names, emails and phone numbers of your team, so anything that could identify you is caught and removed before review.',
        'What is the open defence?' => 'Proposals that pass blind review are presented by the research team to a panel at a scheduled open defence. Panel members score the presentation during the session or by the end of the following day. The blind review and defence scores are then combined for central evaluation.',
        'Do reviewers receive a certificate, and how can it be verified?' => 'Yes. Reviewers who complete the minimum number of reviews in an academic year receive a certificate of review service once the central office releases that year\'s certificates. Each certificate has a unique number and QR code — anyone can confirm it is genuine on the Verify Certificate page.',
    ];

    public function up(): void
    {
        foreach (self::UPDATED as $question => [$old, $new]) {
            DB::table('faqs')->where('question', $question)->where('answer', $old)->update(['answer' => $new, 'updated_at' => now()]);
        }

        // A fresh install gets the full list from FaqSeeder instead.
        if (! DB::table('faqs')->exists()) {
            return;
        }

        $order = (int) DB::table('faqs')->max('sort_order');
        foreach (self::ADDED as $question => $answer) {
            if (! DB::table('faqs')->where('question', $question)->exists()) {
                DB::table('faqs')->insert(['id' => (string) Str::uuid(), 'question' => $question, 'answer' => $answer, 'sort_order' => ++$order, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        foreach (self::UPDATED as $question => [$old, $new]) {
            DB::table('faqs')->where('question', $question)->where('answer', $new)->update(['answer' => $old, 'updated_at' => now()]);
        }

        DB::table('faqs')->whereIn('question', array_keys(self::ADDED))->delete();
    }
};
