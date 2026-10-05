import type { Sentence } from "../models/sentence.model";

/** A character-offset range into `Sentence.original` to render with the target styling. */
export interface HighlightRange {
    start: number;
    length: number;
}

export interface InteractiveSentenceSegment {
    type: 'text' | 'match';
    content: string;
    start: number;
    end: number;
    vocabId?: string;
    reading?: string;
    /** True when this is the vocab-match segment for `targetVocabId`. */
    isTarget: boolean;
    /** True when this segment falls (fully or partially) inside a `highlightRanges` entry. */
    isHighlighted: boolean;
}

export interface SegmentInteractiveSentenceOptions {
    targetVocabId?: string;
    highlightRanges?: HighlightRange[];
}

/**
 * Pure segmentation for `InteractiveSentence`: splits `sentence.original` into
 * ordered text/match runs and flags which ones are the studied target word
 * or fall inside a `highlightRanges` entry (e.g. a grammar pattern's
 * markers). Split out of the component because the app has no
 * component-test setup - this is the part worth unit-testing directly.
 *
 * A highlight range that overlaps a vocab match (fully or partially) flags
 * the WHOLE match segment rather than splitting it: the match must stay one
 * unit so its click/gloss behaviour is untouched. A highlight range over
 * plain (unmatched) text is split out as its own sub-segment instead, since
 * there is no click/gloss behaviour there to preserve. Either way, no
 * character is ever dropped, duplicated or reordered - concatenating every
 * segment's `content` in order always reproduces `sentence.original` exactly.
 */
export function segmentInteractiveSentence(
    sentence: Sentence,
    { targetVocabId, highlightRanges = [] }: SegmentInteractiveSentenceOptions = {}
): InteractiveSentenceSegment[] {
    const text = sentence.original;
    const matches = sentence.matches ?? {};

    // 1. Flatten + sort vocab matches. Overlaps are resolved by earliest-start-wins,
    // mirroring the original component's handling.
    const flatMatches: { vocabId: string; start: number; length: number; reading?: string }[] = [];
    // The dataset has always written each vocab's matches as an array (build-data.ts).
    for (const [vocabId, matchArray] of Object.entries(matches)) {
        for (const m of matchArray) flatMatches.push({ vocabId, ...m });
    }
    flatMatches.sort((a, b) => a.start - b.start);

    interface BaseSegment {
        type: 'text' | 'match';
        start: number;
        end: number;
        vocabId?: string;
        reading?: string;
    }

    const base: BaseSegment[] = [];
    let cursor = 0;
    for (const match of flatMatches) {
        if (match.start < cursor) continue; // overlap: earliest-start wins, strict skip
        if (match.start > cursor) {
            base.push({ type: 'text', start: cursor, end: match.start });
        }
        const end = match.start + match.length;
        base.push({ type: 'match', start: match.start, end, vocabId: match.vocabId, reading: match.reading });
        cursor = end;
    }
    if (cursor < text.length) {
        base.push({ type: 'text', start: cursor, end: text.length });
    }

    // 2. Normalize highlight ranges: clip to bounds, drop empty/invalid, sort by start.
    const ranges = highlightRanges
        .map(r => ({ start: Math.max(0, r.start), end: Math.min(text.length, r.start + r.length) }))
        .filter(r => r.end > r.start)
        .sort((a, b) => a.start - b.start);

    const overlapsAnyRange = (start: number, end: number) =>
        ranges.some(r => r.start < end && r.end > start);

    // 3. Expand into final segments - matches stay whole, plain text is split at
    // any highlight boundary that falls strictly inside it.
    const segments: InteractiveSentenceSegment[] = [];
    for (const seg of base) {
        if (seg.type === 'match') {
            segments.push({
                type: 'match',
                content: text.slice(seg.start, seg.end),
                start: seg.start,
                end: seg.end,
                vocabId: seg.vocabId,
                reading: seg.reading,
                isTarget: targetVocabId !== undefined && seg.vocabId === targetVocabId,
                isHighlighted: overlapsAnyRange(seg.start, seg.end),
            });
            continue;
        }

        const cutPoints = new Set<number>([seg.start, seg.end]);
        for (const r of ranges) {
            if (r.start > seg.start && r.start < seg.end) cutPoints.add(r.start);
            if (r.end > seg.start && r.end < seg.end) cutPoints.add(r.end);
        }
        const sortedCuts = Array.from(cutPoints).sort((a, b) => a - b);

        for (let i = 0; i < sortedCuts.length - 1; i++) {
            const start = sortedCuts[i];
            const end = sortedCuts[i + 1];
            segments.push({
                type: 'text',
                content: text.slice(start, end),
                start,
                end,
                isTarget: false,
                isHighlighted: overlapsAnyRange(start, end),
            });
        }
    }

    return segments;
}
