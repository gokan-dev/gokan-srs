import type { AnswerSlot, SlotGrade } from "../../services/exercise/types";
import { SelectableOption } from "../ui/SelectableOption";

interface SlotChoicesProps {
    slot: AnswerSlot;
    /** The option picked so far, as the turn holds it. */
    value: string;
    onPick: (text: string) => void;
    /** Set once the card is answered: the options stop responding and show which one fits. */
    grade?: SlotGrade;
}

/**
 * The options of a slot answered by picking (AnswerSlot.choices), for any exercise.
 * While answering, the picked option is the selected one; once answered, the one
 * that fits is, and a wrong pick is written in the incorrect colour, so the two are
 * never told apart by a border alone.
 */
export function SlotChoices({ slot, value, onPick, grade }: SlotChoicesProps) {
    const choices = slot.choices ?? [];
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="group" aria-label="Choices">
            {choices.map(choice => {
                const fits = choice.text === slot.reveal;
                const wrongPick = !!grade && !fits && value === choice.text;
                return (
                    <SelectableOption
                        key={choice.text}
                        selected={grade ? fits : value === choice.text}
                        onSelect={() => onPick(choice.text)}
                        disabled={!!grade}
                        className="px-4 py-3 pr-8 min-w-0"
                    >
                        <span lang="ja" className={`text-lg font-gothic ${wrongPick ? 'text-feedback-incorrect' : 'text-primary'}`}>
                            {choice.text}
                        </span>
                    </SelectableOption>
                );
            })}
        </div>
    );
}

/** Why each wrong option does not fit: the part of a choice card that answers "why was I wrong", shown whatever was picked. */
export function ChoiceNotes({ slot }: { slot: AnswerSlot }) {
    const notes = (slot.choices ?? []).filter(choice => choice.note);
    if (notes.length === 0) return null;
    return (
        <ul className="mt-2 space-y-1">
            {notes.map(choice => (
                <li key={choice.text} className="text-xs font-gothic text-secondary">
                    <span lang="ja" className="text-primary">{choice.text}</span>
                    {' '}{choice.note}
                </li>
            ))}
        </ul>
    );
}

/** The blank of a picked slot inside its sentence: what was picked, on the same underline a typed blank has. */
export function ChoiceBlank({ value, borderClass }: { value: string; borderClass: string }) {
    return (
        <span lang="ja" className={`inline-block min-w-[3em] mx-0.5 border-b-2 text-center font-gothic align-baseline ${borderClass}`}>
            {/* A non-breaking space holds the line height while nothing is picked. */}
            {value || ' '}
        </span>
    );
}
