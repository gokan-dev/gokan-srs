import { useMemo, useState } from "react";
import { textbookLessonsLabel } from "@gokan/dataset-schema";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { DetailField, DetailSection } from "../../components/detail/DetailSection";
import { Disclosure } from "../../components/ui/Disclosure";
import { TextButton } from "../../components/ui/TextButton";
import { WordTile } from "../../components/WordTile";
import { useQuiz } from "../../context/useQuiz";
import { CLOSENESS_LABEL, closenessOf } from "../../services/exercise/wordRelation";
import { indexLearnerVocab } from "../../utils/sentenceRanking";
import { organizeSenses, senseNumbers, type ShownSense } from "../../utils/senses.utils";
import { closestSynonyms, sectionGlossLine, synonymCount, type SynonymSection } from "../../utils/synonymSections.utils";
import { vocabPath } from "../../utils/navigation.utils";
import { pickWordExamples } from "../../utils/wordExamples.utils";
import { WordSentence } from "./WordSentence";

const INITIAL_SENSES = 3;

interface DictTabProps {
    vocab: Vocabulary;
    sentences: readonly Sentence[];
    synonymSections: SynonymSection[];
    /** "All N sentences": opens the Sentences tab. */
    onShowSentences: () => void;
    /** "Compare all N": opens the Synonyms tab. */
    onCompareSynonyms: () => void;
}

/**
 * A word page's first tab, what a dictionary entry holds: the meanings, two examples, the
 * closest synonyms, then the word's facts (KKLC step, textbooks) and the entries it merges.
 */
export function DictTab({ vocab, sentences, synonymSections, onShowSentences, onCompareSynonyms }: DictTabProps) {
    return (
        <div className="space-y-10">
            <MeaningsSection vocab={vocab} />
            <ExamplesSection vocab={vocab} sentences={sentences} onShowAll={onShowSentences} />
            <ClosestSynonyms vocab={vocab} sections={synonymSections} onCompare={onCompareSynonyms} />
            <WordFacts vocab={vocab} />
        </div>
    );
}

/** The word's place in the learning orders, and the dictionary entries it combines when merged. */
function WordFacts({ vocab }: { vocab: Vocabulary }) {
    const merged = vocab.mergedVocabs && vocab.mergedVocabs.length > 1 ? vocab.mergedVocabs : null;
    return (
        <div className="space-y-4 pt-6 border-t border-divider">
            <dl className="flex flex-wrap gap-x-8 gap-y-3">
                <DetailField compact label="KKLC step">{vocab.usuallyKana ? 'Learned in kana' : vocab.progression.kklcStep}</DetailField>
                {vocab.textbooks && vocab.textbooks.length > 0 && <DetailField compact label="Textbooks">{textbookLessonsLabel(vocab.textbooks)}</DetailField>}
            </dl>
            {merged && (
                <Disclosure title={`Combines ${merged.length} dictionary entries`}>
                    <ul className="mt-2 space-y-2">
                        {merged.map(entry => (
                            <li key={entry.id}>
                                <span className="font-gothic text-primary">{entry.originalPrimaryReading}</span>
                                <span className="type-meta ml-2">JMdict {entry.id}</span>
                                <p className="type-support">{entry.originalGlosses.join(', ')}</p>
                            </li>
                        ))}
                    </ul>
                </Disclosure>
            )}
        </div>
    );
}

function MeaningsSection({ vocab }: { vocab: Vocabulary }) {
    const [expanded, setExpanded] = useState(false);
    const { common, rare } = organizeSenses(vocab.senses);
    // A word whose every sense is rare (婦人) leads with them: there is nothing else to show.
    const lead = common.length > 0 ? common : rare;
    const rest = common.length > 0 ? rare : [];
    const total = common.length + rare.length;

    return (
        <DetailSection title="Meanings">
            <SenseList senses={expanded ? lead : lead.slice(0, INITIAL_SENSES)} start={1} />
            {expanded && rest.length > 0 && (
                <div className="mt-4">
                    <p className="type-label mb-2">Rare and archaic</p>
                    <SenseList senses={rest} start={lead.length + 1} />
                </div>
            )}
            {total > INITIAL_SENSES || rest.length > 0 ? (
                <TextButton onClick={() => setExpanded(!expanded)} className="mt-3">
                    {expanded ? 'Show fewer meanings' : `Show all ${total} meanings`}
                </TextButton>
            ) : null}
            {vocab.usageHints?.examplePattern && (
                <p className="type-support mt-4">
                    Usage: <span className="font-mincho text-base text-primary">{vocab.usageHints.examplePattern}</span>
                </p>
            )}
        </DetailSection>
    );
}

