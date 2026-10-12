import { useState } from "react";
import { CONSTANTS } from "../../commons/constants";
import { DEFAULT_SETTINGS, type LearningOrder } from "../../models/user.model";
import { LearningOrderPicker } from "../../components/LearningOrderPicker";
import { SetupHeader } from "../../components/SetupHeader";
import type { SetupValues } from "../../models/state.model";
import { KanjiKnowledgeEditor } from "../../components/KanjiKnowledgeEditor";
import { useKanjiForm } from "../../context/KanjiForm/useKanjiForm";
import { Button } from "../../components/ui/Button";
import { Loader } from "../../components/Loader";

export function SetupScreen({ onComplete }: { onComplete: (values: SetupValues) => void }) {
    const { state } = useKanjiForm();

    const [learningOrder, setLearningOrder] = useState<LearningOrder>('kanji_coverage');

    const handleSubmit = () => {
        if (
            !state.loading &&
            state.kanjiCount >= CONSTANTS.setup.minimumKanjiCount &&
            state.kanjiCount <= state.allKanji.length
        ) {
            const values: SetupValues = {
                kanjiKnowledge: {
                    method: state.kanjiMethod,
                    step: state.kanjiCount,
                    kanjiSet: new Set(state.knownKanji),
                },
                settings: { ...DEFAULT_SETTINGS, preferredLearningOrder: learningOrder },
            }
            onComplete(values);
        }
    };

    // Only the first list blocks the page; switching method keeps it up while the next one loads.
    if (state.loading && state.allKanji.length === 0) {
        return (<Loader title="Loading..." />)
    }

    return (
        // The page gutter is Page's (px-4 on a phone, md:px-6), not 64px a side: doubled p-8 left the
        // method cards and the kanji grid 190px wide at 320px.
        <div className="min-h-screen flex items-center justify-center px-4 py-6 md:p-8 bg-background transition-colors duration-200">
            <div className="w-full max-w-2xl md:max-w-3xl mx-auto md:p-8 space-y-12">
                <SetupHeader />

                <KanjiKnowledgeEditor />

                <LearningOrderPicker value={learningOrder} onChange={setLearningOrder} />

                <footer className="pt-4 space-y-4">
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={state.loading}
                        className="w-full py-4 text-lg font-serif h-14"
                    >
                        Start learning
                    </Button>

                </footer>
            </div>
        </div>
    );
}
