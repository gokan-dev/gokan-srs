import { KANJI_ORDERS } from "@gokan/dataset-schema";
import { OptionGrid } from "./OptionGrid";
import { KanjiCountStepper } from "./KanjiCountStepper";
import { KanjiKnowledgeGrid } from "./KanjiKnowledgeGrid";
import { Disclosure } from "./ui/Disclosure";
import type { KanjiKnowledge, KanjiLearningMethod } from "../models/user.model";
import { useKanjiForm } from "../context/KanjiForm/useKanjiForm";
import { useEffect, useEffectEvent } from "react";

const METHODS = KANJI_ORDERS.map(order => ({ value: order.id, label: order.label, description: order.description }));

/** The methods most learners follow; the other books wait behind "More methods". */
const MAIN_METHOD_COUNT = 4;

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
    const { state, setKanjiMethod } = useKanjiForm();

    // Reports every change to the knowledge being edited, once the method's list has loaded (the
    // count is measured in that list). The callback is read fresh each time without re-running
    // the effect.
    const reportChange = useEffectEvent((knowledge: KanjiKnowledge) => onKanjiKnowledgeChange?.(knowledge));
    useEffect(() => {
        if (state.loading || state.allKanji.length === 0) return;
        reportChange({
            step: state.kanjiCount,
            method: state.kanjiMethod,
            kanjiSet: state.knownKanji,
        });
    }, [state.kanjiMethod, state.kanjiCount, state.knownKanji, state.loading, state.allKanji.length]);

    const mainMethods = METHODS.slice(0, MAIN_METHOD_COUNT);
    const moreMethods = METHODS.slice(MAIN_METHOD_COUNT);
    const choosesMore = moreMethods.some(method => method.value === state.kanjiMethod);

    return (
        <>
            <section className="space-y-2">
                <OptionGrid<KanjiLearningMethod>
                    title="Kanji learning method"
                    value={state.kanjiMethod}
                    options={mainMethods}
                    onChange={setKanjiMethod}
                />
                <Disclosure title="More methods" defaultOpen={choosesMore}>
                    <OptionGrid<KanjiLearningMethod>
                        value={state.kanjiMethod}
                        options={moreMethods}
                        onChange={setKanjiMethod}
                    />
                </Disclosure>
            </section>

            <KanjiKnowledgeGrid
                allKanji={state.allKanji}
                method={state.kanjiMethod}
                toolbar={<KanjiCountStepper step={countStep} onStepChange={onCountStepChange} />}
            />
        </>
    );
}
