import type { GrammarExample, GrammarExampleWord, Sentence } from '@gokan/dataset-schema';
import type { HighlightRange } from './interactiveSentence.utils';

/**
 * A word's reading as it sits in the sentence, or undefined when the stored one may
 * be its lemma's: the compiled data stores the surface's reading on some conjugated
 * tokens and the lemma's on others (早かろ carries はやい, 食べ carries たべる), which
 * shown as furigana reads the token wrong. A reading ending in the surface's own
 * kana tail is the surface's (通っている, かよっている). A conjugated token without a
 * kana tail (来 in 来ます) cannot be told apart, and no furigana beats a wrong one.
 */
export function surfaceReading(word: GrammarExampleWord): string | undefined {
    if (!word.reading || !word.baseForm) return word.reading;
    const tail = /[ぁ-ゖー]+$/.exec(word.surface)?.[0];
    return tail && word.reading.endsWith(tail) ? word.reading : undefined;
}

/**
 * Adapts a GrammarExample's already-resolved `words[]` into the `Sentence`
 * shape `InteractiveSentence` expects (`original` + `matches`), so the grammar
 * detail page and the grammar cards get the exact same clickable-word-to-vocab-page
 * experience vocab sentences have - reusing the one component rather than a
 * second, grammar-specific implementation.
 *
 * Offsets are derived from cumulative `surface` length, and `original` is the
 * surfaces joined, so the two always agree (the dataset guarantees the join is
 * `example.jp`). `id` must be unique among the sentences on one page.
 */
export function grammarExampleToSentence(example: GrammarExample, id: string): Sentence {
    const matches: NonNullable<Sentence['matches']> = {};
    let cursor = 0;

    for (const word of example.words) {
        if (word.vocabId) {
            const reading = surfaceReading(word);
            (matches[word.vocabId] ??= []).push({ start: cursor, length: word.surface.length, ...(reading ? { reading } : {}) });
        }
        cursor += word.surface.length;
    }

    return {
        id,
        original: example.words.map(w => w.surface).join(''),
        en: [{ id: `${id}-en`, text: example.en }],
        vocabIds: Object.keys(matches),
        matches,
    };
}

/**
 * Derives `InteractiveSentence`'s `highlightRanges` from a `GrammarExample`'s
 * `patternWordIndices` - the character offsets of the point's literal
 * grammar-pattern markers, for highlighting the construction on
 * `GrammarDetailScreen` (a study page, so there is no answer to leak, unlike
 * `GrammarQuizCard`'s blanks). Uses the same cumulative-`surface`-length
 * technique as `grammarExampleToSentence`. Consecutive pattern words (no
 * other word between them) merge into one range, so a multi-word marker like
 * が + いちばん highlights as a single contiguous span rather than two
 * separate ones.
 */
export function patternHighlightRanges(example: GrammarExample): HighlightRange[] {
    const patternIndices = new Set(example.patternWordIndices);
    const ranges: HighlightRange[] = [];
    let cursor = 0;

    example.words.forEach((word, i) => {
        if (patternIndices.has(i)) {
            const last = ranges[ranges.length - 1];
            if (last && last.start + last.length === cursor) {
                last.length += word.surface.length;
            } else {
                ranges.push({ start: cursor, length: word.surface.length });
            }
        }
        cursor += word.surface.length;
    });

    return ranges;
}
