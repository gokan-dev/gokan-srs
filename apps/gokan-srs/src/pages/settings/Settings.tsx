import { OptionGrid } from "../../components/OptionGrid";
import type { UserSettings } from "../../models/user.model";
import { useGoogleDrive } from "../../context/useGoogleDrive";
import { Cloud, Loader2, LogIn, RefreshCw, Moon, Sun, Monitor, Sparkles, KeyRound } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { SelectableOption } from "../../components/ui/SelectableOption";
import { SettingToggle } from "../../components/ui/SettingToggle";
import { useTheme } from "../../context/useTheme";
import { useState } from "react";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";

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
            <div className="flex items-center justify-between p-4 rounded-lg bg-feedback-correct/10 border border-feedback-correct/20">
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
                            <Cloud size={16} className="text-feedback-correct" />
                            <span className="text-sm font-medium text-feedback-correct">
                                {user?.name || 'Connected to Google Drive'}
                            </span>
                        </div>
                        {user?.email && (
                            <span className="text-xs text-feedback-correct/70">
                                {user.email}
                            </span>
                        )}
                    </div>
                </div>
                <button
                    onClick={() => logout()}
                    className="text-xs text-error hover:opacity-80 font-medium cursor-pointer"
                >
                    Disconnect
                </button>
            </div>

            <Button
                variant="primary"
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
                        Sync Now
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
        <Page width="narrow" className="flex flex-col items-center">
            <PageHeader title="Settings" parentPath="/" className="w-full mb-12 animate-fade-in" />

            {/*
              * Account first: signing in is what makes every other setting (and
              * all progress) follow the user across devices, so it is the first
              * thing worth doing on this page rather than the last.
              */}
            <section className="w-full mb-16 animate-slide-up">
                <h2 className="type-section mb-4">
                    Account (Google Drive sync)
                </h2>

                <div className="flex flex-col gap-4">
                    <SyncControls />
                </div>
            </section>

            {/* Appearance */}
            <section className="w-full mb-16 animate-slide-up" style={{ animationDelay: "100ms" }}>
                <h2 className="type-section mb-4">
                    Appearance
                </h2>

                <div className="grid grid-cols-3 gap-3">
                    <SelectableOption
                        selected={theme === "light"}
                        onSelect={() => setTheme("light")}
                        className="flex flex-col items-center justify-center h-20 gap-2 text-primary"
                    >
                        <Sun size={20} />
                        <span className="text-xs">Light</span>
                    </SelectableOption>
                    <SelectableOption
                        selected={theme === "dark"}
                        onSelect={() => setTheme("dark")}
                        className="flex flex-col items-center justify-center h-20 gap-2 text-primary"
                    >
                        <Moon size={20} />
                        <span className="text-xs">Dark</span>
                    </SelectableOption>
                    <SelectableOption
                        selected={theme === "system"}
                        onSelect={() => setTheme("system")}
                        className="flex flex-col items-center justify-center h-20 gap-2 text-primary"
                    >
                        <Monitor size={20} />
                        <span className="text-xs">System</span>
                    </SelectableOption>
                </div>
            </section>

            {/*
              * Review pacing is the one learning preference that is genuinely
              * global: both the vocab scheduler and grammarSrs.service read
              * learningFrequency. Everything else that used to sit here was
              * vocabulary-only, and now lives behind the cog on that activity's
              * card on the Main hub (see QuizSettingsMenu / pages/settings/sections).
              */}
            <section className="w-full mb-16 animate-slide-up" style={{ animationDelay: "200ms" }}>
                <h2 className="type-section mb-4">
                    Review pacing
                </h2>

                <OptionGrid
                    title="Learning frequency"
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
                            label: 'Medium (Default)',
                            description: 'Balanced SRS intervals',
                        },
                        {
                            value: 'low',
                            label: 'Low',
                            description: 'Relaxed pace (less frequent)',
                        },
                    ]}
                />
            </section>

            {/* AI Features */}
            <section className="w-full mb-16 animate-slide-up" style={{ animationDelay: "300ms" }}>
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={16} className="text-secondary" />
                    <h2 className="type-section m-0">
                        AI Context Validation
                    </h2>
                </div>

                <p className="text-sm text-secondary mb-6 font-gothic">
                    Enhance your study sessions by allowing Gemini to validate meaning answers that aren't strictly in the dictionary, using the context of the example sentences.
                </p>

                <div className="space-y-4">
                    <SettingToggle
                        label="Enable Context-Aware Validation"
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
                        <div className="p-4 bg-surface dark:bg-surface/5 rounded-lg border border-divider animate-fade-in-up">
                            <label className="flex items-center gap-2 mb-2 font-medium text-primary text-sm font-gothic">
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

                            <div className="mt-3 text-xs text-tertiary flex items-start gap-1">
                                <span>Note:</span>
                                <span>
                                    Your key is stored locally in your browser and is never sent to our servers. Get a free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Google AI Studio</a>.
                                </span>
                            </div>
                        </div>
                    )}

                    {settings.enableGeminiContext && (
                        <SettingToggle
                            className="animate-fade-in-up"
                            label="AI Validation on All Answers"
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
            </section>

            {/* Danger zone */}
            <section className="w-full">
                <h2 className="type-section mb-4 text-error">
                    Danger zone
                </h2>

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
                                <p className="text-xs text-center mt-2 font-gothic text-feedback-correct">
                                    Grammar progress cleared. Vocabulary and kanji are untouched.
                                </p>
                            )}
                            {grammarResetState === 'failed' && (
                                <p className="text-xs text-center mt-2 font-gothic text-feedback-incorrect">
                                    Cleared locally, but the sync failed - reconnect and retry, or your
                                    cloud copy will restore it on the next load.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="p-4 rounded-lg bg-error/5 border border-error/20 animate-fade-in-up">
                            <p className="text-sm text-center mb-1 font-medium text-error">
                                Clear every grammar point you have learned?
                            </p>
                            <p className="text-xs text-center mb-4 font-gothic text-secondary">
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
                        <div className="p-4 rounded-lg bg-error/5 border border-error/20 animate-fade-in-up">
                            <p className="text-sm text-center mb-4 font-medium text-error">
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
                                    Confirm Reset
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </Page>
    );
}
