import { kanjiOrder } from "@gokan/dataset-schema";
import { KanjiKnowledgeEditor } from "../../components/KanjiKnowledgeEditor";
import { useQuiz } from "../../context/useQuiz";
import { useKanjiForm } from "../../context/KanjiForm/useKanjiForm";
import { CONSTANTS } from "../../commons/constants";
import { DEFAULT_SETTINGS } from "../../models/user.model";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";

export function UserProfileScreen() {
    const { state, actions } = useQuiz();
    const { state: form } = useKanjiForm();

    const countStep = state.settings?.kanjiCountStep ?? CONSTANTS.setup.defaultKanjiCountStep;

    // The stepper's increment is a persisted preference, so it survives a reload
    // and follows the user across devices like every other setting.
    const handleCountStepChange = (step: number) => {
        actions.saveSettings({ ...(state.settings ?? DEFAULT_SETTINGS), kanjiCountStep: step });
    };

    return (
        <Page width="wide">
            <PageHeader
                title="Kanji"
                subtitle={`${form.knownKanji.size.toLocaleString('en-US')} of ${form.allKanji.length.toLocaleString('en-US')} known · ${kanjiOrder(form.kanjiMethod).label} order`}
                className="mb-6"
            />

            <KanjiKnowledgeEditor
                onKanjiKnowledgeChange={actions.updateKanjiKnowledge}
                countStep={countStep}
                onCountStepChange={handleCountStepChange}
            />
        </Page>
    );
}
