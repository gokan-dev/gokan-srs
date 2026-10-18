import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { headwordOf, secondaryForm } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../../context/useQuiz";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { indexLearnerVocab } from "../../../utils/sentenceRanking";
import type { LearnerVocab } from "../../../utils/sentenceRanking";
import { mixupCount, timesLabel } from "../../../utils/mixupGroups.utils";
import type { MixupGroup, MixupPair } from "../../../utils/mixupGroups.utils";
import { InteractiveSentence } from "../../../components/InteractiveSentence";
import { ListRow } from "../../../components/ui/ListRow";
import { TagChip } from "../../../components/TagChip";
import { WordStudyStatus } from "../../../components/WordStudyStatus";
import { exampleForMeanings, markedGlosses, sensesSharing, sharedSenseType } from "./sharedSense";
import { TierChip } from "./TierChip";

/** What a group is called: the meanings its pairs share, or the asked word's first gloss when none does. */
function groupLabel(group: MixupGroup, vocabById: ReadonlyMap<string, Vocabulary>): string {
    if (group.meanings.length > 0) return group.meanings.join(' · ');
    return vocabById.get(group.asked)?.senses[0]?.glosses[0] ?? 'Not synonyms';
}

/** A word's headword; never its raw id while it loads (or failed to). */
const nameOf = (id: string, vocabById: ReadonlyMap<string, Vocabulary>) => {
    const vocab = vocabById.get(id);
    return vocab ? headwordOf(vocab) : '…';
};

/** The meanings a word shares with the others in this group. */
function meaningsOf(vocabId: string, pairs: readonly MixupPair[]): string[] {
    return [...new Set(pairs.filter(p => p.words.includes(vocabId)).flatMap(p => p.shared))];
}

interface GroupWordProps {
    vocab: Vocabulary;
    group: MixupGroup;
    vocabById: ReadonlyMap<string, Vocabulary>;
    learner: LearnerVocab;
}

/** One word of a group, read in the sense the group shares: its type, its glosses (the shared ones marked), its example. */
function GroupWord({ vocab, group, vocabById, learner }: GroupWordProps) {
    const navigate = useNavigate();
    const meanings = meaningsOf(vocab.id, group.pairs);
    const type = sharedSenseType(vocab.senses, meanings);
    const glosses = markedGlosses(sensesSharing(vocab.senses, meanings), meanings);
    const typedFor = group.pairs.flatMap(p => p.directions).filter(d => d.asked === vocab.id);

    const sentences = useAsyncData(vocab.id, () => VocabularyService.loadSentences(vocab.id)).data;
    const example = sentences ? exampleForMeanings(vocab.id, sentences, meanings, learner) : null;

    return (
        <li className="py-4 border-b border-divider last:border-b-0 space-y-2">
            <ListRow to={`/vocab/${vocab.id}`} trailing={<WordStudyStatus vocabId={vocab.id} />} className="-mx-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 min-w-0">
                    <span lang="ja" className="jp-headword">{headwordOf(vocab)}</span>
                    <span lang="ja" className="font-gothic text-sm text-secondary">{secondaryForm(vocab)}</span>
                    {type.map(label => <TagChip key={label} size="sm">{label}</TagChip>)}
                </div>
            </ListRow>

            <p className="type-support">
                {glosses.map(({ gloss, shared }, i) => (
                    <span key={gloss}>
                        {i > 0 && '; '}
                        <span className={shared ? 'text-primary font-medium' : undefined}>{gloss}</span>
                    </span>
                ))}
            </p>

            {typedFor.map(d => (
                <p key={d.typed} className="type-meta">
                    You typed <span lang="ja" className="font-gothic">{nameOf(d.typed, vocabById)}</span> for <span lang="ja" className="font-gothic">{headwordOf(vocab)}</span> {timesLabel(d.count)}
                </p>
            ))}

            {example && (
                <div>
                    <div className="text-lg text-primary">
                        <InteractiveSentence
                            sentence={example}
                            targetVocabId={vocab.id}
                            onVocabClick={id => void navigate(`/vocab/${id}`)}
                            showFurigana
                            keyboardLinks
                        />
                    </div>
                    {example.en[0] && <p className="type-support mt-1">{example.en[0].text}</p>}
                </div>
            )}
        </li>
    );
}

/**
 * One pair of the group: the two words and the tier grading uses on one line, what
 * they share and how often on a second, so every pair wraps the same way on a phone.
 */
function GroupPair({ pair, vocabById }: { pair: MixupPair; vocabById: ReadonlyMap<string, Vocabulary> }) {
    const [a, b] = pair.words;
    const meta = [pair.shared.join(', '), pair.curated ? 'marked by hand' : '', timesLabel(pair.count)].filter(Boolean);
    return (
        <li className="py-2 space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span lang="ja" className="font-mincho text-base text-primary">
                    {nameOf(a, vocabById)} / {nameOf(b, vocabById)}
                </span>
                <TierChip tier={pair.tier} />
            </div>
            <p className="type-meta">{meta.join(' · ')}</p>
        </li>
    );
}

interface MixupGroupCardProps {
    group: MixupGroup;
    vocabById: ReadonlyMap<string, Vocabulary>;
}

/** A group of words you mix up, to tell apart: each word in the sense the group shares, then each pair. */
export function MixupGroupCard({ group, vocabById }: MixupGroupCardProps) {
    const { state } = useQuiz();
    const queue = state.progress?.learningQueue;
    const learner = useMemo(() => indexLearnerVocab(queue), [queue]);
    const count = mixupCount(group.pairs);

    return (
        <section id={`group-${group.id}`} className="rounded-md border border-divider bg-surface p-5 md:p-6 min-w-0">
            <h2 className="type-subsection">{groupLabel(group, vocabById)}</h2>
            <p className="type-meta mb-2">
                {group.words.length.toLocaleString('en-US')} words · {count.toLocaleString('en-US')} {count === 1 ? 'mix-up' : 'mix-ups'}
            </p>

            <ul>
                {group.words.flatMap(id => {
                    const vocab = vocabById.get(id);
                    return vocab ? [<GroupWord key={id} vocab={vocab} group={group} vocabById={vocabById} learner={learner} />] : [];
                })}
            </ul>

            <h3 className="type-label mt-4">Pairs</h3>
            <ul>
                {group.pairs.map(pair => <GroupPair key={pair.words.join('-')} pair={pair} vocabById={vocabById} />)}
            </ul>
        </section>
    );
}