function SenseList({ senses, start }: { senses: ShownSense[]; start: number }) {
    return (
        <ol start={start} className="space-y-3 list-decimal pl-6 marker:text-tertiary marker:font-sans marker:text-sm">
            {senses.map(({ sense, posLabel }, i) => (
                <li key={i} className="pl-1">
                    {posLabel && <div className="type-meta mb-0.5">{posLabel}</div>}
                    <p className="type-body">
                        {sense.appliesToReadings && sense.appliesToReadings.length > 0 && (
                            <span className="font-gothic text-secondary mr-1">({sense.appliesToReadings.join('、')})</span>
                        )}
                        {sense.glosses.join(', ')}
                    </p>
                    {/* Strings, not entries: plain text, nothing that looks like a link. */}
                    {sense.related.compounds.length > 0 && (
                        <p className="type-support mt-0.5">
                            See also: <span className="font-mincho text-primary">{sense.related.compounds.join('、')}</span>
                        </p>
                    )}
                </li>
            ))}
        </ol>
    );
}

/** Two example sentences (pickWordExamples), and the way to all of them in the Sentences tab. */
function ExamplesSection({ vocab, sentences, onShowAll }: { vocab: Vocabulary; sentences: readonly Sentence[]; onShowAll: () => void }) {
    const { state } = useQuiz();
    const queue = state.progress?.learningQueue;
    const examples = useMemo(() => {
        const firstSense = organizeSenses(vocab.senses).common[0]?.sense.glosses ?? vocab.senses[0]?.glosses ?? [];
        return pickWordExamples(vocab.id, sentences, firstSense, indexLearnerVocab(queue));
    }, [vocab, sentences, queue]);
    if (examples.length === 0) return null;
    return (
        <DetailSection
            title="Examples"
            aside={sentences.length > examples.length
                ? <TextButton onClick={onShowAll} arrow>All {sentences.length.toLocaleString('en-US')} sentences</TextButton>
                : undefined}
        >
            <div className="space-y-4">
                {examples.map(sentence => <WordSentence key={sentence.id} vocabId={vocab.id} sentence={sentence} />)}
            </div>
        </DetailSection>
    );
}

/** Up to five words from the first sense's synonyms, each a boxed link, and the way to all of them. */
function ClosestSynonyms({ vocab, sections, onCompare }: { vocab: Vocabulary; sections: SynonymSection[]; onCompare: () => void }) {
    const closest = closestSynonyms(sections, (w, section) => closenessOf(w.pair, section.glosses) === 'distinct');
    if (!closest) return null;
    const number = senseNumbers(vocab.senses)[closest.section.sense];
    return (
        <DetailSection
            title="Closest synonyms"
            aside={<TextButton onClick={onCompare} arrow>Compare all {synonymCount(sections).toLocaleString('en-US')}</TextButton>}
        >
            <ul className="flex flex-wrap gap-2">
                {closest.words.map(word => (
                    <li key={word.vocabId} className="min-w-0 max-w-full">
                        <WordTile to={vocabPath(word.vocabId)} vocabId={word.vocabId} vocab={word.forms} sign={CLOSENESS_LABEL[closenessOf(word.pair, closest.section.glosses)]} />
                    </li>
                ))}
            </ul>
            <p className="type-meta mt-3">For meaning {number}: {sectionGlossLine(closest.section)}</p>
        </DetailSection>
    );
}
