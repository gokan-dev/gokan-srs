import type { ReactNode, Ref } from "react";
import { blankWidthEm } from "../../utils/blankWidth";
import { AnswerInput } from "./AnswerInput";

interface ClozeBlankProps {
    value: string;
    onChange: (value: string) => void;
    /** A Japanese blank with "Type romaji as kana" on (ExerciseTurnApi.convertsRomaji). */
    convertsRomaji: boolean;
    inputRef?: Ref<HTMLInputElement>;
    /** Tailwind border classes for the underline (see blankBorderClass). */
    borderClass: string;
    feedbackShown: boolean;
    /** 0 none, 1 gloss shown, 2 answer revealed (the input then holds the answer). */
    hintLevel: number;
    onHint: () => void;
    gloss: string;
    /** The dictionary form the blank asks a form of (AnswerSlot.given), shown before it. */
    given?: string;
    /** Shown under the blank once answered, e.g. the correct form. */
    reveal?: ReactNode;
}

/**
 * One inline answer blank in a sentence: an underline input sized from what is typed
 * (never from the answer, which would leak its length), a "?" hint that shows the gloss
 * then the answer, and a slot under it for the correct form after answering. Shared by
 * the grammar cloze and the vocab production cloze. A blank that asks for a form of
 * a named word shows that word in front of it.
 */
export function ClozeBlank({ value, onChange, convertsRomaji, inputRef, borderClass, feedbackShown, hintLevel, onHint, gloss, given, reveal }: ClozeBlankProps) {
    const revealed = hintLevel >= 2;
    return (
        <span className="inline-flex flex-col items-center mx-0.5 align-middle">
            <span className="inline-flex items-center gap-1">
                {given && <span lang="ja" className="text-base text-secondary font-gothic whitespace-nowrap">（{given}）</span>}
                <AnswerInput
                    inputRef={inputRef}
                    value={value}
                    onValueChange={onChange}
                    convertsRomaji={convertsRomaji}
                    disabled={feedbackShown || revealed}
                    style={{ width: `${blankWidthEm(value)}em` }}
                    className={`border-b-2 bg-transparent text-center focus:outline-none transition-colors font-gothic caret-accent ${borderClass}`}
                />
                {!feedbackShown && !revealed && (
                    <button
                        type="button"
                        onClick={onHint}
                        className="text-xs text-secondary hover:text-primary transition-colors font-gothic w-4 h-4 rounded-full border border-divider flex items-center justify-center shrink-0"
                        aria-label="Show hint"
                    >
                        ?
                    </button>
                )}
            </span>
            {!feedbackShown && hintLevel === 1 && (
                <span className="text-xs text-secondary font-gothic mt-1 whitespace-nowrap">
                    {gloss || 'No hint available'}
                </span>
            )}
            {feedbackShown && reveal}
        </span>
    );
}
