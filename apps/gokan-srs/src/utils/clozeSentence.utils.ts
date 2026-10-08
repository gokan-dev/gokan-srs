import type { GrammarExample, Sentence } from '@gokan/dataset-schema';
import type { ProductionCloze } from './productionCloze.utils';

/** One blank in a cloze sentence: a character range of `sentence.original`. */
export interface ClozeBlankRange {
    start: number;
    length: number;
    /** The blank's own reading, shown as furigana once answered. Absent when unknown. */
    reading?: string;
}

/**
 * A sentence with answer blanks, the one shape both sentence clozes render: the
 * vocab production cloze (one blank) and the grammar cloze (one per marker and
 * known word). Blanks are in slot order, sorted by position, and never overlap.
 */
export interface ClozeSentence {
    sentence: Sentence;
    blanks: ClozeBlankRange[];
}

export type ClozePart =
    | { kind: 'text'; sentence: Sentence }
    | { kind: 'blank'; index: number; surface: string; reading?: string };

/** The production cloze's single blank, from the dataset's match for the word. */
export function productionClozeSentence(cloze: ProductionCloze): ClozeSentence {
    return {
        sentence: cloze.sentence,
        blanks: [{ start: cloze.blankStart, length: cloze.blankLength, ...(cloze.blankReading ? { reading: cloze.blankReading } : {}) }],
    };
}

/**
 * A grammar example as a Sentence: its words joined, each vocab word a match, so it
 * renders through the same InteractiveSentence as every other sentence. A word's
 * stored reading is the lemma's on some conjugated tokens (早かろ carries はやい),
 * so only an unconjugated word gets one.
 */
export function grammarExampleToSentence(example: GrammarExample, id: string): Sentence {
    const matches: NonNullable<Sentence['matches']> = {};
    let offset = 0;
    for (const word of example.words) {
        if (word.vocabId) {
            const reading = word.baseForm ? undefined : word.reading;
            (matches[word.vocabId] ??= []).push({ start: offset, length: word.surface.length, ...(reading ? { reading } : {}) });
        }
        offset += word.surface.length;
    }
    return {
        id,
        original: example.words.map(w => w.surface).join(''),
        en: [{ id: `${id}:en`, text: example.en }],
        vocabIds: Object.keys(matches),
        matches,
    };
}

const HAS_KANJI = /[一-鿿]/;

/** A grammar example with one blank per span (a span is one input: a marker run, or one known word). */
export function grammarClozeSentence(example: GrammarExample, spans: number[][], id: string): ClozeSentence {
    const starts: number[] = [];
    let offset = 0;
    for (const word of example.words) {
        starts.push(offset);
        offset += word.surface.length;
    }
    const blanks = spans.map(span => {
        const words = span.map(i => example.words[i]);
        // A reading only when every token's is the surface's own: no conjugated token, no kanji left unread.
        const readable = words.every(w => !w.baseForm && (w.reading || !HAS_KANJI.test(w.surface)));
        const reading = readable ? words.map(w => w.reading ?? w.surface).join('') : undefined;
        return {
            start: starts[span[0]],
            length: words.reduce((sum, w) => sum + w.surface.length, 0),
            ...(reading ? { reading } : {}),
        };
    });
    return { sentence: grammarExampleToSentence(example, id), blanks };
}

/**
 * Splits a cloze into its parts, in reading order: the text between blanks as
 * Sentence fragments (each carrying only the matches entirely inside it, offsets
 * rebased, so InteractiveSentence renders it as usual), and the blanks. A match
 * straddling a blank boundary is dropped: half a word must never render next to a
 * blank. Concatenating every part's text reproduces the original sentence.
 */
export function splitAtBlanks({ sentence, blanks }: ClozeSentence): ClozePart[] {
    const parts: ClozePart[] = [];
    const matches = Object.entries(sentence.matches ?? {});

    const fragment = (from: number, to: number) => {
        if (to <= from) return;
        const inside: NonNullable<Sentence['matches']> = {};
        for (const [vocabId, ranges] of matches) {
            for (const m of ranges) {
                if (m.start >= from && m.start + m.length <= to) (inside[vocabId] ??= []).push({ ...m, start: m.start - from });
            }
        }
        parts.push({
            kind: 'text',
            sentence: { ...sentence, id: `${sentence.id}:${from}`, original: sentence.original.slice(from, to), vocabIds: Object.keys(inside), matches: inside },
        });
    };

    let cursor = 0;
    blanks.forEach((blank, index) => {
        fragment(cursor, blank.start);
        parts.push({ kind: 'blank', index, surface: sentence.original.slice(blank.start, blank.start + blank.length), ...(blank.reading ? { reading: blank.reading } : {}) });
        cursor = blank.start + blank.length;
    });
    fragment(cursor, sentence.original.length);
    return parts;
}
