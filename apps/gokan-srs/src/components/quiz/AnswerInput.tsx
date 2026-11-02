import { useRef } from "react";
import type { ChangeEvent, CompositionEvent, FocusEvent, InputHTMLAttributes, Ref } from "react";
import { convertRomajiInput, finishRomajiInput } from "@gokan/dataset-schema";

type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'ref'>;

interface AnswerInputProps extends NativeInputProps {
    value: string;
    onValueChange: (value: string) => void;
    /** A Japanese answer with "Type romaji as kana" on (ExerciseTurnApi.convertsRomaji). */
    convertsRomaji: boolean;
    inputRef?: Ref<HTMLInputElement>;
}

/** Marks every answer field (`data-answer-input` below), so a blur can tell moving to another blank from leaving the answer. */
const ANSWER_INPUT_ATTRIBUTE = 'data-answer-input';

/** Text a composition ended with that a Latin keyboard typed (Gboard composes words), not an IME's kana. */
const LATIN_ONLY = /^[\x20-\x7e]*$/;

/**
 * Every typed answer's field: the single-answer card's and each cloze blank. On a
 * Japanese answer it converts romaji to kana as it is typed (convertRomajiInput),
 * keeping the caret where it was, and settles a final "n" as ん when focus moves to
 * another answer field; submitting settles it too (useExerciseTurn's submittedAnswers).
 * Any other blur (the Hint button, another tab, a phone keyboard closing) leaves the
 * "n" pending, as an IME does, so kan, away, then i is かに.
 *
 * A real IME is left alone: nothing is rewritten while a composition is in
 * progress, and its kana pass through the converter. A predictive keyboard (Gboard)
 * composes Latin words as well, so a composition that ends in plain ASCII is
 * converted then. Rewriting mid-composition would fight the keyboard over the text.
 */
export function AnswerInput({ value, onValueChange, convertsRomaji, inputRef, onBlur, onCompositionStart, onCompositionEnd, ...rest }: AnswerInputProps) {
    const composing = useRef(false);

    const convert = (input: HTMLInputElement) => {
        const next = convertRomajiInput(input.value, input.selectionStart ?? input.value.length);
        // Written to the field before the state, so React finds it already showing the
        // new value and never moves the caret to the end.
        if (next.text !== input.value) {
            input.value = next.text;
            input.setSelectionRange(next.caret, next.caret);
        }
        onValueChange(next.text);
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const midComposition = composing.current || (e.nativeEvent instanceof InputEvent && e.nativeEvent.isComposing);
        if (convertsRomaji && !midComposition) convert(e.currentTarget);
        else onValueChange(e.currentTarget.value);
    };

    const handleCompositionEnd = (e: CompositionEvent<HTMLInputElement>) => {
        composing.current = false;
        if (convertsRomaji && LATIN_ONLY.test(e.data)) convert(e.currentTarget);
        onCompositionEnd?.(e);
    };

    const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
        const toAnswer = e.relatedTarget instanceof HTMLElement && e.relatedTarget.hasAttribute(ANSWER_INPUT_ATTRIBUTE);
        if (convertsRomaji && toAnswer) {
            const finished = finishRomajiInput(e.currentTarget.value);
            if (finished !== e.currentTarget.value) onValueChange(finished);
        }
        onBlur?.(e);
    };

    return (
        <input
            {...rest}
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onCompositionStart={(e) => {
                composing.current = true;
                onCompositionStart?.(e);
            }}
            onCompositionEnd={handleCompositionEnd}
            onBlur={handleBlur}
            data-answer-input=""
            // No suggestions, corrections or capitals: an answer is typed key by key, and a
            // keyboard's prediction would compose (and hold back) the romaji being converted.
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
        />
    );
}
