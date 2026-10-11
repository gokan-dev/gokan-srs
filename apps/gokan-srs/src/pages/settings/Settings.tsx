import { OptionGrid } from "../../components/OptionGrid";
import type { AnswerColors, UserSettings } from "../../models/user.model";
import { useGoogleDrive } from "../../context/useGoogleDrive";
import { Cloud, Loader2, LogIn, RefreshCw, Moon, Sun, Monitor, KeyRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Theme } from "../../models/theme.model";
import { VocabQuizSettings } from "./sections/VocabQuizSettings";
import { GrammarQuizSettings } from "./sections/GrammarQuizSettings";
import { Button } from "../../components/ui/Button";
import { SelectableOption } from "../../components/ui/SelectableOption";
import { SettingToggle } from "../../components/ui/SettingToggle";
import { Disclosure } from "../../components/ui/Disclosure";
import { useTheme } from "../../context/useTheme";
import { useState } from "react";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";

const THEMES: { value: Theme; label: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

const ANSWER_COLORS: { value: AnswerColors; label: string }[] = [
    { value: 'default', label: 'Green and red' },
    { value: 'colorblind', label: 'Blue and orange (colour-blind friendly)' },
];

/**
 * The correct and incorrect colours of one pair. The pair's class rescopes the
 * two answer tokens, so each swatch shows its own pair whatever is chosen.
 */
function AnswerColorSwatch({ value }: { value: AnswerColors }) {
    return (
        <span className={`answer-colors-${value} inline-flex gap-1 shrink-0`} aria-hidden="true">
            <span className="w-4 h-4 rounded-full bg-feedback-correct" />
            <span className="w-4 h-4 rounded-full bg-feedback-incorrect" />
        </span>
    );
}

/** A settings section: a heading, an optional one-line description, the controls. */
function SettingsSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
    return (
        <section>
            <h2 className="type-section">{title}</h2>
            {description && <p className="type-support mt-1">{description}</p>}
            <div className="mt-4">{children}</div>
        </section>
    );
}

/** One activity's settings in "Activity settings": a subsection heading, collapsed. */
function ActivityDisclosure({ title, description, children }: { title: string; description: string; children: ReactNode }) {
    return (
        <Disclosure
            title={
                <span className="block min-w-0">
                    <span className="block type-subsection">{title}</span>
                    <span className="block type-support font-normal">{description}</span>
                </span>
            }
        >
            <div className="pb-4">{children}</div>
        </Disclosure>
    );
}

