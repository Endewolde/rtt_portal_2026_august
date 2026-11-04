// Regenerates resources/css/dark-theme.css from Tailwind's palette:
//   node scripts/generate-dark-theme.mjs node_modules/tailwindcss/theme.css resources/css/dark-theme.css
import fs from 'fs';
const [src, out] = process.argv.slice(2);
const css = fs.readFileSync(src, 'utf8');
const palette = {};
for (const m of css.matchAll(/--color-([a-z]+)-(\d+):\s*([^;]+);/g)) {
  (palette[m[1]] ??= {})[m[2]] = m[3].trim();
}
// Light end swaps with the dark end; 600 text lightens to 400; 400–500 read on both.
const SWAP = { 50: 950, 100: 900, 200: 800, 300: 700, 600: 400, 700: 300, 800: 200, 900: 100, 950: 50 };
const STRONG = [600, 700, 800, 900, 950];
const vars = [], keep = [];
const esc = (s) => s.replace(/:/g, '\\:').replace(/\//g, '\\/');
for (const [name, shades] of Object.entries(palette)) {
  for (const [shade, to] of Object.entries(SWAP)) {
    if (shades[shade] && shades[to]) vars.push(`  --color-${name}-${shade}: ${shades[to]};`);
  }
  // Strong backgrounds (buttons, banners, dark headers) keep their real colour — unless disabled.
  for (const s of STRONG) {
    if (!shades[s]) continue;
    keep.push(`html.dark .${esc(`bg-${name}-${s}`)}:not(:disabled) { background-color: ${shades[s]}; }`);
    keep.push(`html.dark .${esc(`hover:bg-${name}-${s}`)}:hover:not(:disabled) { background-color: ${shades[s]}; }`);
  }
}
// Sections already designed dark (heroes, dark headers) opt out with .keep-theme-colors:
// inside them the original palette — and white surfaces — come back.
const restore = [];
for (const [name, shades] of Object.entries(palette)) {
  for (const shade of Object.keys(SWAP)) {
    if (shades[shade]) restore.push(`  --color-${name}-${shade}: ${shades[shade]};`);
  }
}
const surface = palette.slate[900];
const alpha = [70, 80, 90, 95].map((a) => `html.dark .${esc(`bg-white/${a}`)} { background-color: color-mix(in oklab, ${surface} ${a}%, transparent); }`);
fs.writeFileSync(out, `/*
 * Dark theme — applied when <html> has the "dark" class (Settings → Appearance → Theme).
 * GENERATED from Tailwind's palette (scripts/generate-dark-theme.mjs): the light end of
 * every colour scale (50–300: page backgrounds, borders, tinted badges) swaps with the
 * dark end, and dark text (600–950) becomes light, so the whole app follows without
 * per-component dark: classes. White stays white — only white surfaces (bg-white) turn
 * dark — and strong backgrounds (600–950: buttons, banners) keep their real colours.
 */
html.dark {
  color-scheme: dark;
${vars.join('\n')}
}

/* White surfaces (cards, panels, inputs, glassy headers) become dark; white text and translucent overlays stay white. */
html.dark .bg-white,
html.dark .hover\\:bg-white:hover { background-color: ${surface}; }
${alpha.join('\n')}
html.dark input::placeholder,
html.dark textarea::placeholder { color: ${palette.gray[500]}; }

${keep.join('\n')}

/* Opt-out for sections designed dark already (add class="keep-theme-colors"). */
html.dark .keep-theme-colors {
${restore.join('\n')}
}
html.dark .keep-theme-colors .bg-white,
html.dark .keep-theme-colors .hover\\:bg-white:hover { background-color: #fff; }
`);
console.log(`${vars.length} swapped shades, ${keep.length} kept backgrounds`);
