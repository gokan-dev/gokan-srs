import { Fragment } from "react";
import { kunReadingLabel, type Kanji } from "@gokan/dataset-schema";

interface KanjiReadingsProps {
    kanji: Kanji;
    /** `large` under a kanji page's glyph; `compact` in a kanji in brief (a word's Kanji tab). */
    size: 'compact' | 'large';
}

/**
 * On and kun readings, each under its field label, the okurigana in parentheses: まな(ぶ). Each
 * reading is unbreakable with its 、, so a line breaks only between readings and never starts
 * with a comma: ショ / ウ would read as two readings. A `<wbr />` after each 、 is where the line
 * may break: without it a reading starting with a hyphen (-まわ(り)) cannot start a line (UAX #14
 * forbids a break before a hyphen-minus), and the row runs past its column.
 */
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
                    <dd className={`min-w-0 font-gothic text-secondary ${size === 'large' ? 'text-2xl' : 'text-base'}`} lang="ja">{row.readings.map((reading, i) => i < row.readings.length - 1
                        ? <Fragment key={reading}><span data-kanji-reading className="whitespace-nowrap">{reading}、</span><wbr /></Fragment>
                        : <span key={reading} data-kanji-reading className="whitespace-nowrap">{reading}</span>)}</dd>
                </div>
            ))}
        </dl>
    );
}
