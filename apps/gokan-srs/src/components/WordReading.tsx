import { Fragment } from "react";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { usePitchAccent } from "../hooks/usePitchAccent";
import { KanjiSpellingNote } from "./KanjiSpellingNote";
import { PitchAccent } from "./PitchAccent";
import { PlayButton, PlaySpacer } from "./PlayButton";
import { READING_SEPARATOR, readingList } from "../utils/readings.utils";

/** The word page's header (its main reading, large, left) or a new word's intro card (every reading, centred). */
export type WordReadingVariant = 'page' | 'intro';

interface WordReadingProps {
    vocab: Pick<Vocabulary, 'writtenForm' | 'usuallyKana' | 'reading' | 'audio' | 'pitchAccent'>;
    variant: WordReadingVariant;
    className?: string;
}

/**
 * A word's reading line under its headword, with its play button (issue 178). On the page the
 * reading carries its pitch accent drawn over it (issue 176; not on the intro, which a reading quiz
 * follows). A word shown in kana already shows its reading, so its line names the kanji spelling
 * instead, then the reading with its pitch accent, and the button goes after them. On the intro
 * the line is centred on the card's axis: a spacer as wide as the button balances it, so the text
 * sits under the headword.
 */
export function WordReading({ vocab, variant, className = '' }: WordReadingProps) {
    const intro = variant === 'intro';
    const accent = usePitchAccent(vocab);
    const pitch = intro ? undefined : accent;
    const playButton = (className?: string) => <PlayButton audio={vocab.audio} label={`Play ${headwordOf(vocab)}`} className={className} />;
    const play = playButton();
    const spacer = intro && vocab.audio ? <PlaySpacer /> : null;
    const row = intro ? 'justify-center items-start' : '';

    if (vocab.usuallyKana) {
        // The note is a long line: on a phone it keeps the spacer's width for its words (with it,
        // する's note ran to three lines at 320px), so it is balanced from md up only. The reading
        // with its pitch accent takes a line of its own under the note and its button: beside a
        // note that wraps, its dots ran into the note's words.
        const line = (
            <div data-word-reading={pitch ? undefined : ''} className={`flex gap-x-2 min-w-0 ${intro ? row : 'items-start'} ${pitch ? '' : className}`}>
                {intro && vocab.audio && <PlaySpacer className="hidden md:block" />}
                <KanjiSpellingNote vocab={vocab} className="min-w-0" />
                {play}
            </div>
        );
        if (!pitch) return line;
        return (
            <div data-word-reading className={`min-w-0 ${className}`}>
                {line}
                <PitchAccent accent={pitch} className="mt-1 font-gothic text-xl text-secondary" />
            </div>
        );
    }

    // The page names its other readings on a line of their own ("Also:"); the intro lists them all.
    // Drawn with its pitch accent, the reading stands higher: the button then sits at its baseline.
    const readings = intro ? readingList(vocab.reading) : [vocab.reading.primary];
    return (
        <div data-word-reading className={`flex gap-x-2 font-gothic ${intro ? `${row} text-base` : `flex-wrap ${pitch ? 'items-end' : 'items-center'} text-2xl`} ${className}`}>
            {spacer}
            {pitch ? (
                // The button inside, after the first pattern: a second one wraps after it, never pushing it down.
                // Only with a clip: PlayButton draws nothing without one, and its room would shrink the reading for nothing.
                <PitchAccent accent={pitch} play={vocab.audio ? playButton('-ml-2') : undefined} className="text-secondary" />
            ) : (
                /* A long list wraps beside the button, which stays at its first line, and only between
                   readings: each one is a unit (アー / ル is no reading). inline-block, not nowrap, so a
                   reading longer than the whole line still wraps rather than running off the screen. */
                <span className={`min-w-0 ${intro ? 'text-secondary/90' : 'text-secondary'}`}>
                    {readings.map((reading, i) => (
                        // By position: the list is static, and a repeated reading would repeat a key.
                        <Fragment key={i}>
                            {i > 0 && READING_SEPARATOR}
                            <span lang="ja" className="inline-block max-w-full">{reading}</span>
                        </Fragment>
                    ))}
                </span>
            )}
            {!pitch && play}
        </div>
    );
}
