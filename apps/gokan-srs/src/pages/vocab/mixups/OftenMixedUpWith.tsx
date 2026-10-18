import { Link } from "react-router-dom";
import { headwordOf } from "@gokan/dataset-schema";
import { DetailSection } from "../../../components/detail/DetailSection";
import { otherWord, pairsWithWord } from "../../../utils/mixupGroups.utils";
import { mixupsPath } from "../../../utils/navigation.utils";
import { TierChip } from "./TierChip";
import { useMixups } from "./useMixups";

/**
 * A word's own mix-ups, from the learner's records: each other word, the tier grading
 * uses, what they share, and how often. Absent when there are none. The word's full
 * synonym list is not shown: it is too noisy to be useful (状態 lists 16 words).
 */
export function OftenMixedUpWith({ vocabId }: { vocabId: string }) {
    const { pairs, vocabById } = useMixups(vocabId);
    const mine = pairsWithWord(pairs, vocabId);
    if (mine.length === 0) return null;

    return (
        <DetailSection title="Often mixed up with" count={mine.length}>
            <ul className="space-y-3">
                {mine.map(pair => {
                    const other = otherWord(pair, vocabId);
                    const vocab = vocabById.get(other);
                    return (
                        <li key={other} className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <Link to={`/vocab/${other}`} lang="ja" className="font-mincho text-lg text-accent hover:underline">
                                    {vocab ? headwordOf(vocab) : other}
                                </Link>
                                {vocab && <span lang="ja" className="font-gothic text-sm text-secondary">{vocab.reading.primary}</span>}
                                <TierChip tier={pair.tier} />
                            </div>
                            <p className="type-meta">
                                {pair.shared.length > 0 ? `${pair.shared.join(', ')} · ` : ''}
                                {pair.count === 1 ? 'once' : `${pair.count.toLocaleString('en-US')} times`}
                            </p>
                        </li>
                    );
                })}
            </ul>
            <div className="mt-4">
                <Link to={mixupsPath(vocabId)} className="text-sm text-accent hover:underline">Compare them in Mix-ups</Link>
            </div>
        </DetailSection>
    );
}
