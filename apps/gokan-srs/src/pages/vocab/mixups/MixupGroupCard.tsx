import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { useQuiz } from "../../../context/useQuiz";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { indexLearnerVocab } from "../../../utils/sentenceRanking";
import type { LearnerVocab } from "../../../utils/sentenceRanking";
import type { MixupGroup, MixupPair } from "../../../utils/mixupGroups.utils";
import { InteractiveSentence } from "../../../components/InteractiveSentence";
import { ListRow } from "../../../components/ui/ListRow";
import { TagChip } from "../../../components/TagChip";
import { WordStudyStatus } from "../../../components/WordStudyStatus";
import { exampleForMeanings, markedGlosses, sensesSharing, sharedSenseType } from "./sharedSense";
import { TierChip } from "./TierChip";

const times = (n: number) => (n === 1 ? 'once' : `${n.toLocaleString('en-US')} times`);

/** What a group is called: the meanings its pairs share, or the asked word's first gloss when none does. */
function groupLabel(group: MixupGroup, vocabById: ReadonlyMap<string, Vocabulary>): string {
    if (group.meanings.length > 0) return group.meanings.join(' · ');
    return vocabById.get(group.asked)?.senses[0]?.glosses[0] ?? 'Not synonyms';
}

const nameOf = (id: string, vocabById: ReadonlyMap<string, Vocabulary>) => {
    const vocab = vocabById.get(id);
    return vocab ? headwordOf(vocab) : id;
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
                    <span lang="ja" className="font-gothic text-sm text-secondary">{vocab.reading.primary}</span>
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
                    You typed <span lang="ja" className="font-gothic">{nameOf(d.typed, vocabById)}</span> for <span lang="ja" className="font-gothic">{headwordOf(vocab)}</span> {times(d.count)}
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

/** One pair of the group: the two words, the tier grading uses, what they share, and how often. */
function GroupPair({ pair, vocabById }: { pair: MixupPair; vocabById: ReadonlyMap<string, Vocabulary> }) {
    const [a, b] = pair.words;
    return (
        <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 min-w-0">
            <span lang="ja" className="font-mincho text-base text-primary">
                {nameOf(a, vocabById)} / {nameOf(b, vocabById)}
            </span>
            <TierChip tier={pair.tier} />
            {pair.shared.length > 0 && <span className="type-support">{pair.shared.join(', ')}</span>}
            {pair.curated && <span className="type-meta">marked by hand</span>}
            <span className="type-meta tabular-nums">{times(pair.count)}</span>
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
    const count = group.pairs.reduce((sum, p) => sum + p.count, 0);

    return (
        <section id={`group-${group.id}`} className="rounded-md border border-divider bg-surface p-4 md:p-6 min-w-0">
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
