import { useState } from "react";
import { Sparkles } from "lucide-react";
import { CONSTANTS } from "../../commons/constants";
import type { LearningOrder } from "../../models/user.model";
import { OptionGrid } from "../../components/OptionGrid";
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
                settings: {
                    preferredLearningOrder: learningOrder,
                    kanjiCoverageTarget: 1,
                    enableMeaningQuiz: true, // Default to true
                    learningFrequency: 'medium',
                },
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

                <OptionGrid<LearningOrder>
                    title="Vocabulary order"
                    value={learningOrder}
                    onChange={setLearningOrder}
                    options={[
                        {
                            value: 'kanji_coverage',
                            label: 'Kanji Coverage Priority',
                            description: (
                                <span className="flex items-center gap-1.5 text-accent font-medium">
                                    <Sparkles size={14} className="flex-shrink-0" />
                                    Recommended: Efficiently covers known kanji
                                </span>
                            ),
                        },
                        {
                            value: 'frequency',
                            label: 'Frequency',
                            description: 'Most common words first',
                        },
                        {
                            value: 'kklc',
                            label: 'By Kanji',
                            description: 'Follow kanji progression',
                        },
                        {
                            value: 'jlpt',
                            label: 'JLPT Level',
                            description: 'N5 first, up to N1, ignores known kanji',
                        },
                    ]}
                />

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
