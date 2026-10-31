import { kunReadingLabel, type Kanji } from "@gokan/dataset-schema";

interface KanjiReadingsProps {
    kanji: Kanji;
    /** `large` under a kanji page's glyph; `compact` in a kanji in brief (a word's Kanji tab). */
    size: 'compact' | 'large';
}

/** On and kun readings, each under its field label, the okurigana in parentheses: まな(ぶ). */
export function KanjiReadings({ kanji, size }: KanjiReadingsProps) {
    const rows = [
        { label: 'On', readings: kanji.readings.on },
        { label: 'Kun', readings: kanji.readings.kun.map(kunReadingLabel) },
    ].filter(row => row.readings.length > 0);
    if (rows.length === 0) return null;
    return (
        <dl className={size === 'large' ? 'space-y-1' : 'space-y-0.5'}>
            {rows.map(row => (
                <div key={row.label} className="flex items-baseline gap-3">
                    <dt className="type-label w-8 shrink-0">{row.label}</dt>
                    <dd className={`min-w-0 font-gothic text-secondary break-words ${size === 'large' ? 'text-2xl' : 'text-base'}`} lang="ja">{row.readings.join('、')}</dd>
                </div>
            ))}
        </dl>
    );
}
