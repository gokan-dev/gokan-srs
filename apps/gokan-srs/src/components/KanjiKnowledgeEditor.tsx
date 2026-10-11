import { OptionGrid } from "./OptionGrid";
import { KanjiCountStepper } from "./KanjiCountStepper";
import { KanjiKnowledgeGrid } from "./KanjiKnowledgeGrid";
import type { KanjiKnowledge, KanjiLearningMethod } from "../models/user.model";
import { useKanjiForm } from "../context/KanjiForm/useKanjiForm";
import { useEffect, useEffectEvent } from "react";

const METHODS: { value: KanjiLearningMethod; label: string; description: string }[] = [
    { value: 'kklc', label: 'KKLC', description: 'Traditional school-based order' },
];

interface KanjiKnowledgeEditorProps {
    onKanjiKnowledgeChange?: (knowledge: KanjiKnowledge) => void;
    /**
     * Increment for the count stepper's -/+ buttons. Supplied (with its setter)
     * by the profile page off UserSettings; omitted during setup, where no
     * settings object exists yet and the default increment stands.
     */
    countStep?: number;
    onCountStepChange?: (step: number) => void;
}

export function KanjiKnowledgeEditor({
    onKanjiKnowledgeChange,
    countStep,
    onCountStepChange,
}: KanjiKnowledgeEditorProps) {
    const { state } = useKanjiForm();

    // Reports every change to the knowledge being edited (and the initial value, on
    // mount). The callback is read fresh each time without re-running the effect.
    const reportChange = useEffectEvent((knowledge: KanjiKnowledge) => onKanjiKnowledgeChange?.(knowledge));
    useEffect(() => {
        reportChange({
            step: state.kanjiCount,
            method: state.kanjiMethod,
            kanjiSet: state.knownKanji,
        });
    }, [state.kanjiMethod, state.kanjiCount, state.knownKanji]);

    return (
        <>
            {/* Hidden while KKLC is the only method: a choice of one is not a choice. */}
            {METHODS.length > 1 && (
                <OptionGrid<KanjiLearningMethod>
                    title="Kanji learning method"
                    value={state.kanjiMethod}
                    options={METHODS}
                />
            )}

            <KanjiKnowledgeGrid
                allKanji={state.allKanji}
                method={state.kanjiMethod}
                toolbar={<KanjiCountStepper step={countStep} onStepChange={onCountStepChange} />}
            />
        </>
    );
}
