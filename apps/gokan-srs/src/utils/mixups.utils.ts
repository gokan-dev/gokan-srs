import type { MixupRecord } from '../models/mixup.model';

/**
 * The newest records kept. A thousand mix-ups is years of study for most learners,
 * and at about 80 bytes a record it stays a small share of localStorage.
 */
export const MIXUP_LIMIT = 1000;

/** What identifies a record across devices: the word asked, the word or text typed, and when. */
export function mixupKey(record: MixupRecord): string {
    return `${record.asked}\u0000${record.typed ?? record.answer ?? ''}\u0000${record.date}`;
}

/**
 * Oldest first, capped to MIXUP_LIMIT. Over the limit, the oldest raw answers go
 * first: most never resolve to a word (a typo, a wrong conjugation), so they must not
 * push out the pairs grading identified.
 */
function capped(records: MixupRecord[]): MixupRecord[] {
    const sorted = [...records].sort((a, b) => a.date - b.date);
    let excess = sorted.length - MIXUP_LIMIT;
    if (excess <= 0) return sorted;
    const kept = sorted.filter(r => {
        if (excess > 0 && r.typed === undefined) { excess--; return false; }
        return true;
    });
    return kept.slice(Math.max(0, kept.length - MIXUP_LIMIT));
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
