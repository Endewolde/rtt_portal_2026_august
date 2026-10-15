import { Fragment } from 'react';

/** **bold** inside a line, rendered as React text (never raw HTML). */
function inline(text) {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>
    );
}

/**
 * Help article text: blank-line separated paragraphs, "1." numbered lists, "- " bullets
 * and **bold**. Deliberately tiny and safe — article text is never injected as HTML.
 */
export default function HelpBody({ text, className = '' }) {
    const blocks = String(text ?? '').trim().split(/\n\s*\n/);

    return (
        <div className={`space-y-3 text-sm leading-relaxed text-gray-700 ${className}`}>
            {blocks.map((block, i) => {
                const lines = block.split('\n').filter((l) => l.trim() !== '');
                if (lines.every((l) => /^\s*\d+\.\s/.test(l))) {
                    return <ol key={i} className="list-decimal space-y-1.5 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*\d+\.\s/, ''))}</li>)}</ol>;
                }
                if (lines.every((l) => /^\s*-\s/.test(l))) {
                    return <ul key={i} className="list-disc space-y-1.5 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*-\s/, ''))}</li>)}</ul>;
                }
                return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
            })}
        </div>
    );
}
