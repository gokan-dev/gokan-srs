import type { ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import type { GrammarPoint } from "@gokan/dataset-schema";
import type { GrammarBlankPlan, GrammarConjugationPrompt } from "../../context/quiz/grammarReducer";
import { JlptChip } from "../../components/JlptChip";
import { QuizMasteryCorner } from "../../components/quiz/QuizMasteryCorner";
import { PointLink } from "./PointLink";

// The grammar activity's prompts: what each of its exercises shows above the answer.
// The answering itself (inputs, hints, feedback) is the shared card's.

/**
 * Register hint shown while the question is still open. Deliberately the
 * STRUCTURED formalityLevel and not the free-text usageNote: the note names the
 * form on 37 of 379 points ("...ないです instead of ません. (どこへも variant.)"),
 * which handed the learner the answer. A label drawn from a fixed vocabulary
 * cannot leak it, while still disambiguating which register is being asked for -
 * which is what #42 needed the note for in the first place.
 */
const FORMALITY_HINT: Record<string, string> = {
    'casual': 'Casual',
    'neutral': 'Neutral',
    'polite': 'Polite',
    'formal': 'Formal',
    'very-formal-literary': 'Literary',
};

interface GrammarCardHeaderProps {
    point: Pick<GrammarPoint, 'id' | 'jlptLevel'>;
    memoryStrength: number;
    /** The point's page is a spoiler until the card is answered (see PointLink). */
    answered: boolean;
    /** The register of the form shown, when the card asks for one. */
    formalityLevel?: string;
    /** Which of the point's equivalent forms this card drills. */
    realization?: GrammarBlankPlan['realization'];
    children?: ReactNode;
}

/** The top of every grammar card: mastery, JLPT, the register asked for, the link to the point once answered. */
export function GrammarCardHeader({ point, memoryStrength, answered, formalityLevel, realization, children }: GrammarCardHeaderProps) {
    return (
        <>
            <QuizMasteryCorner memoryStrength={memoryStrength} />
            <div className="mb-4">
                <div className="flex items-center justify-center gap-2">
                    <JlptChip level={point.jlptLevel} />
                    {formalityLevel && FORMALITY_HINT[formalityLevel] && (
                        <span className="text-xs font-gothic text-secondary border border-divider rounded px-2 py-0.5">
                            {FORMALITY_HINT[formalityLevel]}
                        </span>
                    )}
                    {realization && realization.total > 1 && (
                        <span
                            className="text-xs font-gothic text-tertiary"
                            title="This rule has several equivalent forms; one is drilled per review, and they share one mastery score."
                        >
                            form {realization.index} of {realization.total}
                        </span>
                    )}
                    <PointLink pointId={point.id} revealed={answered} />
                </div>
                {children}
            </div>
        </>
    );
}

/** The cue above a sentence: what to do, then the English it starts from. */
export function SentenceCue({ instruction, english }: { instruction: string; english: string }) {
    return (
        <>
            <p className="text-center text-sm text-secondary font-gothic mb-1">{instruction}</p>
            <p className="text-center text-lg text-primary font-serif mb-8">{english}</p>
        </>
    );
}

const CLASS_LABELS: Record<string, string> = {
    'godan': 'godan (u-verb)',
    'ichidan': 'ichidan (ru-verb)',
    'irregular': 'irregular',
    'i-adjective': 'い-adjective',
    'na-adjective': 'な-adjective',
};

/**
 * The transformation drill's prompt, for `kind: 'inflection'` points: the ones
 * whose identity is a derivation rather than a fixed marker, so a sentence cloze
 * has nothing invariant to blank. A dictionary form, then the form asked for.
 */
export function ConjugationPrompt({ prompt }: { prompt: GrammarConjugationPrompt }) {
    return (
        <>
            <p className="text-center text-xs text-tertiary font-gothic mb-3">
                {CLASS_LABELS[prompt.wordClass] ?? prompt.wordClass}
            </p>
            <div className="text-center">
                <p className="text-3xl font-mincho text-primary leading-snug">{prompt.lemma}</p>
                <p className="text-sm text-tertiary font-gothic mt-1">{prompt.lemmaReading}</p>
            </div>

            <div className="text-center mt-4">
                <ArrowDown className="inline-block w-5 h-5 text-tertiary" aria-hidden="true" />
                <p className="uppercase tracking-wide text-label-neutral text-xs font-gothic mt-1">
                    {prompt.formLabel}
                </p>
            </div>
        </>
    );
}

/** The drill's answer, with every other form accepted. */
export function ConjugationAnswer({ prompt, size }: { prompt: GrammarConjugationPrompt; size: 'sm' | 'lg' }) {
    return (
        <>
            <AnswerWithReading written={prompt.target} reading={prompt.targetReading} size={size} />
            {size === 'lg' && prompt.alternatives && prompt.alternatives.length > 0 && (
                <p className="text-xs text-tertiary font-gothic mt-2">
                    also accepted: {prompt.alternatives.join(', ')}
                </p>
            )}
        </>
    );
}

/**
 * The correct answer with its reading above it as furigana.
 *
 * The reading is the whole point: this drill's answers are kanji-stemmed, so
 * showing only the written form hides a READING error entirely. A learner who
 * answered たくないです for 高くないです was shown 高くないです back and had no way
 * to see that the mistake was in たか, not in the inflection they were being
 * tested on.
 *
 * Falls back to the written form alone when the two are identical, which is the
 * case for any kana-only answer (するとく, 見たい's kana twin) - furigana that
 * repeats the line below it is just noise.
 */
function AnswerWithReading({ written, reading, size }: { written: string; reading: string; size: 'sm' | 'lg' }) {
    const main = size === 'lg' ? 'text-2xl' : 'text-base';
    const rt = size === 'lg' ? 'text-[0.45em]' : 'text-[0.5em]';

    if (!reading || reading === written) {
        return <p className={`${main} font-mincho text-primary`}>{written}</p>;
    }

    return (
        <p className={`${main} font-mincho text-primary leading-loose`}>
            <ruby>
                {written}
                <rt className={`${rt} font-gothic text-tertiary select-none tracking-wide`}>{reading}</rt>
            </ruby>
        </p>
    );
}
