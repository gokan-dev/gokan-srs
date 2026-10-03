import { KanjiKnowledgeEditor } from "../../components/KanjiKnowledgeEditor";
import { useQuiz } from "../../context/useQuiz";
import { CONSTANTS } from "../../commons/constants";
import { DEFAULT_SETTINGS } from "../../models/user.model";
import { PageHeader } from "../../components/PageHeader";

export function UserProfileScreen({ onBack }: { onBack: () => void; onVocabClick?: (vocabId: string) => void }) {
    const { state, actions } = useQuiz();

    const countStep = state.settings?.kanjiCountStep ?? CONSTANTS.setup.defaultKanjiCountStep;

    // The stepper's increment is a persisted preference, so it survives a reload
    // and follows the user across devices like every other setting.
    const handleCountStepChange = (step: number) => {
        actions.saveSettings({ ...(state.settings ?? DEFAULT_SETTINGS), kanjiCountStep: step });
    };

    return (
        <div className="w-full max-w-2xl md:max-w-3xl flex flex-col gap-2 animate-fade-in">
            {/* ... header ... */}
            <PageHeader title="Your learning" onBack={onBack} className="mb-6 h-12" />

            <section className="w-full mt-8">
                <h2 className="text-lg mb-4 text-primary font-serif">
                    Kanji
                </h2>

                <KanjiKnowledgeEditor
                    onKanjiKnowledgeChange={actions.updateKanjiKnowledge}
                    countStep={countStep}
                    onCountStepChange={handleCountStepChange}
                    gridHeight="36rem"
                />

            </section>


        </div>
    );
}
