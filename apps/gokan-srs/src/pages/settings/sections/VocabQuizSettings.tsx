import { Sparkles } from "lucide-react";
import { OptionGrid } from "../../../components/OptionGrid";
import { SettingToggle } from "../../../components/ui/SettingToggle";
import type { MeaningContextThreshold, UserSettings } from "../../../models/user.model";

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
            <OptionGrid
                title="Vocabulary order"
                dense={dense}
                value={settings.preferredLearningOrder}
                onChange={(value) => update({ preferredLearningOrder: value })}
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
                        description: 'N5 first, up to N1',
                    },
                ]}
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
                <div className={`bg-surface dark:bg-surface/5 rounded-lg border border-divider ${dense ? 'p-3' : 'p-4'}`}>
                    <div className={`flex flex-col gap-1 ${dense ? 'mb-3' : 'mb-4'}`}>
                        <span className={`font-medium text-primary ${dense ? 'text-sm' : ''}`}>Target vocab per Kanji</span>
                        <span className="text-secondary text-xs">
                            How many words to learn for each kanji before prioritizing new kanji (1-5).
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={settings.kanjiCoverageTarget || 1}
                            onChange={(e) => update({ kanjiCoverageTarget: parseInt(e.target.value, 10) })}
                            className="flex-1 h-2 bg-divider rounded-lg appearance-none cursor-pointer accent-accent"
                        />
                        <span className="w-8 text-center font-bold text-primary">
                            {settings.kanjiCoverageTarget || 1}
                        </span>
                    </div>
                </div>
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

            {settings.enableMeaningQuiz !== false && (
                <OptionGrid
                    title="Train meaning in context"
                    dense={dense}
                    value={settings.meaningContextThreshold ?? 'normal'}
                    onChange={(value) => update({ meaningContextThreshold: value as MeaningContextThreshold })}
                    options={[
                        {
                            value: 'early',
                            label: 'Early',
                            description: 'Switch at 30% mastery',
                        },
                        {
                            value: 'normal',
                            label: 'Normal (Default)',
                            description: 'Switch at 50% mastery',
                        },
                        {
                            value: 'late',
                            label: 'Late',
                            description: 'Switch at 70% mastery',
                        },
                    ]}
                />
            )}
        </div>
    );
}
