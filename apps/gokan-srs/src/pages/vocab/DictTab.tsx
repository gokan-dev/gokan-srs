import { useMemo, useState } from "react";
import type { Sentence, Vocabulary } from "@gokan/dataset-schema";
import { DetailSection } from "../../components/detail/DetailSection";
import { MixedText } from "../../components/MixedText";
import { Disclosure } from "../../components/ui/Disclosure";
import { TextButton } from "../../components/ui/TextButton";
import { WordTile } from "../../components/WordTile";
import { useQuiz } from "../../context/useQuiz";
import { CLOSENESS_LABEL, closenessOf } from "../../services/exercise/wordRelation";
import { indexLearnerVocab } from "../../utils/sentenceRanking";
import { organizeSenses, senseNumbers, type ShownSense } from "../../utils/senses.utils";
import { closestSynonyms, sectionGlossLine, synonymCount, type SynonymSection } from "../../utils/synonymSections.utils";
import { pickWordExamples } from "../../utils/wordExamples.utils";
import { WordSentence } from "../../components/WordSentence";

const INITIAL_SENSES = 3;

interface DictTabProps {
    vocab: Vocabulary;
    sentences: readonly Sentence[];
    synonymSections: SynonymSection[];
    /** "All N sentences": opens the Sentences tab. */
    onShowSentences: () => void;
    /** "Compare all N": opens the Synonyms tab. */
    onCompareSynonyms: () => void;
    /** A common pattern: opens the Sentences tab filtered on it (its index in `vocab.patterns`). */
    onShowPattern: (pattern: number) => void;
}

/**
 * A word page's first tab, what a dictionary entry holds: the meanings, its common patterns, two
 * examples, the closest synonyms, then the entries it merges (its KKLC step and textbooks are in
 * the header).
 */
export function DictTab({ vocab, sentences, synonymSections, onShowSentences, onCompareSynonyms, onShowPattern }: DictTabProps) {
    return (
        <div className="space-y-10">
            <MeaningsSection vocab={vocab} />
            <CommonPatterns vocab={vocab} onShow={onShowPattern} />
            <ExamplesSection vocab={vocab} sentences={sentences} onShowAll={onShowSentences} />
            <ClosestSynonyms vocab={vocab} sections={synonymSections} onCompare={onCompareSynonyms} />
            <MergedEntries vocab={vocab} />
        </div>
    );
}

/** The dictionary entries a merged word combines, at the tab's foot. */
function MergedEntries({ vocab }: { vocab: Vocabulary }) {
    const merged = vocab.mergedVocabs && vocab.mergedVocabs.length > 1 ? vocab.mergedVocabs : null;
    if (!merged) return null;
    return (
        <div className="pt-6 border-t border-divider">
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

/**
 * The frequent forms the word takes in its sentences (不思議に思う, 年を取る), the most used first,
 * each with how many sentences hold it: an action, which opens Sentences filtered on it.
 */
function CommonPatterns({ vocab, onShow }: { vocab: Vocabulary; onShow: (pattern: number) => void }) {
    const patterns = vocab.patterns ?? [];
    if (patterns.length === 0) return null;
    return (
        <DetailSection title="Common patterns">
            <ul className="flex flex-wrap gap-x-6 gap-y-3">
                {patterns.map((pattern, index) => (
                    <li key={pattern.text} className="min-w-0 max-w-full">
                        <button
                            type="button"
                            onClick={() => onShow(index)}
                            className="inline-flex items-baseline gap-2 max-w-full min-w-0 rounded-md text-accent hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                            <span lang="ja" className="font-mincho text-lg break-all">{pattern.text}</span>
                            <span className="type-meta tabular-nums">
                                {pattern.sentences.toLocaleString('en-US')}
                                <span className="sr-only"> {pattern.sentences === 1 ? 'sentence' : 'sentences'}</span>
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </DetailSection>
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

/**
 * Up to five words from the first sense's synonyms, each a boxed link, and the way to all of them.
 * When any of them says how it differs from this word (its nuance line), they become a list: each
 * tile, then its line.
 */
function ClosestSynonyms({ vocab, sections, onCompare }: { vocab: Vocabulary; sections: SynonymSection[]; onCompare: () => void }) {
    const closest = closestSynonyms(sections, (w, section) => closenessOf(w.pair, section.glosses) === 'distinct');
    if (!closest) return null;
    const number = senseNumbers(vocab.senses)[closest.section.sense];
    const tile = (word: (typeof closest.words)[number]) => (
        <WordTile vocabId={word.vocabId} vocab={word.forms} sign={CLOSENESS_LABEL[closenessOf(word.pair, closest.section.glosses)]} />
    );
    const listed = closest.words.some(word => word.nuance !== undefined);
    return (
        <DetailSection
            title="Closest synonyms"
            aside={<TextButton onClick={onCompare} arrow>Compare all {synonymCount(sections).toLocaleString('en-US')}</TextButton>}
        >
            {listed ? (
                <ul className="space-y-3">
                    {closest.words.map(word => (
                        <li key={word.vocabId} className="flex flex-col items-start gap-1 min-w-0">
                            {tile(word)}
                            {word.nuance && <p className="type-support"><MixedText text={word.nuance} unbroken /></p>}
                        </li>
                    ))}
                </ul>
            ) : (
                <ul className="flex flex-wrap gap-2">
                    {closest.words.map(word => <li key={word.vocabId} className="min-w-0 max-w-full">{tile(word)}</li>)}
                </ul>
            )}
            <p className="type-meta mt-3">For meaning {number}: {sectionGlossLine(closest.section)}</p>
        </DetailSection>
    );
}
