import type { Ref } from "react";
import { useResponsive } from "../../context/Responsive/useResponsive";

const BASE = 'w-full font-medium rounded-lg font-serif flex items-center justify-center gap-2';

/** Height and top margin: vocab cards space the button off the input; cloze cards sit it under the feedback note. */
function sizing(isMobile: boolean, flush: boolean): string {
    if (flush) return 'h-12';
    return isMobile ? 'h-10 mt-4' : 'h-12 mt-6';
}

interface SubmitButtonProps {
    canSubmit: boolean;
    /** Shows a spinner while an answer is being evaluated (AI context, synonym lookup). */
    evaluating?: boolean;
    /** Hints at the Enter key (vocab cards, which have one input). */
    showEnterKey?: boolean;
    label?: string;
    flush?: boolean;
}

/** A quiz card's submit button. */
export function SubmitButton({ canSubmit, evaluating = false, showEnterKey = false, label = 'Submit', flush = false }: SubmitButtonProps) {
    const { isMobile } = useResponsive();
    const enabled = canSubmit && !evaluating;
    return (
        <div className="group">
            <button
                type="submit"
                disabled={!enabled}
                onMouseDown={(e) => e.preventDefault()}
                className={`${BASE} transition-all duration-200 ${sizing(isMobile, flush)}
                    ${enabled
                        ? 'bg-accent text-surface hover:bg-accent-hover shadow-md hover:shadow-lg translate-y-0 active:translate-y-[1px]'
                        : 'bg-accent/50 text-surface/80 cursor-not-allowed'}`}
            >
                {evaluating ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-surface" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Evaluating...</span>
                    </>
                ) : (
                    <>
                        <span>{label}</span>
                        {showEnterKey && canSubmit && <span className="text-xs opacity-70">⏎</span>}
                    </>
                )}
            </button>
            {showEnterKey && !canSubmit && !isMobile && !evaluating && (
                <p className="text-center text-xs text-tertiary mt-2 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    Press Enter
                </p>
            )}
        </div>
    );
}

interface ContinueButtonProps {
    buttonRef?: Ref<HTMLButtonElement>;
    /** A plain button calling this; without it, the button submits the card's form. */
    onClick?: () => void;
    showEnterKey?: boolean;
    flush?: boolean;
}

/** A quiz card's continue button, shown once feedback is up. */
export function ContinueButton({ buttonRef, onClick, showEnterKey = false, flush = false }: ContinueButtonProps) {
    const { isMobile } = useResponsive();
    return (
        <button
            ref={buttonRef}
            type={onClick ? 'button' : 'submit'}
            onClick={onClick}
            className={`${BASE} transition-colors bg-accent text-surface hover:bg-accent-hover shadow-md ${sizing(isMobile, flush)}`}
        >
            <span>Continue</span>
            {showEnterKey && <span className="text-xs opacity-70">⏎</span>}
        </button>
    );
}
