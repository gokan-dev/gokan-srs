import { looksLikeRomaji, romajiToHiragana, toHiragana } from '@gokan/dataset-schema';
import type { SearchIndex, SynonymRelation } from '@gokan/dataset-schema';
import type { MixupRecord } from '../models/mixup.model';

/**
 * The learner's own mix-ups, as groups of words to tell apart (the Mix-ups page,
 * a word's "Often mixed up with"). Every record is an edge between the word asked
 * and the word typed; edges become groups by shared meaning, not by words alone.
 */

/** A pair's tier as the page shows it: a synonym tier, or `unrelated` when the two words have no pair ("not a synonym"). */
export type MixupTier = SynonymRelation | 'unrelated';

/** A pair as grading reads it today (relationOf in services/exercise/wordRelation.ts). */
export interface PairRelation {
    tier: SynonymRelation;
    curated: boolean;
    shared: string[];
}

/** How often one word was typed for another. */
export interface MixupDirection {
    asked: string;
    typed: string;
    count: number;
}

/** Two words the learner mixed up, over every record of them. */
export interface MixupPair {
    /** The two vocab ids, sorted. */
    words: [string, string];
    tier: MixupTier;
    curated: boolean;
    /** The meanings the two words share; empty for an `unrelated` pair. */
    shared: string[];
    directions: MixupDirection[];
    count: number;
    /** Recency-weighted count (mixupWeight). */
    weight: number;
}

export interface MixupGroup {
    /** Stable across renders: the group's first pair, by its sorted words. */
    id: string;
    /** Its words, the most mixed up first. */
    words: string[];
    pairs: MixupPair[];
    /** The label: the meanings its pairs share, the most shared first, at most three. Empty when no pair shares one. */
    meanings: string[];
    /** The word asked most often, which names a group none of whose pairs shares a meaning. */
    asked: string;
    weight: number;
}

const DAY = 24 * 60 * 60 * 1000;
/** A mix-up counts half as much a month on, so a group you stopped confusing sinks. */
const HALF_LIFE_DAYS = 30;
/**
 * A synonym accepted in context still shows which words you reach for, but it was a
 * right answer, so it counts half (open question 1 of issue #150, decided as proposed).
 */
const ACCEPTED_IN_CONTEXT_WEIGHT = 0.5;
const LABEL_MEANINGS = 3;

/** How much one record weighs in the ranking, by its age. */
export function mixupWeight(record: Pick<MixupRecord, 'date' | 'meaning'>, now: number): number {
    const ageDays = Math.max(0, now - record.date) / DAY;
    return 0.5 ** (ageDays / HALF_LIFE_DAYS) * (record.meaning !== undefined ? ACCEPTED_IN_CONTEXT_WEIGHT : 1);
}

/**
 * A wrong answer grading did not identify, resolved to the words it could be: its
 * reading (romaji converted) or written form in the search index, keeping only words
 * the learner is studying, never the word asked. てらす on a 輝く card is 照らす.
 * An answer that is no such word is dropped.
 */
export function resolveAnswers(records: readonly MixupRecord[], index: SearchIndex, learning: ReadonlySet<string>): MixupRecord[] {
    return records.flatMap(record => {
        if (record.typed !== undefined || record.answer === undefined) return [record];
        const answer = record.answer.trim();
        const kana = toHiragana(looksLikeRomaji(answer) ? romajiToHiragana(answer.toLowerCase()) : answer);
        const words = index.filter(e => (e.r === kana || e.w === answer) && learning.has(e.id) && e.id !== record.asked);
        return words.map(e => ({ asked: record.asked, typed: e.id, answer: record.answer, date: record.date }));
    });
}

const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);

/**
 * Every pair the records name. Its tier and shared meanings come from `relation`,
 * the pair as grading reads it today, so the page shows the tier grading uses; the
 * record's own copy is the fallback when the word's file did not load. A pair the
 * dataset does not have is `unrelated`.
 */
export function mixupPairs(
    records: readonly MixupRecord[],
    relation: (asked: string, typed: string) => PairRelation | null,
    now: number,
): MixupPair[] {
    const pairs = new Map<string, MixupPair>();
    for (const record of records) {
        const { asked, typed } = record;
        if (typed === undefined || typed === asked) continue;
        const key = pairKey(asked, typed);
        let pair = pairs.get(key);
        if (!pair) {
            const current = relation(asked, typed);
            const stored: PairRelation | null = record.tier ? { tier: record.tier, curated: record.curated === true, shared: record.shared ?? [] } : null;
            const known = current ?? stored;
            pair = {
                words: asked < typed ? [asked, typed] : [typed, asked],
                tier: known?.tier ?? 'unrelated',
                curated: known?.curated ?? false,
                shared: known?.shared ?? [],
                directions: [],
                count: 0,
                weight: 0,
            };
            pairs.set(key, pair);
        }
        const direction = pair.directions.find(d => d.asked === asked && d.typed === typed);
        if (direction) direction.count++;
        else pair.directions.push({ asked, typed, count: 1 });
        pair.count++;
        pair.weight += mixupWeight(record, now);
    }
    for (const pair of pairs.values()) pair.directions.sort((a, b) => b.count - a.count);
    return [...pairs.values()];
}

