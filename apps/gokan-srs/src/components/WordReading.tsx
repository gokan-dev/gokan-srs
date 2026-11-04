import { Fragment } from "react";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { KanjiSpellingNote } from "./KanjiSpellingNote";
import { PlayButton, PlaySpacer } from "./PlayButton";

/** The word page's header (its main reading, large, left) or a new word's intro card (every reading, centred). */
export type WordReadingVariant = 'page' | 'intro';

interface WordReadingProps {
    vocab: Pick<Vocabulary, 'writtenForm' | 'usuallyKana' | 'reading' | 'audio'>;
    variant: WordReadingVariant;
    className?: string;
}

/**
 * A word's reading line under its headword, with its play button (issue 178; the pitch accent,
 * issue 176, will join them). A word shown in kana already shows its reading, so its line names
 * the kanji spelling instead, and the button goes after that note. On the intro the line is centred
 * on the card's axis: a spacer as wide as the button balances it, so the text sits under the headword.
 */
export function WordReading({ vocab, variant, className = '' }: WordReadingProps) {
    const intro = variant === 'intro';
    const play = <PlayButton audio={vocab.audio} label={`Play ${headwordOf(vocab)}`} />;
    const spacer = intro && vocab.audio ? <PlaySpacer /> : null;
    const row = intro ? 'justify-center items-start' : '';

    if (vocab.usuallyKana) {
        return (
            <div data-word-reading className={`flex gap-x-2 min-w-0 ${intro ? row : 'items-start'} ${className}`}>
                {spacer}
                <KanjiSpellingNote vocab={vocab} className="min-w-0" />
                {play}
            </div>
        );
    }

    // The page names its other readings on a line of their own ("Also:"); the intro lists them all.
    const readings = intro ? [vocab.reading.primary, ...vocab.reading.alternatives] : [vocab.reading.primary];
    return (
        <div data-word-reading className={`flex gap-x-2 font-gothic ${intro ? `${row} text-base` : 'flex-wrap items-center text-2xl'} ${className}`}>
            {spacer}
            {/* A long list wraps beside the button, which stays at its first line, and only between
                readings: each one is a unit (アー / ル is no reading). inline-block, not nowrap, so a
                reading longer than the whole line still wraps rather than running off the screen. */}
            <span className={`min-w-0 ${intro ? 'text-secondary/90' : 'text-secondary'}`}>
                {readings.map((reading, i) => (
                    <Fragment key={reading}>
                        {i > 0 && ', '}
                        <span lang="ja" className="inline-block max-w-full">{reading}</span>
                    </Fragment>
                ))}
            </span>
            {play}
        </div>
    );
}
