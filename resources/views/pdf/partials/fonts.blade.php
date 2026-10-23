{{-- Ethiopic letters for dompdf. The standard PDF fonts have none, so any Amharic text
     (names, titles, the university's Amharic name) falls back to Noto Sans Ethiopic
     character by character while Latin text keeps the template's own font. Ethiopic
     has no italic, so italic text uses the upright letters. --}}
@font-face { font-family: 'Noto Sans Ethiopic'; font-weight: normal; font-style: normal; src: url('{{ resource_path('fonts/NotoSansEthiopic-Regular.ttf') }}') format('truetype'); }
@font-face { font-family: 'Noto Sans Ethiopic'; font-weight: bold; font-style: normal; src: url('{{ resource_path('fonts/NotoSansEthiopic-Bold.ttf') }}') format('truetype'); }
@font-face { font-family: 'Noto Sans Ethiopic'; font-weight: normal; font-style: italic; src: url('{{ resource_path('fonts/NotoSansEthiopic-Regular.ttf') }}') format('truetype'); }
@font-face { font-family: 'Noto Sans Ethiopic'; font-weight: bold; font-style: italic; src: url('{{ resource_path('fonts/NotoSansEthiopic-Bold.ttf') }}') format('truetype'); }
