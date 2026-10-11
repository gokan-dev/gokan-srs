import { useEffect } from "react";
import type { AnswerColors } from "../models/user.model";

/**
 * Puts the answer-colour choice on the root element, like the dark theme:
 * `index.css` overrides `--feedback-correct` and `--feedback-incorrect` under
 * `.answer-colors-colorblind`, so every answer result follows it.
 */
export function useAnswerColors(answerColors: AnswerColors | undefined): void {
    useEffect(() => {
        document.documentElement.classList.toggle('answer-colors-colorblind', answerColors === 'colorblind');
    }, [answerColors]);
}
