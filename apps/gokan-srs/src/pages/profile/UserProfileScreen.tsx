import { KanjiKnowledgeEditor } from "../../components/KanjiKnowledgeEditor";
import { useQuiz } from "../../context/useQuiz";
import { CONSTANTS } from "../../commons/constants";
import { DEFAULT_SETTINGS } from "../../models/user.model";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";

export function UserProfileScreen() {
    const { state, actions } = useQuiz();

    const countStep = state.settings?.kanjiCountStep ?? CONSTANTS.setup.defaultKanjiCountStep;

    // The stepper's increment is a persisted preference, so it survives a reload
    // and follows the user across devices like every other setting.
    const handleCountStepChange = (step: number) => {
        actions.saveSettings({ ...(state.settings ?? DEFAULT_SETTINGS), kanjiCountStep: step });
    };

    return (
        <Page width="wide" className="flex flex-col gap-2">
            <PageHeader title="Kanji" parentPath="/" className="mb-6" />

            <section className="w-full mt-8">
                <h2 className="type-section mb-4">
                    Kanji
                </h2>

                <KanjiKnowledgeEditor
                    onKanjiKnowledgeChange={actions.updateKanjiKnowledge}
                    countStep={countStep}
                    onCountStepChange={handleCountStepChange}
                    gridHeight="36rem"
                />
            </section>
        </Page>
    );
}
