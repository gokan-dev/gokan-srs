import { headwordOf, secondaryForm } from "@gokan/dataset-schema";
import { RelatedEntriesCard } from "../../../components/RelatedEntriesCard";
import { otherWord, pairsWithWord, timesLabel } from "../../../utils/mixupGroups.utils";
import { mixupsPath } from "../../../utils/navigation.utils";
import { TierChip } from "./TierChip";
import { useMixups } from "./useMixups";

/**
 * A word's own mix-ups, from the learner's records: each other word, the tier grading
 * uses, what they share, and how often. Absent when there are none. The word's full
 * synonym list is not shown: it is too noisy to be useful (状態 lists 16 words).
 * Drawn as related entries, so it reads like "Related words" on the same page.
 */
export function OftenMixedUpWith({ vocabId }: { vocabId: string }) {
    const { pairs, vocabById } = useMixups(vocabId);
    const mine = pairsWithWord(pairs, vocabId);
    if (mine.length === 0) return null;

    return (
        <RelatedEntriesCard
            title="Often mixed up with"
            count={mine.length}
            headerLink={{ to: mixupsPath(vocabId), label: 'Compare them in Mix-ups' }}
            sections={[{
                entries: mine.map(pair => {
                    const other = otherWord(pair, vocabId);
                    const vocab = vocabById.get(other);
                    return {
                        key: other,
                        to: `/vocab/${other}`,
                        // Never the raw id while the word loads (or failed to).
                        primary: vocab ? headwordOf(vocab) : '…',
                        secondary: (
                            <>
                                {vocab && <span lang="ja" className="font-gothic text-sm text-secondary">{secondaryForm(vocab)}</span>}
                                <TierChip tier={pair.tier} />
                            </>
                        ),
                        trailing: <span className="type-meta tabular-nums">{timesLabel(pair.count)}</span>,
                        description: pair.shared.length > 0 ? pair.shared.join(', ') : undefined,
                    };
                }),
            }]}
        />
    );
}
