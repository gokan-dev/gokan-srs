import type { LearningOrder } from '../models/user.model';

/**
 * Words learned in kana (Vocabulary.usuallyKana: ここ, この, ある) in the learning
 * orders. They need no kanji, so a kanji gate lets every one of them through at once.
 */

/**
 * The kanji-driven orders exist to grind words through their kanji, so they leave
 * out words learned in kana: KKLC by its index, which never lists them, and
 * kanji_coverage here. The frequency and JLPT orders meet them like any other word.
 */
export function orderIncludesUsuallyKana(order: LearningOrder): boolean {
    return order !== 'kklc' && order !== 'kanji_coverage';
}

/**
 * Paces words learned in kana among new candidates. They are mostly function words
 * (この, もらう, ほど), hard to tell apart when several arrive together, and the
 * frequency and JLPT orders would otherwise front-load them all.
 *
 * `admit` is asked once per otherwise-eligible entry, in order: past `budget`,
 * usually-kana entries are deferred. The cap is soft: when nothing else could be
 * offered, `deferred` hands those back rather than leaving the learner with no new
 * word at all.
 */
export function usuallyKanaPacer(budget: number) {
    let admitted = 0;
    // A Set, in insertion order: the JLPT order's frequency fallback walks words the
    // JLPT walk already deferred.
    const deferred = new Set<string>();
    return {
        admit(entry: { id: string; usuallyKana?: true }): boolean {
            if (!entry.usuallyKana) return true;
            if (admitted < budget) {
                admitted++;
                return true;
            }
            deferred.add(entry.id);
            return false;
        },
        deferred(max: number): string[] {
            return [...deferred].slice(0, max);
        },
    };
}

export type UsuallyKanaPacer = ReturnType<typeof usuallyKanaPacer>;

/**
 * How many more words learned in kana a session may introduce: the cap, less those
 * it already introduced and those already waiting among the intro candidates.
 */
export function usuallyKanaBudget(cap: number, introducedThisSession: number, waitingCandidates: readonly { usuallyKana?: true }[]): number {
    return Math.max(0, cap - introducedThisSession - waitingCandidates.filter(c => c.usuallyKana).length);
}
