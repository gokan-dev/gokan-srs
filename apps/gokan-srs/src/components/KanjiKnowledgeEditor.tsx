import { KANJI_ORDERS } from "@gokan/dataset-schema";
import { OptionGrid } from "./OptionGrid";
import { KanjiCountStepper } from "./KanjiCountStepper";
import { KanjiKnowledgeGrid, KnownInOrder } from "./KanjiKnowledgeGrid";
import { Disclosure } from "./ui/Disclosure";
import { Button } from "./ui/Button";
import type { KanjiKnowledge, KanjiLearningMethod } from "../models/user.model";
import { useKanjiForm } from "../context/KanjiForm/useKanjiForm";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";

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
    /**
     * Setup: the count stepper on its own under the method, then `beforeGrid`, then the grid in a
     * closed "Mark individual kanji" disclosure. Most learners know "the first N of my book", and
     * the open grid (2,300 kanji in KKLC) pushed everything after it out of reach. Omitted on the
     * profile page, where the grid is the point of the page: open, the stepper in its toolbar.
     */
    collapseGrid?: boolean;
    /** What setup shows between the count and the collapsed grid (the vocabulary order, Start learning). */
    beforeGrid?: ReactNode;
}

export function KanjiKnowledgeEditor({
    onKanjiKnowledgeChange,
    countStep,
    onCountStepChange,
    collapseGrid = false,
    beforeGrid,
}: KanjiKnowledgeEditorProps) {
    const { state, setKanjiMethod } = useKanjiForm();
    const [gridOpen, setGridOpen] = useState(false);
    const gridDisclosureRef = useRef<HTMLDivElement>(null);

    // The open grid runs to 20,000px on a phone with Start learning above it: closing it from its
    // end and bringing its title to the bottom of the screen puts the button back in view
    // (one primary button, no sticky footer: see Onboarding Flow in docs/ARCHITECTURE.md).
    const doneMarking = () => {
        flushSync(() => setGridOpen(false));
        gridDisclosureRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
    };

    // Reports every change to the knowledge being edited, once the method's list has loaded (the
    // known prefix is measured in that list). `step` is the known prefix, not the count input:
    // it sequences new words, and the input is 0 after a switch. The callback is read fresh each time without re-running
    // the effect.
    const reportChange = useEffectEvent((knowledge: KanjiKnowledge) => onKanjiKnowledgeChange?.(knowledge));
    useEffect(() => {
        if (state.loading || state.allKanji.length === 0) return;
        reportChange({
            step: state.knownPrefix,
            method: state.kanjiMethod,
            kanjiSet: state.knownKanji,
        });
    }, [state.kanjiMethod, state.knownPrefix, state.knownKanji, state.loading, state.allKanji.length]);

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

            {collapseGrid ? (
                <>
                    <KanjiCountStepper
                        step={countStep}
                        onStepChange={onCountStepChange}
                        knownReadout={<KnownInOrder allKanji={state.allKanji} method={state.kanjiMethod} />}
                    />
                    {beforeGrid}
                    <div ref={gridDisclosureRef}>
                        <Disclosure title="Mark individual kanji" open={gridOpen} onOpenChange={setGridOpen}>
                            <KanjiKnowledgeGrid allKanji={state.allKanji} method={state.kanjiMethod} />
                            <div className="flex justify-end pt-4">
                                <Button variant="ghost" onClick={doneMarking}>Done marking</Button>
                            </div>
                        </Disclosure>
                    </div>
                </>
            ) : (
                <KanjiKnowledgeGrid
                    allKanji={state.allKanji}
                    method={state.kanjiMethod}
                    toolbar={<KanjiCountStepper step={countStep} onStepChange={onCountStepChange} />}
                    followCount
                />
            )}
        </>
    );
}
