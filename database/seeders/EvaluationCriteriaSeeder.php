<?php

namespace Database\Seeders;

use App\Models\EvaluationCategory;
use App\Models\EvaluationQuestion;
use App\Models\EvaluationType;
use Illuminate\Database\Seeder;

class EvaluationCriteriaSeeder extends Seeder
{
    public function run(): void
    {
        $this->seedBlindReviewTypes();
        $this->seedOpenDefenceTypes();
    }

    private function seedBlindReviewTypes(): void
    {
        $types = [
            ['name' => 'blind_review_research',    'label' => 'Blind Review — Research',             'proposal_category' => 'research'],
            ['name' => 'blind_review_community',   'label' => 'Blind Review — Community Engagement', 'proposal_category' => 'community_engagement'],
            ['name' => 'blind_review_technology',  'label' => 'Blind Review — Technology Transfer',  'proposal_category' => 'technology_transfer'],
            ['name' => 'blind_review_innovation',  'label' => 'Blind Review — Innovation',           'proposal_category' => 'innovation'],
            ['name' => 'blind_review_other',       'label' => 'Blind Review — Other',                'proposal_category' => 'other'],
        ];

        $categoryTemplates = [
            [
                'name' => 'Scientific Merit', 'weight' => 40, 'order_index' => 1,
                'questions' => [
                    'Originality and innovation of the research idea',
                    'Clarity and significance of the research problem',
                    'Quality of the theoretical framework',
                    'Adequacy of the literature review',
                ],
            ],
            [
                'name' => 'Methodology', 'weight' => 30, 'order_index' => 2,
                'questions' => [
                    'Appropriateness of the research design',
                    'Soundness of the data collection plan',
                    'Rigor of the proposed analysis approach',
                ],
            ],
            [
                'name' => 'Feasibility', 'weight' => 20, 'order_index' => 3,
                'questions' => [
                    'Realism of the proposed timeline',
                    'Adequacy of resource requirements',
                ],
            ],
            [
                'name' => 'Budget Justification', 'weight' => 10, 'order_index' => 4,
                'questions' => [
                    'Realism of the proposed budget',
                    'Cost-effectiveness of the budget plan',
                ],
            ],
        ];

        foreach ($types as $typeData) {
            $type = EvaluationType::updateOrCreate(
                ['name' => $typeData['name']],
                array_merge($typeData, ['is_active' => true])
            );

            foreach ($categoryTemplates as $idx => $catTemplate) {
                $categoryName = match ($typeData['name']) {
                    'blind_review_community'  => str_replace(['research idea', 'research problem', 'theoretical', 'literature'], ['community initiative', 'community problem', 'conceptual', 'community literature'], $catTemplate['name']),
                    'blind_review_technology' => str_replace(['research idea', 'research problem'], ['technology concept', 'technology problem'], $catTemplate['name']),
                    'blind_review_innovation' => str_replace(['research idea', 'research problem'], ['innovation concept', 'innovation challenge'], $catTemplate['name']),
                    default => $catTemplate['name'],
                };

                $category = EvaluationCategory::updateOrCreate(
                    ['evaluation_type_id' => $type->id, 'name' => $categoryName],
                    [
                        'evaluation_type_id' => $type->id,
                        'name'               => $categoryName,
                        'order_index'        => $catTemplate['order_index'],
                        'weight'             => $catTemplate['weight'],
                    ]
                );

                foreach ($catTemplate['questions'] as $qIdx => $questionText) {
                    $adaptedText = match ($typeData['name']) {
                        'blind_review_community'  => str_replace('research', 'community engagement', $questionText),
                        'blind_review_technology' => str_replace('research', 'technology transfer', $questionText),
                        'blind_review_innovation' => str_replace('research', 'innovation', $questionText),
                        default => $questionText,
                    };

                    EvaluationQuestion::updateOrCreate(
                        ['evaluation_category_id' => $category->id, 'question_text' => $adaptedText],
                        [
                            'evaluation_category_id' => $category->id,
                            'question_text'          => $adaptedText,
                            'max_score'              => 5,
                            'weight'                 => 1.00,
                            'is_required'            => true,
                            'order_index'            => $qIdx + 1,
                        ]
                    );
                }
            }
        }
    }

    private function seedOpenDefenceTypes(): void
    {
        $types = [
            ['name' => 'open_defence_research',   'label' => 'Open Defence — Research',             'proposal_category' => 'research'],
            ['name' => 'open_defence_community',  'label' => 'Open Defence — Community Engagement', 'proposal_category' => 'community_engagement'],
            ['name' => 'open_defence_technology', 'label' => 'Open Defence — Technology Transfer',  'proposal_category' => 'technology_transfer'],
            ['name' => 'open_defence_innovation', 'label' => 'Open Defence — Innovation',           'proposal_category' => 'innovation'],
            ['name' => 'open_defence_other',      'label' => 'Open Defence — Other',                'proposal_category' => 'other'],
        ];

        $categoryTemplates = [
            [
                'name' => 'Presentation Quality', 'weight' => 30, 'order_index' => 1,
                'questions' => [
                    'Clarity of problem statement presentation',
                    'Quality of methodology explanation',
                ],
            ],
            [
                'name' => 'Technical Depth', 'weight' => 40, 'order_index' => 2,
                'questions' => [
                    'Depth of technical knowledge demonstrated',
                    'Ability to respond to reviewer questions',
                ],
            ],
            [
                'name' => 'Impact and Feasibility', 'weight' => 30, 'order_index' => 3,
                'questions' => [
                    'Expected research impact',
                    'Overall feasibility assessment',
                ],
            ],
        ];

        foreach ($types as $typeData) {
            $type = EvaluationType::updateOrCreate(
                ['name' => $typeData['name']],
                array_merge($typeData, ['is_active' => true])
            );

            foreach ($categoryTemplates as $catTemplate) {
                $category = EvaluationCategory::updateOrCreate(
                    ['evaluation_type_id' => $type->id, 'name' => $catTemplate['name']],
                    [
                        'evaluation_type_id' => $type->id,
                        'name'               => $catTemplate['name'],
                        'order_index'        => $catTemplate['order_index'],
                        'weight'             => $catTemplate['weight'],
                    ]
                );

                foreach ($catTemplate['questions'] as $qIdx => $questionText) {
                    EvaluationQuestion::updateOrCreate(
                        ['evaluation_category_id' => $category->id, 'question_text' => $questionText],
                        [
                            'evaluation_category_id' => $category->id,
                            'question_text'          => $questionText,
                            'max_score'              => 5,
                            'weight'                 => 1.00,
                            'is_required'            => true,
                            'order_index'            => $qIdx + 1,
                        ]
                    );
                }
            }
        }
    }
}
