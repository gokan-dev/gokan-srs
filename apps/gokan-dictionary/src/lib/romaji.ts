// A word's romaji, and the romaji several words share (#278). English speakers who do not read
// kana search in romaji ("saru japanese"), so every English word page carries its reading in
// Hepburn (`kanaToHepburn`, the writer that reads back: 勉強 benkyou, こんな konna), and a romaji
// shared by two or more words a learner is likely to mean gets one page setting them side by side
// (/romaji/<romaji>/). Only those: a romaji with one word is answered by the word's own page, and
// a page per romaji string would be thin pages competing for the site's crawl budget.
//
// Built from what both sources have (the word summaries and the frequency index), so a word page
// rendered on request finds its group as the build does.

import { kanaToHepburn, moraeOf } from '@gokan/dataset-schema';
import type { FrequencyIndex } from '@gokan/dataset-schema';
import type { VocabSummary } from './types';

/** A word qualifies for a romaji page within this many of the most frequent words, or with a JLPT level. */
export const ROMAJI_FREQUENCY_FLOOR = 20_000;

/**
 * The most romaji pages the site has: the groups whose most frequent word ranks highest are kept.
 * 1,447 qualify at this writing (3,593 words); the cap keeps the set in the low thousands as the
 * dataset grows, and check-build fails a build with more pages than it.
 */
export const ROMAJI_PAGE_CAP = 2_000;

/** A reading in Hepburn, as a word page shows it: 勉強 benkyou, 禁煙 kin'en. */
export function romajiOf(reading: string): string {
    return kanaToHepburn(reading);
}

/**
 * A reading's Hepburn cut where a line may break (#278): between the romaji of its morae, so a long
 * form wraps as とりませんでした does, torimase|n|de|shi|ta, never inside a syllable. No cut after
 * a っ (toranaka|tta, not toranakat|ta) nor before an apostrophe (ki|n'e|n, not kin|'en): those
 * morae spell nothing of their own. Joined, the parts are romajiOf(reading).
 */
export function romajiParts(reading: string): string[] {
    const romaji = romajiOf(reading);
    const morae = moraeOf(reading);
    const cuts = [0];
    for (let end = 1; end < morae.length; end += 1) {
        const spelled = romajiOf(morae.slice(0, end).join(''));
        const at = spelled.length;
        if (romaji.startsWith(spelled) && at > cuts[cuts.length - 1] && romaji[at] !== "'") cuts.push(at);
    }
    return cuts.map((at, i) => romaji.slice(at, cuts[i + 1]));
}

/**
 * What a learner types for a reading, which names its romaji page: its Hepburn without the
 * apostrophe ("kinen" is both 禁煙 kin'en and 記念 kinen). Null for a reading that is not plain
 * letters once spelled (a symbol the romaji table does not write): it gets no page.
 */
export function romajiKey(reading: string): string | null {
    const key = romajiOf(reading).replace(/'/g, '');
    return /^[a-z][a-z-]*$/.test(key) ? key : null;
}

/** The first gloss of a short gloss ("end; edge; tip" is "end"): a word named in a line or a title. */
export function firstGloss(gloss: string | undefined): string {
    return gloss?.split('; ')[0] ?? '';
}

/**
 * What tells the words of a romaji page apart when spoken: their kana, when they are not all read
 * the same (禁煙 きんえん and 記念 きねん share "kinen"); else their pitch accents, which differ, are
 * all the same, or are not known for every word (then the page says nothing of them).
 */
export type RomajiSpoken = 'readings' | 'differs' | 'same' | 'unknown';

export function romajiSpoken(readings: readonly string[], accents: readonly ({ downsteps: readonly number[] } | undefined)[]): RomajiSpoken {
    if (new Set(readings).size > 1) return 'readings';
    const patterns = accents.map(accent => accent?.downsteps.join(' '));
    if (patterns.some(pattern => pattern === undefined)) return 'unknown';
    return new Set(patterns).size > 1 ? 'differs' : 'same';
}

export interface RomajiGroups {
    /** Each shared romaji's words, most frequent first; the romaji in the order of their most frequent word. */
    byRomaji: ReadonlyMap<string, readonly string[]>;
    /** The romaji of every word in a group, by its id. */
    groupOf: ReadonlyMap<string, string>;
}

/**
 * The romaji two or more qualifying words share (ROMAJI_FREQUENCY_FLOOR), at most ROMAJI_PAGE_CAP
 * of them. A word's reading is its summary's (the headword, for a word learned in kana); a word
 * the frequency index does not list, or with no summary, is in no group.
 */
export function romajiGroups(frequency: FrequencyIndex, summaries: ReadonlyMap<string, VocabSummary>): RomajiGroups {
    const words = new Map<string, string[]>();
    frequency.forEach(({ id }, rank) => {
        const summary = summaries.get(id);
        if (summary === undefined || (rank >= ROMAJI_FREQUENCY_FLOOR && summary.jlpt === undefined)) return;
        const key = romajiKey(summary.reading ?? summary.word);
        if (key === null) return;
        const group = words.get(key);
        if (group) group.push(id);
        else words.set(key, [id]);
    });
    // A Map keeps the order its keys were first set in: the rank of each group's most frequent word.
    const shared = [...words].filter(([, ids]) => ids.length > 1).slice(0, ROMAJI_PAGE_CAP);
    return {
        byRomaji: new Map(shared),
        groupOf: new Map(shared.flatMap(([key, ids]) => ids.map((id): [string, string] => [id, key]))),
    };
}
