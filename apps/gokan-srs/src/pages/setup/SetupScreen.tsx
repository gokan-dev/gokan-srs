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
            state.kanjiCount >= CONSTANTS.setup.minimumKanjiCount &&
            state.kanjiCount <= CONSTANTS.setup.maximumKanjiCount
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

    if (state.loading) {
        return (<Loader title="Loading..." />)
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background transition-colors duration-200">
            <div className="w-full max-w-2xl md:max-w-3xl mx-auto p-8 space-y-12">
                <SetupHeader />

                <KanjiKnowledgeEditor />

                <LearningOrderPicker value={learningOrder} onChange={setLearningOrder} />

                <footer className="pt-4 space-y-4">
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!state.knownKanji}
                        className="w-full py-4 text-lg font-serif h-14"
                    >
                        Start learning
                    </Button>

                </footer>
            </div>
        </div>
    );
}
