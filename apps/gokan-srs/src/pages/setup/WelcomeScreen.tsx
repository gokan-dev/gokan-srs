import { useState, useEffect } from "react";
import { useGoogleDrive } from "../../context/useGoogleDrive";
import { StorageService } from "../../services/storage.service";
import { Button } from "../../components/ui/Button";
import { Cloud, Loader2, LogIn, BookOpen, GraduationCap, ChevronRight } from "lucide-react";

export function GoogleLoginButton({ onSyncComplete, className }: { onSyncComplete: () => void, className?: string }) {
    const { login, isDownloading, isAuthenticated, downloadProgress } = useGoogleDrive();
    const [hasAttemptedAutoRestore, setHasAttemptedAutoRestore] = useState(false);

    // Auto-restore effect:
    useEffect(() => {
        let mounted = true;
        const tryRestore = async () => {
            if (isAuthenticated && !isDownloading) {
                // 1. Check if we already have progress (e.g. from login download)
                if (StorageService.loadProgress()) {
                    onSyncComplete();
                    return;
                }

                // 2. If not, and we haven't tried yet (e.g. page reload), try explicit download
                if (!hasAttemptedAutoRestore) {
                    setHasAttemptedAutoRestore(true);
                    await downloadProgress();
                    if (mounted) {
                        onSyncComplete();
                    }
                }
            }
        };
        void tryRestore();
        return () => { mounted = false; };
    }, [isAuthenticated, isDownloading, hasAttemptedAutoRestore, downloadProgress, onSyncComplete]);

    if (isDownloading) {
        return (
            <div className={`flex items-center gap-2 px-4 py-2 text-sm text-green-600 ${className}`}>
                <Loader2 size={16} className="animate-spin" />
                <span>Restoring your progress...</span>
            </div>
        );
    }

    if (isAuthenticated) {
        // If authenticated but we are still here (and auto-restore finished/failed),
        // show a Manual Retry button just in case.
        return (
            <Button
                variant="ghost"
                onClick={() => void downloadProgress().then(onSyncComplete)}
                className={`text-sm font-medium hover:bg-black/5 text-primary ${className}`}
            >
                <Cloud size={16} className="mr-2" />
                Retry Restore
            </Button>
        )
    }

    return (
        <Button
            variant="secondary"
            onClick={() => login()}
            className={`w-full text-sm font-medium ${className}`}
        >
            <LogIn size={16} className="mr-2" />
            Already have an account? Log in to restore
        </Button>
    );
}

interface WelcomeScreenProps {
    onSelectBeginner: () => void;
    onSelectLearner: () => void;
}