function shareMeaning(a: MixupPair, b: MixupPair): boolean {
    return a.shared.some(g => b.shared.includes(g));
}

/** The meanings a group's pairs share, ranked by how many pairs share each (then by weight, then alphabetically). */
function groupMeanings(pairs: readonly MixupPair[]): string[] {
    const tally = new Map<string, { pairs: number; weight: number }>();
    for (const pair of pairs) {
        for (const g of pair.shared) {
            const t = tally.get(g) ?? { pairs: 0, weight: 0 };
            tally.set(g, { pairs: t.pairs + 1, weight: t.weight + pair.weight });
        }
    }
    return [...tally.entries()]
        .sort(([ga, a], [gb, b]) => b.pairs - a.pairs || b.weight - a.weight || ga.localeCompare(gb))
        .slice(0, LABEL_MEANINGS)
        .map(([g]) => g);
}

function weightOf(pairs: readonly MixupPair[]): number {
    return pairs.reduce((sum, p) => sum + p.weight, 0);
}

/** The word asked most often across the pairs, by recorded count. */
function mostAsked(pairs: readonly MixupPair[]): string {
    const asked = new Map<string, number>();
    for (const p of pairs) for (const d of p.directions) asked.set(d.asked, (asked.get(d.asked) ?? 0) + d.count);
    return [...asked.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? pairs[0].words[0];
}

function toGroup(pairs: MixupPair[]): MixupGroup {
    const sorted = [...pairs].sort((a, b) => b.weight - a.weight || pairKey(...a.words).localeCompare(pairKey(...b.words)));
    const wordWeight = new Map<string, number>();
    for (const p of sorted) for (const w of p.words) wordWeight.set(w, (wordWeight.get(w) ?? 0) + p.weight);
    const words = [...wordWeight.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([w]) => w);
    const id = [...pairs].map(p => pairKey(...p.words)).sort()[0].replace(' ', '-');
    return { id, words, pairs: sorted, meanings: groupMeanings(sorted), asked: mostAsked(sorted), weight: weightOf(sorted) };
}

/**
 * The groups, heaviest first. Two pairs join the same group only when they share a
 * word AND a meaning: 輝く / 光る ("shine", "glitter") and 光る / 差す ("shine") join,
 * while 次第に / 徐々に ("gradually") and 行く / いらっしゃる ("go") stay apart even
 * though 次第に / 行く share "gradually": 行く is in both groups, confused in two
 * senses. Joining on words alone chained groups through polysemous words (背, 行く,
 * 元) into one of 29 words in a simulation; joining on meaning kept the largest at 10.
 *
 * A pair sharing no meaning ("not a synonym") joins its asked word's heaviest group,
 * so it never bridges two; with none, the asked word's unrelated pairs form their own.
 */
export function mixupGroups(pairs: readonly MixupPair[]): MixupGroup[] {
    const synonyms = pairs.filter(p => p.shared.length > 0);
    const parent = synonyms.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));

    const byWord = new Map<string, number[]>();
    synonyms.forEach((p, i) => p.words.forEach(w => byWord.set(w, [...(byWord.get(w) ?? []), i])));
    for (const indices of byWord.values()) {
        for (let x = 0; x < indices.length; x++) {
            for (let y = x + 1; y < indices.length; y++) {
                if (shareMeaning(synonyms[indices[x]], synonyms[indices[y]])) parent[find(indices[x])] = find(indices[y]);
            }
        }
    }

    const members = new Map<number, MixupPair[]>();
    synonyms.forEach((p, i) => members.set(find(i), [...(members.get(find(i)) ?? []), p]));
    const groups = [...members.values()];

    const orphans = new Map<string, MixupPair[]>();
    for (const pair of pairs.filter(p => p.shared.length === 0)) {
        const asked = pair.directions[0].asked;
        const home = groups
            .filter(g => g.some(p => p.words.includes(asked)))
            .sort((a, b) => weightOf(b) - weightOf(a))[0];
        if (home) home.push(pair);
        else orphans.set(asked, [...(orphans.get(asked) ?? []), pair]);
    }

    return [...groups, ...orphans.values()].map(toGroup).sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
}

/** The groups a word is in, heaviest first. */
export function groupsWithWord(groups: readonly MixupGroup[], vocabId: string): MixupGroup[] {
    return groups.filter(g => g.words.includes(vocabId));
}

/** The pairs a word is in, the most mixed up first ("Often mixed up with" on its page). */
export function pairsWithWord(pairs: readonly MixupPair[], vocabId: string): MixupPair[] {
    return pairs.filter(p => p.words.includes(vocabId)).sort((a, b) => b.weight - a.weight);
}

/** The other word of a pair. */
export function otherWord(pair: Pick<MixupPair, 'words'>, vocabId: string): string {
    return pair.words[0] === vocabId ? pair.words[1] : pair.words[0];
}

/** Every vocab id the records name: the words to load to show them. */
export function mixupWordIds(records: readonly MixupRecord[]): string[] {
    return [...new Set(records.flatMap(r => (r.typed !== undefined ? [r.asked, r.typed] : [r.asked])))];
}
