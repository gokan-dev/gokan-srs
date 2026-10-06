import type { KanjiKnowledge } from '../models/user.model';
import type { VocabProgress } from '../models/vocabulary.model';

export interface KanjiCoverage {
    /** Known kanji that appear in at least one word of the learning queue. */
    covered: number;
    /** Every kanji the learner knows. */
    total: number;
}

/**
 * How many of the learner's known kanji they have actually met inside a word.
 * `index` maps vocab ids to the kanji they contain (the frequency index carries
 * exactly that), so no vocab file needs loading.
 */
export function kanjiCoverage(
    index: readonly { id: string; containedKanji: readonly string[] }[],
    learningQueue: readonly Pick<VocabProgress, 'vocabId'>[],
    kanjiKnowledge: Pick<KanjiKnowledge, 'kanjiSet'>,
): KanjiCoverage {
    const learnedIds = new Set(learningQueue.map(v => v.vocabId));
    const metKanji = new Set<string>();
    for (const entry of index) {
        if (learnedIds.has(entry.id)) entry.containedKanji.forEach(k => metKanji.add(k));
    }
    let covered = 0;
    for (const kanji of kanjiKnowledge.kanjiSet) if (metKanji.has(kanji)) covered++;
    return { covered, total: kanjiKnowledge.kanjiSet.size };
}
