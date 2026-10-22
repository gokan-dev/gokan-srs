import type { MixupRecord } from '../models/mixup.model';

/**
 * The newest records kept. A word's history needs only its recent records, and a
 * record carries a sentence: 500 of them stay well under 100 KB.
 */
export const MIXUP_LIMIT = 500;

/** What identifies a record across devices: the word asked, the answer typed, and when. */
export function mixupKey(record: MixupRecord): string {
    return `${record.asked}\u0000${record.answer}\u0000${record.date}`;
}

/** Oldest first, capped to the newest MIXUP_LIMIT. */
function capped(records: MixupRecord[]): MixupRecord[] {
    const sorted = [...records].sort((a, b) => a.date - b.date);
    return sorted.slice(Math.max(0, sorted.length - MIXUP_LIMIT));
}

/** The list with new records added, capped. */
export function appendMixups(existing: MixupRecord[] | undefined, added: MixupRecord[]): MixupRecord[] {
    return capped([...(existing ?? []), ...added]);
}

/**
 * Drive merge: a union keyed by mixupKey, so neither device loses a record.
 * Undefined when neither side has any, so progress that never mixed a word up
 * keeps no field at all.
 */
export function mergeMixups(local: MixupRecord[] | undefined, remote: MixupRecord[] | undefined): MixupRecord[] | undefined {
    if (!local && !remote) return undefined;
    const byKey = new Map<string, MixupRecord>();
    for (const record of [...(local ?? []), ...(remote ?? [])]) {
        if (!byKey.has(mixupKey(record))) byKey.set(mixupKey(record), record);
    }
    return capped([...byKey.values()]);
}

/**
 * A word's own history: the records where it was asked, newest first. A record of
 * this word typed on another word's card belongs to that word's history.
 */
export function mixupsAsked(records: readonly MixupRecord[] | undefined, vocabId: string): MixupRecord[] {
    return (records ?? []).filter(r => r.asked === vocabId).sort((a, b) => b.date - a.date);
}

/** How often the word was mixed up with each other word, in either direction. Only records naming the other word count. */
export function mixupCounts(records: readonly MixupRecord[] | undefined, vocabId: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const { asked, typed } of records ?? []) {
        if (typed === undefined || asked === typed) continue;
        const other = asked === vocabId ? typed : typed === vocabId ? asked : null;
        if (other !== null) counts.set(other, (counts.get(other) ?? 0) + 1);
    }
    return counts;
}

/** "Mixed up once", "Mixed up 3 times". */
export function mixedUpLabel(count: number): string {
    return count === 1 ? 'Mixed up once' : `Mixed up ${count} times`;
}