function SyncControls() {
    const { login, logout, downloadProgress, isDownloading, isAuthenticated, user } = useGoogleDrive();

    if (!isAuthenticated) {
        return (
            <Button
                variant="secondary"
                onClick={() => login()}
                className="w-full justify-center"
            >
                <LogIn size={18} className="mr-2" />
                Sign in with Google
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3 p-4 rounded-md bg-surface border border-divider">
                <div className="flex items-center gap-3">
                    {user?.picture && (
                        <img
                            src={user.picture}
                            alt="Profile"
                            className="w-10 h-10 rounded-full"
                        />
                    )}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <Cloud size={16} className="text-secondary" aria-hidden="true" />
                            <span className="font-sans text-sm font-medium text-primary">
                                {user?.name || 'Connected to Google Drive'}
                            </span>
                        </div>
                        {user?.email && (
                            <span className="type-meta">
                                {user.email}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => logout()}
                    className="font-sans text-sm text-error hover:underline cursor-pointer shrink-0"
                >
                    Disconnect
                </button>
            </div>

            <Button
                variant="secondary"
                onClick={() => void downloadProgress()}
                disabled={isDownloading}
                className="w-full justify-center"
            >
                {isDownloading ? (
                    <>
                        <Loader2 size={18} className="animate-spin mr-2" />
                        Syncing...
                    </>
                ) : (
                    <>
                        <RefreshCw size={18} className="mr-2" />
                        Sync now
                    </>
                )}
            </Button>
        </div>
    );
}

interface SettingsScreenProps {
    settings: UserSettings;
    onUpdateSettings: (settings: UserSettings) => void;
    onReset: () => void;
    onResetGrammar: () => Promise<void>;
}

export function SettingsScreen({
    settings,
    onUpdateSettings,
    onReset,
    onResetGrammar,
}: SettingsScreenProps) {
    const { theme, setTheme } = useTheme();
    const [isConfirmingReset, setIsConfirmingReset] = useState(false);
    const [isConfirmingGrammarReset, setIsConfirmingGrammarReset] = useState(false);
    const [grammarResetState, setGrammarResetState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');

    return (
        <Page width="narrow">
            <PageHeader title="Settings" className="mb-10" />

            <div className="space-y-10">

            {/*
              * Account first: signing in is what makes every other setting (and
              * all progress) follow the user across devices, so it is the first
              * thing worth doing on this page rather than the last.
              */}
            <SettingsSection title="Account" description="Sign in to keep your progress in your Google Drive and on every device.">
                <SyncControls />
            </SettingsSection>

            <SettingsSection title="Appearance">
                <h3 className="type-label mb-2">Theme</h3>
                <div className="grid grid-cols-3 gap-3">
                    {THEMES.map(({ value, label, icon: Icon }) => (
                        <SelectableOption
                            key={value}
                            selected={theme === value}
                            onSelect={() => setTheme(value)}
                            className="flex flex-col items-center justify-center h-20 gap-2 text-primary"
                        >
                            <Icon size={20} aria-hidden="true" />
                            <span className="font-sans text-sm">{label}</span>
                        </SelectableOption>
                    ))}
                </div>

                <h3 className="type-label mt-6 mb-2">Answer colours</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ANSWER_COLORS.map(({ value, label }) => (
                        <SelectableOption
                            key={value}
                            selected={settings.answerColors === value}
                            onSelect={() => onUpdateSettings({ ...settings, answerColors: value })}
                            className="flex items-center gap-3 p-4 pr-8 text-primary"
                        >
                            <AnswerColorSwatch value={value} />
                            <span className="font-sans text-sm">{label}</span>
                        </SelectableOption>
                    ))}
                </div>
            </SettingsSection>

            {/*
              * Review pacing is the one learning preference that is genuinely
              * global: both the vocab scheduler and grammarSrs.service read
              * learningFrequency. Everything else that used to sit here was
              * vocabulary-only, and now lives behind the cog on that activity's
              * card on the Main hub (see QuizSettingsMenu / pages/settings/sections).
              */}
            <SettingsSection title="Review pacing" description="How often reviews come back, for vocabulary and grammar alike.">
                <OptionGrid
                    columns={3}
                    value={settings.learningFrequency}
                    onChange={(value) =>
                        onUpdateSettings({
                            ...settings,
                            learningFrequency: value,
                        })
                    }
                    options={[
                        {
                            value: 'high',
                            label: 'High',
                            description: 'Faster pace (more frequent)',
                        },
                        {
                            value: 'medium',
                            label: 'Medium (default)',
                            description: 'Balanced SRS intervals',
                        },
                        {
                            value: 'low',
                            label: 'Low',
                            description: 'Relaxed pace (less frequent)',
                        },
                    ]}
                />
            </SettingsSection>

            <SettingsSection
                title="AI answer checking"
                description="Let Gemini accept meaning answers the dictionary does not list, judged against the example sentence."
            >
                <div className="space-y-4">
                    <SettingToggle
                        label="Check answers in context"
                        description="Use AI during meaning quizzes that have a sentence context. Required for sentence quizzes."
                        checked={settings.enableGeminiContext === true}
                        disabled={settings.enableMeaningQuiz === false}
                        onChange={(checked) =>
                            onUpdateSettings({
                                ...settings,
                                enableGeminiContext: checked,
                            })
                        }
                    />

                    {settings.enableGeminiContext && (
                        <div className="p-4 bg-surface rounded-md border border-divider">
                            <label className="flex items-center gap-2 mb-2 type-label">
                                <KeyRound size={16} className="text-tertiary" />
                                Gemini API Key
                            </label>

                            <input
                                type="password"
                                value={settings.geminiApiKey || ''}
                                onChange={(e) =>
                                    onUpdateSettings({
                                        ...settings,
                                        geminiApiKey: e.target.value
                                    })
                                }
                                placeholder="AIzaSy..."
                                className="w-full px-3 py-2 bg-background border border-divider rounded-md text-sm font-mono text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
                            />

                            <div className="mt-3 type-meta flex items-start gap-1">
                                <span>Note:</span>
                                <span>
                                    Your key is stored locally in your browser and is never sent to our servers. Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Google AI Studio</a>.
                                </span>
                            </div>
                        </div>
                    )}

                    {settings.enableGeminiContext && (
                        <SettingToggle
                            label="Check every answer"
                            description="When enabled, AI validates every answer in sentence quizzes. When disabled, AI only validates answers initially marked wrong or imprecise."
                            checked={settings.alwaysUseAiForMeaningContext !== false}
                            disabled={settings.enableMeaningQuiz === false}
                            onChange={(checked) =>
                                onUpdateSettings({
                                    ...settings,
                                    alwaysUseAiForMeaningContext: checked,
                                })
                            }
                        />
                    )}
                </div>
            </SettingsSection>

            {/*
              * Settings of one activity, below the global ones and collapsed, so
              * they read as that activity's options rather than as more of the
              * page. The same controls open from the cog on the activity's card.
              */}
            <SettingsSection title="Activity settings" description="Options for one activity at a time.">
                <div className="border-y border-divider divide-y divide-divider">
                    <ActivityDisclosure title="Vocabulary quiz" description="Also available from the cog on the Vocabulary card on Study.">
                        <VocabQuizSettings settings={settings} onUpdateSettings={onUpdateSettings} />
                    </ActivityDisclosure>
                    <ActivityDisclosure title="Grammar quiz" description="Also available from the cog on the Grammar card on Study.">
                        <GrammarQuizSettings />
                    </ActivityDisclosure>
                </div>
            </SettingsSection>

            <SettingsSection title="Danger zone" description="These cannot be undone.">
                <div className="flex flex-col gap-4">
                    {/*
                      * Grammar-only reset, above the all-or-nothing one. The
                      * grammar activity's teaching order changed wholesale, and
                      * there is no migration from "learned in the old order" to
                      * the new one - so starting that one activity over has to be
                      * possible without discarding vocab and kanji too.
                      */}
                    {!isConfirmingGrammarReset ? (
                        <div>
                            <Button
                                variant="danger-outline"
                                onClick={() => { setIsConfirmingGrammarReset(true); setGrammarResetState('idle'); }}
                                className="w-full justify-center"
                            >
                                Reset grammar progress only
                            </Button>
                            {grammarResetState === 'done' && (
                                <p className="type-support text-center mt-2">
                                    Grammar progress cleared. Vocabulary and kanji are kept.
                                </p>
                            )}
                            {grammarResetState === 'failed' && (
                                <p className="font-sans text-sm text-center mt-2 text-error">
                                    Cleared locally, but the sync failed - reconnect and retry, or your
                                    cloud copy will restore it on the next load.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 rounded-md bg-error/5 border border-error/20">
                            <p className="font-sans text-sm text-center mb-1 font-medium text-error">
                                Clear every grammar point you have learned?
                            </p>
                            <p className="type-support text-center mb-4">
                                Vocabulary, kanji and settings are kept. This also overwrites your
                                cloud copy, so it cannot be undone from another device.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsConfirmingGrammarReset(false)}
                                    disabled={grammarResetState === 'working'}
                                    className="flex-1 justify-center"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={() => void (async () => {
                                        setGrammarResetState('working');
                                        try {
                                            await onResetGrammar();
                                            setGrammarResetState('done');
                                        } catch {
                                            setGrammarResetState('failed');
                                        }
                                        setIsConfirmingGrammarReset(false);
                                    })()}
                                    disabled={grammarResetState === 'working'}
                                    className="flex-1 justify-center"
                                >
                                    {grammarResetState === 'working' ? 'Clearing...' : 'Clear grammar'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {!isConfirmingReset ? (
                        <Button
                            variant="danger-outline"
                            onClick={() => setIsConfirmingReset(true)}
                            className="w-full justify-center"
                        >
                            Reset all progress
                        </Button>
                    ) : (
                        <div className="p-4 rounded-md bg-error/5 border border-error/20">
                            <p className="font-sans text-sm text-center mb-4 font-medium text-error">
                                Are you sure? This cannot be undone.
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => setIsConfirmingReset(false)}
                                    className="flex-1 justify-center"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="danger"
                                    onClick={onReset}
                                    className="flex-1 justify-center"
                                >
                                    Reset everything
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </SettingsSection>
            </div>
        </Page>
    );
}
