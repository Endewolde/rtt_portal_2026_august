<?php

namespace Database\Seeders;

use App\Models\LookupOption;
use Illuminate\Database\Seeder;

class LookupOptionSeeder extends Seeder
{
    public function run(): void
    {
        $data = [
            'research_focus_area' => [
                'Agriculture & Food Systems',
                'Health & Biomedical Sciences',
                'Education & Social Sciences',
                'Engineering & Technology',
                'Environmental & Climate Sciences',
                'Economics & Business',
                'Natural Sciences',
                'Humanities & Arts',
                'Other',
            ],
            'community_focus_area' => [
                'Health & Well-being',
                'Agriculture & Food Security',
                'Education & Literacy',
                'Environmental Conservation',
                'Women Empowerment',
                'Youth Development',
                'Poverty Reduction',
                'Infrastructure & Sanitation',
                'Other',
            ],
            'technology_focus_area' => [
                'Product Innovation',
                'Process Innovation',
                'Service Innovation',
                'Knowledge & Technology Transfer',
                'Intellectual Property Commercialisation',
                'Industry-University Collaboration',
                'Digital Transformation',
                'Other',
            ],
            'research_type' => [
                'Basic Research',
                'Applied Research',
                'Experimental Development',
                'Clinical Research',
                'Action Research',
                'Review / Meta-analysis',
            ],
        ];

        foreach ($data as $group => $labels) {
            foreach ($labels as $order => $label) {
                LookupOption::firstOrCreate(
                    ['group' => $group, 'label' => $label],
                    ['sort_order' => $order, 'is_active' => true]
                );
            }
        }
    }
}
