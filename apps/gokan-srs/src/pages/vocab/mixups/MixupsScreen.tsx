import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { headwordOf } from "@gokan/dataset-schema";
import { Page } from "../../../components/Page";
import { PageHeader } from "../../../components/PageHeader";
import { Disclosure } from "../../../components/ui/Disclosure";
import { Pagination } from "../../../components/ui/Pagination";
import { CardSkeleton } from "../../../components/CardSkeleton";
import { groupsWithWord } from "../../../utils/mixupGroups.utils";
import { mixupsPath } from "../../../utils/navigation.utils";
import { VocabularyTabs } from "../VocabularyTabs";
import { MixupGroupCard } from "./MixupGroupCard";
import { TierChip } from "./TierChip";
import { TIER_LABEL } from "./tierLabels";
import { useMixups } from "./useMixups";

const PAGE_SIZE = 10;
const TIERS = ['interchangeable', 'confusable', 'unrelated'] as const;

/**
 * The words you mix up, grouped by the meaning they share (issue #150). Optional:
 * nothing in a study session sends you here, though a quiz's synonym note links to
 * its word's groups (`?word=`). The groups come from your own records only: a word's
 * full synonym list is too noisy to show.
 */
export function MixupsScreen() {
    const [searchParams] = useSearchParams();
    const word = searchParams.get('word');
    const { groups, vocabById, loading } = useMixups();
    const [page, setPage] = useState(1);

    const wordVocab = word ? vocabById.get(word) : undefined;
    const shown = word ? groupsWithWord(groups, word) : groups;
    const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const current = Math.min(page, totalPages);
    const mixupCount = groups.reduce((sum, g) => sum + g.pairs.reduce((s, p) => s + p.count, 0), 0);

    return (
        <Page width="wide">
            <PageHeader
                title="Vocabulary"
                subtitle={groups.length > 0 ? `${groups.length.toLocaleString('en-US')} groups · ${mixupCount.toLocaleString('en-US')} mix-ups` : undefined}
                className="mb-4"
            />
            <VocabularyTabs />

            <div className="space-y-6">
                <div className="space-y-3">
                    <p className="type-support max-w-2xl">
                        Each time you type another word than the one asked, it is kept here, with the words it is easily confused with, grouped by the meaning they share.
                    </p>
                    <Disclosure title="What the pair labels mean">
                        <dl className="space-y-3 pt-2">
                            {TIERS.map(tier => (
                                <div key={tier}>
                                    <dt><TierChip tier={tier} /></dt>
                                    <dd className="type-support mt-1">{TIER_LABEL[tier].meaning}</dd>
                                </div>
                            ))}
                        </dl>
                    </Disclosure>
                </div>

                {word && (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="type-label">
                            Groups with <span lang="ja" className="font-gothic text-primary">{wordVocab ? headwordOf(wordVocab) : '…'}</span>
                        </span>
                        <Link to={mixupsPath()} className="text-sm text-accent hover:underline">Show all groups</Link>
                    </div>
                )}

                {loading && shown.length === 0 ? (
                    <CardSkeleton />
                ) : shown.length === 0 ? (
                    <p className="type-support">
                        {word
                            ? 'Nothing recorded with this word yet. An answer is recorded when you continue to the next card.'
                            : 'No mix-ups yet. They appear here as you study.'}
                    </p>
                ) : (
                    <>
                        {shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE).map(group => (
                            <MixupGroupCard key={group.id} group={group} vocabById={vocabById} />
                        ))}
                        <Pagination page={current} totalPages={totalPages} onPageChange={setPage} />
                    </>
                )}
            </div>
        </Page>
    );
}