export function WelcomeScreen({ onSelectBeginner, onSelectLearner }: WelcomeScreenProps) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 bg-background relative overflow-hidden transition-colors duration-200">
            {/* Subtle floating background elements (optional flair) */}
            <div className="absolute bottom-0 right-0 opacity-[0.04] pointer-events-none select-none text-[30vw] font-mincho text-primary leading-none translate-x-1/4 translate-y-1/4">
                語感
            </div>

            <main className="w-full max-w-2xl mx-auto space-y-12 animate-fade-in z-10">
                {/* Header & Philosophy */}
                <div className="text-center space-y-6">
                    <h1 className="text-4xl md:text-5xl font-mincho text-primary mx-auto">
                        Gokan <span className="text-2xl md:text-3xl text-tertiary font-light">語感</span>
                    </h1>
                    <div className="space-y-4 text-secondary leading-relaxed font-serif max-w-xl mx-auto">
                        <p>
                            Gokan is a vocabulary SRS for Japanese learners who are actively studying kanji. It introduces words that use the kanji you already know, keeping your reading queue grounded in real, learnable material.
                        </p>
                        <p className="text-sm text-tertiary">
                            It is a companion tool, not a complete learning system. It works best alongside a kanji method like KKLC or RTK, and becomes more valuable once you start reading native Japanese.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-sm text-center max-w-xl mx-auto">
                        <div className="space-y-1 p-3 rounded-lg bg-surface border border-divider">
                            <div className="mx-auto w-8 h-8 rounded-full bg-background border border-divider flex items-center justify-center text-primary">
                                <BookOpen size={14} />
                            </div>
                            <h3 className="font-bold text-primary text-xs">Kanji-aware</h3>
                            <p className="text-tertiary text-xs">Only shows words your kanji knowledge can support.</p>
                        </div>
                        <div className="space-y-1 p-3 rounded-lg bg-surface border border-divider">
                            <div className="mx-auto w-8 h-8 rounded-full bg-background border border-divider flex items-center justify-center text-primary">
                                <GraduationCap size={14} />
                            </div>
                            <h3 className="font-bold text-primary text-xs">SRS-based</h3>
                            <p className="text-tertiary text-xs">Spaced reviews for reading and meaning, paced to your rhythm.</p>
                        </div>
                        <div className="space-y-1 p-3 rounded-lg bg-surface border border-divider">
                            <div className="mx-auto w-8 h-8 rounded-full bg-background border border-divider flex items-center justify-center text-primary">
                                <Cloud size={14} />
                            </div>
                            <h3 className="font-bold text-primary text-xs">Synced</h3>
                            <p className="text-tertiary text-xs">Progress synced across devices via Google Drive.</p>
                        </div>
                    </div>
                </div>

                {/* Path Selection */}
                <div className="space-y-4 pt-4">
                    <h2 className="text-sm uppercase tracking-widest font-gothic text-tertiary text-center mb-6">
                        Where are you in your journey?
                    </h2>

                    <div className="grid gap-4">
                        <button
                            onClick={onSelectBeginner}
                            className="group flex items-center justify-between p-6 bg-surface border border-divider hover:border-accent/40 rounded-xl transition-all shadow-sm hover:shadow-md text-left"
                        >
                            <div className="pr-4">
                                <h3 className="font-bold text-lg text-primary font-gothic flex items-center gap-2 mb-1">
                                    Just starting out
                                </h3>
                                <p className="text-sm text-secondary font-serif">
                                    I'm beginning my kanji journey. Start me from the very beginning in KKLC order.
                                </p>
                            </div>
                            <ChevronRight className="text-tertiary group-hover:text-accent transition-colors flex-shrink-0" />
                        </button>

                        <button
                            onClick={onSelectLearner}
                            className="group flex items-center justify-between p-6 bg-surface border border-divider hover:border-accent/40 rounded-xl transition-all shadow-sm hover:shadow-md text-left"
                        >
                            <div className="pr-4">
                                <h3 className="font-bold text-lg text-primary font-gothic flex items-center gap-2 mb-1">
                                    I already know some kanji
                                </h3>
                                <p className="text-sm text-secondary font-serif">
                                    Set my current level so vocabulary matches my kanji knowledge.
                                </p>
                            </div>
                            <ChevronRight className="text-tertiary group-hover:text-accent transition-colors flex-shrink-0" />
                        </button>
                    </div>
                </div>

                {/*
                  Deliberately not a third path button: the dictionary is not a way into the
                  app, it is the way out of needing one. Someone who landed here from a search
                  and is not ready to set up an SRS can still get an answer, and setup stops
                  being a wall in front of the only useful thing on the page.

                  A plain <a>, not a router link: gokan-dictionary is a separate statically
                  generated app on the /dictionary prefix of this same origin. It 404s under
                  `bun run dev`, where only this app is served.
                */}
                <p className="text-center text-sm text-tertiary font-serif">
                    Just want to look something up?{' '}
                    <a href="/dictionary/" className="text-secondary underline underline-offset-2 hover:text-primary transition-colors">
                        Browse the dictionary
                    </a>
                    , no setup required.
                </p>

                {/* Load Existing */}
                <div className="pt-8 border-t border-divider w-full max-w-sm mx-auto">
                    <GoogleLoginButton onSyncComplete={() => window.location.reload()} />
                </div>
            </main>
        </div>
    );
}
