import { Fragment } from "react";
import { rubyParts } from "@gokan/dataset-schema";

interface RubyProps {
    text: string;
    /** Its reading; none, or one equal to the text, renders the text alone. */
    reading?: string | null;
    /** The reading's colour, the one thing a caller chooses: its font, size and spacing are the same everywhere. */
    tone?: "text-secondary" | "text-tertiary" | "opacity-80";
}

/**
 * Text with furigana: the one place the app writes a `<ruby>` (check-conventions enforces it).
 * Each reading sits over its run of kanji only (rubyParts, shared with the dictionary), so the
 * okurigana carry none and a wide reading spreads as few characters as possible. The reading is
 * gothic (mincho's thin strokes blur at 12px), half the text's size, and its inline padding keeps
 * the readings of neighbouring words from touching (さんど とうじょう, not さんどとうじょう): it
 * only takes space where a reading is wider than its kanji. The default ruby-align stays:
 * centring opens a gap around the word that reads as a space between words. A ruby never wraps:
 * the browser would cut its base and reading apart, putting the wrong syllables over each kanji.
 * A fallback (the whole reading over the whole word) is marked for check:layout.
 */
export function Ruby({ text, reading, tone }: RubyProps) {
    return (
        <>
            {rubyParts(text, reading ?? undefined).map((part, i) => part.ruby ? (
                <ruby key={i} className="whitespace-nowrap" data-ruby-fallback={part.fallback}>
                    {part.text}
                    <rt className={`font-gothic text-[0.5em] px-[0.1em] select-none ${tone ?? ""}`}>{part.ruby}</rt>
                </ruby>
            ) : (
                <Fragment key={i}>{part.text}</Fragment>
            ))}
        </>
    );
}
