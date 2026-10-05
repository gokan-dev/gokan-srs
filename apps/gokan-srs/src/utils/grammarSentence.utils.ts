import type { GrammarExample, Sentence } from '@gokan/dataset-schema';
import type { HighlightRange } from './interactiveSentence.utils';

/**
 * Adapts a GrammarExample's already-resolved `words[]` into the `Sentence`
 * shape `InteractiveSentence` expects (`original` + `matches`), so grammar
 * detail cards get the exact same clickable-word-to-vocab-page experience
 * vocab sentences have - reusing the one component rather than a second,
 * grammar-specific implementation (mirrors `SRSHistoryGraph`'s reuse across
 * both activities).
 *
 * Offsets are derived from cumulative `surface` length, relying on the
 * invariant (enforced at dataset build time - see CLAUDE.md's Grammar
 * Dataset section) that concatenating every word's `surface` in order
 * reconstructs `example.jp` exactly.
 */
export function grammarExampleToSentence(example: GrammarExample, index: number): Sentence {
    const matches: Record<string, { start: number; length: number; reading?: string }[]> = {};
    let cursor = 0;

    for (const word of example.words) {
        if (word.vocabId) {
            const list = matches[word.vocabId] ?? (matches[word.vocabId] = []);
            list.push({ start: cursor, length: word.surface.length, reading: word.reading });
        }
        cursor += word.surface.length;
    }

    return {
        id: `grammar-example-${index}`,
        original: example.jp,
        en: [{ id: `grammar-example-${index}-en`, text: example.en }],
        vocabIds: example.words.filter(w => w.vocabId !== null).map(w => w.vocabId as string),
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
