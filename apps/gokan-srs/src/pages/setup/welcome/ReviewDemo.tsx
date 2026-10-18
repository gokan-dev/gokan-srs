import { useId, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Ruby } from "../../../components/Ruby";
import { demoAnswerIsRight, type WelcomeExample } from "./welcomeExamples";

/**
 * Step three's working mini review card. A marketing demo, not the exercise engine: it checks
 * the answer against the example's own accept-list (`demoAnswerIsRight`), never `gradeExercise`.
 * Keyed by order in HowItWorks, so a new order starts it fresh: unchecked, the input refilled.
 */
export function ReviewDemo({ example }: { example: WelcomeExample }) {
    const inputId = useId();
    const [answer, setAnswer] = useState<string>(example.accept[0]);
    const [checked, setChecked] = useState(false);
    const right = demoAnswerIsRight(example, answer);
    const shown = checked ? "opacity-100" : "opacity-0";

    return (
        <div className="max-w-[420px] rounded-md border border-divider bg-surface p-5">
            <p lang="ja" className="mb-3.5 font-mincho text-xl leading-[2] text-primary">
                {example.before}
                {/* The reading stays hidden until checked: before that it would give the answer away. */}
                <span className={`underline decoration-accent decoration-[1.5px] underline-offset-[6px] [&_rt]:transition-opacity [&_rt]:duration-[220ms] [&_rt]:ease-in-out ${checked ? "" : "[&_rt]:opacity-0"}`}>
                    <Ruby text={example.word} reading={example.kana} tone="text-secondary" />
                </span>
                {example.after}
            </p>
            <p aria-hidden={!checked} className={`-mt-2 mb-3.5 text-[13px] text-tertiary transition-opacity duration-200 ease-in-out ${shown}`}>
                {example.en}
            </p>
            <label htmlFor={inputId} className="mb-2 block text-sm text-secondary">
                What does <span lang="ja" className="font-mincho">{example.word}</span> mean here?
            </label>
            <div className="flex gap-2">
                <input
                    id={inputId}
                    value={answer}
                    onChange={e => { setAnswer(e.target.value); setChecked(false); }}
                    onKeyDown={e => { if (e.key === "Enter") setChecked(true); }}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 min-w-0 flex-1 rounded-md border border-divider bg-background px-3 text-base text-primary outline-none transition-colors duration-200 focus:border-accent"
                />
                <Button variant="secondary" onClick={() => setChecked(true)}>Check</Button>
            </div>
            <p aria-live="polite" className={`mt-2.5 mb-0 min-h-5 text-sm transition-[opacity,transform] duration-200 ease-in-out ${right ? "text-feedback-correct" : "text-feedback-incorrect"} ${checked ? "opacity-100" : "translate-y-[3px] opacity-0"}`}>
                {checked && <>{right ? "Correct." : "Not quite."} <span lang="ja">{example.word}</span>, <span lang="ja">{example.kana}</span>: {example.gloss}.</>}
            </p>
        </div>
    );
}
