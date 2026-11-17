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
    /**
     * Setup opened from a link with a count: once the order's list is in, scroll the count into
     * view (it sits under the method cards, below a phone's first screen, and further down for an
     * order behind "More methods"). Not focused: a phone would open its keyboard over it.
     */
    revealCount?: boolean;
}

export function KanjiKnowledgeEditor({
    onKanjiKnowledgeChange,
    countStep,
    onCountStepChange,
    collapseGrid = false,
    beforeGrid,
    revealCount = false,
}: KanjiKnowledgeEditorProps) {
    const { state, setKanjiMethod } = useKanjiForm();
    const [gridOpen, setGridOpen] = useState(false);
    const gridDisclosureRef = useRef<HTMLDivElement>(null);
    const countRef = useRef<HTMLDivElement>(null);
    const revealed = useRef(false);

    // Once: a later switch of method or count is the learner's own and keeps their scroll.
    const listLoaded = !state.loading && state.allKanji.length > 0;
    useEffect(() => {
        if (!revealCount || !listLoaded || revealed.current) return;
        revealed.current = true;
        countRef.current?.scrollIntoView({ block: 'nearest' });
    }, [revealCount, listLoaded]);

    // The open grid runs to 20,000px on a phone with Start learning above it: closing it from its
    // end and bringing its title to the bottom of the screen puts the button back in view
    // (one primary button, no sticky footer: see Onboarding Flow in docs/ARCHITECTURE.md).
    // Closing unmounts the focused "Done marking", so focus moves to the disclosure's toggle
    // rather than dropping to <body>: Shift+Tab from there reaches Start learning.
    const doneMarking = () => {
        flushSync(() => setGridOpen(false));
        gridDisclosureRef.current?.querySelector('button')?.focus({ preventScroll: true });
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
                    {/* A margin under it when scrolled to: off the screen's very edge, and in view if a line settles after. */}
                    <div ref={countRef} className="scroll-mb-6">
                        <KanjiCountStepper
                            step={countStep}
                            onStepChange={onCountStepChange}
                            knownReadout={<KnownInOrder allKanji={state.allKanji} method={state.kanjiMethod} />}
                        />
                    </div>
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
