<?php

use App\Support\TitleCase;

dataset('titles', [
    'all caps' => ['ASSESSMENT OF MATERNAL HEALTH SERVICES IN WOLAITA ZONE', 'Assessment of Maternal Health Services in Wolaita Zone'],
    'all lower' => ['assessment of maternal health services in wolaita zone', 'Assessment of Maternal Health Services in Wolaita Zone'],
    'random mix' => ['aSSessment oF MaTernal health', 'Assessment of Maternal Health'],
    'acronym kept in normal title' => ['effect of ICT on rural farmers: a case study', 'Effect of ICT on Rural Farmers: A Case Study'],
    'known acronym restored from caps' => ['PREVALENCE OF HIV/AIDS AMONG YOUTH IN SNNPR', 'Prevalence of HIV/AIDS Among Youth in SNNPR'],
    'covid with number' => ['impact of covid-19 on schools', 'Impact of COVID-19 on Schools'],
    'hyphenated words' => ['socio-economic determinants of poverty', 'Socio-Economic Determinants of Poverty'],
    'first word minor' => ['the role of women in agriculture', 'The Role of Women in Agriculture'],
    'last word minor' => ['what are students looking for', 'What Are Students Looking For'],
    'after colon' => ['coffee value chain: the case of sodo', 'Coffee Value Chain: The Case of Sodo'],
    'inner capitals' => ['mRNA vaccine uptake and eLearning use', 'mRNA Vaccine Uptake and eLearning Use'],
    'possessive and parentheses' => ["farmers' perception (case of damot)", "Farmers' Perception (Case of Damot)"],
    'plural acronym' => ['role of NGOS in development', 'Role of NGOs in Development'],
    'extra spaces' => ['  soil   erosion  in   ethiopia ', 'Soil Erosion in Ethiopia'],
]);

test('titles are standardised to Title Case', function (string $input, string $expected) {
    expect(TitleCase::format($input))->toBe($expected);
})->with('titles');

test('formatting is idempotent', function (string $input, string $expected) {
    expect(TitleCase::format($expected))->toBe($expected);
})->with('titles');

test('empty and null titles pass through', function () {
    expect(TitleCase::format(null))->toBeNull()
        ->and(TitleCase::format(''))->toBe('')
        ->and(TitleCase::format('   '))->toBe('');
});
