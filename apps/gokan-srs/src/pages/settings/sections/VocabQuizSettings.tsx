import { LearningOrderPicker } from "../../../components/LearningOrderPicker";
import { SettingToggle } from "../../../components/ui/SettingToggle";
import { SettingSlider } from "../../../components/ui/SettingSlider";
import { meaningContextThresholdOf } from "../../../utils/srs.utils";
import type { UserSettings } from "../../../models/user.model";

interface VocabQuizSettingsProps {
    settings: UserSettings;
    onUpdateSettings: (settings: UserSettings) => void;
    /** Tighter layout, for the in-quiz settings popover. */
    dense?: boolean;
}

/**
 * Every setting that only ever affects the vocabulary quiz: which words get
 * introduced next, and how they are tested. Rendered both from the global
 * settings page (under "Activity settings") and from the vocabulary quiz's own
 * cog popover, so the two can never drift apart.
 *
 * Deliberately excludes `learningFrequency` (SRS pacing - grammar's scheduler
 * reads it too) and the Gemini/AI options (global by design, and context-aware
 * validation is expected to reach other activities), which stay global.
 */
export function VocabQuizSettings({ settings, onUpdateSettings, dense = false }: VocabQuizSettingsProps) {
    const update = (patch: Partial<UserSettings>) => onUpdateSettings({ ...settings, ...patch });

    return (
        <div className={dense ? "space-y-4" : "space-y-8"}>
            <LearningOrderPicker
                dense={dense}
                value={settings.preferredLearningOrder}
                onChange={(value) => update({ preferredLearningOrder: value })}
            />

            {settings.preferredLearningOrder !== 'kklc' && (
                <SettingToggle
                    dense={dense}
                    label="Ignore known kanji requirement"
                    description="Introduce vocabulary even if you haven't learned all of its kanji yet, applying the trade-off to the order selected above."
                    checked={settings.ignoreKnownKanjiRequirement === true}
                    onChange={(checked) => update({ ignoreKnownKanjiRequirement: checked })}
                />
            )}

            {settings.preferredLearningOrder === 'kanji_coverage' && (
                <SettingSlider
                    dense={dense}
                    label="Target vocab per Kanji"
                    description="How many words to learn for each kanji before prioritizing new kanji (1-5)."
                    min={1}
                    max={5}
                    step={1}
                    value={settings.kanjiCoverageTarget ?? 1}
                    valueText={String(settings.kanjiCoverageTarget ?? 1)}
                    onChange={(value) => update({ kanjiCoverageTarget: value })}
                />
            )}

            <SettingToggle
                dense={dense}
                label="Enable Meaning Quizzes"
                description="Test English meaning after reading (recommended)"
                checked={settings.enableMeaningQuiz !== false}
                onChange={(checked) => update({ enableMeaningQuiz: checked })}
            />

            <SettingToggle
                dense={dense}
                label="Enable Production Quizzes"
                description="Recall the Japanese reading from its English meaning. Words join this gradually, as each comes up for review."
                checked={settings.enableProductionQuiz !== false}
                onChange={(checked) => update({ enableProductionQuiz: checked })}
            />

            {settings.enableMeaningQuiz !== false && (() => {
                const threshold = meaningContextThresholdOf(settings);
                const valueText = threshold === 0
                    ? 'From the first review'
                    : threshold === 200
                        ? 'Never'
                        : `From ${threshold} on the meaning ring`;
                return (
                    <SettingSlider
                        dense={dense}
                        label="Train meaning in context"
                        description="Meaning quizzes switch to example sentences once the word's meaning ring reaches this value. 100 fills the first loop; 200 means only mastered words, so never."
                        min={0}
                        max={200}
                        step={10}
                        value={threshold}
                        valueText={valueText}
                        ariaValueText={valueText}
                        onChange={(value) => update({ meaningContextThresholdPoints: value })}
                    />
                );
            })()}
        </div>
    );
}
