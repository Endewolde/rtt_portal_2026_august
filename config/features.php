<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Subscription Plans
    |--------------------------------------------------------------------------
    |
    | Defines the feature set for each subscription tier. The 'features' array
    | must contain valid Feature enum values. Plans are seeded into the
    | subscription_plans table and can be managed via the admin UI.
    |
    */
    'plans' => [
        'basic' => [
            'name'           => 'Basic',
            'description'    => 'Core proposal lifecycle management for small research units.',
            'price'          => 0.00,
            'billing_period' => 'annual',
            'features'       => ['proposals', 'evaluation'],
        ],
        'professional' => [
            'name'           => 'Professional',
            'description'    => 'Full research management including finance and monitoring.',
            'price'          => 0.00,
            'billing_period' => 'annual',
            'features'       => ['proposals', 'finance', 'evaluation', 'monitoring', 'complaints'],
        ],
        'enterprise' => [
            'name'           => 'Enterprise',
            'description'    => 'Complete platform with AI, analytics, and repository access.',
            'price'          => 0.00,
            'billing_period' => 'annual',
            'features'       => ['proposals', 'finance', 'evaluation', 'monitoring', 'reports', 'repository', 'similarity', 'complaints'],
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Bypass Roles
    |--------------------------------------------------------------------------
    |
    | Users with these roles skip all feature gating and can access every
    | module regardless of their college's subscription plan.
    |
    */
    'bypass_roles' => ['super_admin'],

    /*
    |--------------------------------------------------------------------------
    | Feature Cache TTL (seconds)
    |--------------------------------------------------------------------------
    */
    'cache_ttl' => 300,
];
