<?php

namespace App\Support;

/** The 17 UN Sustainable Development Goals, with their official colours. */
class Sdg
{
    public const MAX_PER_PROPOSAL = 3;

    public const GOALS = [
        1 => ['No Poverty', '#E5243B'],
        2 => ['Zero Hunger', '#DDA63A'],
        3 => ['Good Health and Well-being', '#4C9F38'],
        4 => ['Quality Education', '#C5192D'],
        5 => ['Gender Equality', '#FF3A21'],
        6 => ['Clean Water and Sanitation', '#26BDE2'],
        7 => ['Affordable and Clean Energy', '#FCC30B'],
        8 => ['Decent Work and Economic Growth', '#A21942'],
        9 => ['Industry, Innovation and Infrastructure', '#FD6925'],
        10 => ['Reduced Inequalities', '#DD1367'],
        11 => ['Sustainable Cities and Communities', '#FD9D24'],
        12 => ['Responsible Consumption and Production', '#BF8B2E'],
        13 => ['Climate Action', '#3F7E44'],
        14 => ['Life Below Water', '#0A97D9'],
        15 => ['Life on Land', '#56C02B'],
        16 => ['Peace, Justice and Strong Institutions', '#00689D'],
        17 => ['Partnerships for the Goals', '#19486A'],
    ];

    /**
     * Valid, unique goal numbers in order, at most three.
     *
     * @return list<int>
     */
    public static function clean(mixed $value): array
    {
        $numbers = collect(is_array($value) ? $value : [])
            ->map(fn ($n) => (int) $n)
            ->filter(fn ($n) => isset(self::GOALS[$n]))
            ->unique()
            ->take(self::MAX_PER_PROPOSAL)
            ->values()
            ->all();

        return $numbers;
    }

    public static function name(int $goal): string
    {
        return self::GOALS[$goal][0] ?? "Goal {$goal}";
    }
}
