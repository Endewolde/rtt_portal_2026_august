<?php

namespace Database\Seeders;

use App\Models\FormField;
use App\Models\FormSection;
use App\Models\FormTemplate;
use App\Models\User;
use Illuminate\Database\Seeder;

class FormTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $admin = User::first() ?? User::factory()->create(['name' => 'System Admin']);

        $templates = [
            [
                'name'        => 'Research Budget Request',
                'description' => 'Standard budget request form for research proposals.',
                'sections'    => [
                    [
                        'title'  => 'Personnel Costs',
                        'order'  => 1,
                        'fields' => [
                            ['label' => 'Research Assistant Salary', 'type' => 'currency', 'required' => true],
                            ['label' => 'Principal Investigator Allowance', 'type' => 'currency', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Equipment and Materials',
                        'order'  => 2,
                        'fields' => [
                            ['label' => 'Equipment Description', 'type' => 'textarea', 'required' => true],
                            ['label' => 'Equipment Cost', 'type' => 'currency', 'required' => true],
                            ['label' => 'Materials and Consumables', 'type' => 'currency', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Travel and Fieldwork',
                        'order'  => 3,
                        'fields' => [
                            ['label' => 'Destination', 'type' => 'text', 'required' => true],
                            ['label' => 'Travel Purpose', 'type' => 'textarea', 'required' => true],
                            ['label' => 'Travel Cost', 'type' => 'currency', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Other Costs',
                        'order'  => 4,
                        'fields' => [
                            ['label' => 'Description of Other Costs', 'type' => 'textarea', 'required' => false],
                            ['label' => 'Amount', 'type' => 'currency', 'required' => false],
                        ],
                    ],
                    [
                        'title'  => 'Justification',
                        'order'  => 5,
                        'fields' => [
                            ['label' => 'Overall Budget Justification', 'type' => 'textarea', 'required' => true],
                        ],
                    ],
                ],
            ],
            [
                'name'        => 'Travel Request',
                'description' => 'Budget request form for travel activities.',
                'sections'    => [
                    [
                        'title'  => 'Trip Details',
                        'order'  => 1,
                        'fields' => [
                            ['label' => 'Destination', 'type' => 'text', 'required' => true],
                            ['label' => 'Purpose', 'type' => 'textarea', 'required' => true],
                            ['label' => 'Departure Date', 'type' => 'date', 'required' => true],
                            ['label' => 'Return Date', 'type' => 'date', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Costs',
                        'order'  => 2,
                        'fields' => [
                            ['label' => 'Transport', 'type' => 'currency', 'required' => true],
                            ['label' => 'Accommodation', 'type' => 'currency', 'required' => true],
                            ['label' => 'Per Diem', 'type' => 'currency', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Justification',
                        'order'  => 3,
                        'fields' => [
                            ['label' => 'Travel Justification', 'type' => 'textarea', 'required' => true],
                        ],
                    ],
                ],
            ],
            [
                'name'        => 'Workshop Request',
                'description' => 'Budget request form for workshops and training events.',
                'sections'    => [
                    [
                        'title'  => 'Workshop Details',
                        'order'  => 1,
                        'fields' => [
                            ['label' => 'Workshop Title', 'type' => 'text', 'required' => true],
                            ['label' => 'Date', 'type' => 'date', 'required' => true],
                            ['label' => 'Venue', 'type' => 'text', 'required' => true],
                            ['label' => 'Expected Participants', 'type' => 'number', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Budget',
                        'order'  => 2,
                        'fields' => [
                            ['label' => 'Venue Cost', 'type' => 'currency', 'required' => true],
                            ['label' => 'Catering', 'type' => 'currency', 'required' => true],
                            ['label' => 'Materials', 'type' => 'currency', 'required' => true],
                            ['label' => 'Facilitator Fee', 'type' => 'currency', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Justification',
                        'order'  => 3,
                        'fields' => [
                            ['label' => 'Workshop Justification', 'type' => 'textarea', 'required' => true],
                        ],
                    ],
                ],
            ],
            [
                'name'        => 'Procurement Request',
                'description' => 'Budget request form for procurement of goods and services.',
                'sections'    => [
                    [
                        'title'  => 'Item Details',
                        'order'  => 1,
                        'fields' => [
                            ['label' => 'Item Name', 'type' => 'text', 'required' => true],
                            ['label' => 'Quantity', 'type' => 'number', 'required' => true],
                            ['label' => 'Specifications', 'type' => 'textarea', 'required' => true],
                            ['label' => 'Supplier', 'type' => 'text', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Cost Details',
                        'order'  => 2,
                        'fields' => [
                            ['label' => 'Unit Price', 'type' => 'currency', 'required' => true],
                            ['label' => 'Total Cost', 'type' => 'currency', 'required' => true],
                            ['label' => 'Delivery Timeline', 'type' => 'text', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Justification',
                        'order'  => 3,
                        'fields' => [
                            ['label' => 'Procurement Justification', 'type' => 'textarea', 'required' => true],
                        ],
                    ],
                ],
            ],
            [
                'name'        => 'Fieldwork Request',
                'description' => 'Budget request form for fieldwork and data collection activities.',
                'sections'    => [
                    [
                        'title'  => 'Fieldwork Details',
                        'order'  => 1,
                        'fields' => [
                            ['label' => 'Location', 'type' => 'text', 'required' => true],
                            ['label' => 'Dates', 'type' => 'text', 'required' => true],
                            ['label' => 'Objectives', 'type' => 'textarea', 'required' => true],
                            ['label' => 'Team Size', 'type' => 'number', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Costs',
                        'order'  => 2,
                        'fields' => [
                            ['label' => 'Transport', 'type' => 'currency', 'required' => true],
                            ['label' => 'Accommodation', 'type' => 'currency', 'required' => true],
                            ['label' => 'Daily Allowance', 'type' => 'currency', 'required' => true],
                            ['label' => 'Equipment', 'type' => 'currency', 'required' => true],
                        ],
                    ],
                    [
                        'title'  => 'Safety and Justification',
                        'order'  => 3,
                        'fields' => [
                            ['label' => 'Safety Considerations', 'type' => 'textarea', 'required' => true],
                            ['label' => 'Fieldwork Justification', 'type' => 'textarea', 'required' => true],
                        ],
                    ],
                ],
            ],
        ];

        foreach ($templates as $templateData) {
            $template = FormTemplate::firstOrCreate(
                ['name' => $templateData['name']],
                [
                    'description' => $templateData['description'],
                    'is_active'   => true,
                    'created_by'  => $admin?->id,
                ]
            );

            foreach ($templateData['sections'] as $sectionData) {
                $section = FormSection::firstOrCreate(
                    ['form_template_id' => $template->id, 'title' => $sectionData['title']],
                    ['order_index' => $sectionData['order']]
                );

                foreach ($sectionData['fields'] as $index => $fieldData) {
                    FormField::firstOrCreate(
                        ['form_section_id' => $section->id, 'label' => $fieldData['label']],
                        [
                            'field_type'  => $fieldData['type'],
                            'is_required' => $fieldData['required'],
                            'order_index' => $index + 1,
                        ]
                    );
                }
            }
        }
    }
}
