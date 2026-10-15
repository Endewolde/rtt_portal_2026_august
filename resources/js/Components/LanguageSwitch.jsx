import { Languages } from 'lucide-react';
import { LANGUAGES, useLanguage } from '../lib/i18n';

/** EN / አማ toggle. `color` tints it for the coloured top bar; omit it on light backgrounds. */
export default function LanguageSwitch({ color, className = '' }) {
    const [lang, setLang] = useLanguage();

    return (
        <div role="group" aria-label="Language" className={`flex items-center gap-1 ${className}`} style={color ? { color } : undefined}>
            <Languages size={12} className="opacity-70" aria-hidden="true" />
            {LANGUAGES.map((l) => (
                <button
                    key={l.code}
                    type="button"
                    onClick={() => setLang(l.code)}
                    aria-pressed={lang === l.code}
                    title={l.label}
                    lang={l.code}
                    className={`rounded px-1.5 py-0.5 text-xs font-semibold transition-opacity ${lang === l.code ? 'bg-white/20 opacity-100 ring-1 ring-current/30' : 'opacity-60 hover:opacity-100'}`}
                >
                    {l.short}
                </button>
            ))}
        </div>
    );
}
