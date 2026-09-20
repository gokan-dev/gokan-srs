import React, { Suspense, lazy } from 'react';
import './App.css';
import { OnboardingFlow } from './pages/setup/OnboardingFlow';
import { Logo } from './components/Logo';
import { UserRound, Cloud, CloudOff, RefreshCw, BarChart2, Library } from 'lucide-react';
import { useQuiz } from "./context/useQuiz";
import { KanjiFormProvider } from "./context/KanjiForm/KanjiFormProvider";
import { useGoogleDrive } from "./context/GoogleDriveContext";
import { Loader } from "./components/Loader";
import { Routes, Route, useNavigate, useLocation, Navigate, Link } from 'react-router-dom';
import { SearchBar } from './components/SearchBar';

// Lazy Load Pages
// Note: Adapting named exports to default exports for lazy loading where necessary
const MainScreen = lazy(() => import('./pages/main/MainScreen').then(module => ({ default: module.MainScreen })));
const VocabQuizScreen = lazy(() => import('./pages/quiz/VocabQuizScreen').then(module => ({ default: module.VocabQuizScreen })));
const GrammarScreen = lazy(() => import('./pages/grammar/GrammarScreen').then(module => ({ default: module.GrammarScreen })));
const GrammarBrowseScreen = lazy(() => import('./pages/grammar/GrammarBrowseScreen').then(module => ({ default: module.GrammarBrowseScreen })));
const SettingsScreen = lazy(() => import('./pages/settings/Settings').then(module => ({ default: module.SettingsScreen })));
const UserProfileScreen = lazy(() => import('./pages/profile/UserProfileScreen').then(module => ({ default: module.UserProfileScreen })));
const StatsScreen = lazy(() => import('./pages/stats/StatsScreen').then(module => ({ default: module.StatsScreen }))); // START_ADD (conceptually)
const AboutScreen = lazy(() => import('./pages/about/AboutScreen').then(module => ({ default: module.AboutScreen })));
const VocabDetailScreen = lazy(() => import('./pages/vocab/VocabDetailScreen'));
const KanjiDetailScreen = lazy(() => import('./pages/kanji/KanjiDetailScreen'));
const GrammarDetailScreen = lazy(() => import('./pages/grammar/GrammarDetailScreen'));
const GrammarFamilyScreen = lazy(() => import('./pages/grammar/GrammarFamilyScreen'));

function SyncStatusIndicator() {
    const { isUploading, isDownloading, isAuthenticated, syncPaused, login } = useGoogleDrive();

    if (!isAuthenticated) return null;

    if (syncPaused) {
        return (
            <button
                onClick={() => login()}
                title="Sync paused: your Google session expired. Click to reconnect."
                className="text-secondary hover:text-primary transition-colors cursor-pointer"
            >
                <CloudOff size={18} />
            </button>
        );
    }

    if (isUploading || isDownloading) {
        return <RefreshCw size={18} className="animate-spin text-gray-400" />;
    }

    return (
        <div className="text-green-500" title="Synced with Google Drive">
            <Cloud size={18} />
        </div>
    );
}

export const App: React.FC = () => {
    const { state, actions, isSetupComplete } = useQuiz();
    const { isInitialLoadComplete, isDownloading } = useGoogleDrive();
    const navigate = useNavigate();
    const location = useLocation();

    // Show sync loader if initial sync is in progress or manual download is happening
    if (!isInitialLoadComplete || isDownloading) {
        return <Loader title="Syncing your progress..." description="進捗を同期中..." />;
    }

    // Fatal Error Gate
    if (state.fatalError) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-red-50 p-8 text-center text-red-900">
                <div className="text-4xl mb-4">⚠️</div>
                <h1 className="text-2xl font-bold mb-2">System Error</h1>
                <p className="max-w-md mb-6">{state.fatalError}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                    Reload Application
                </button>
            </div>
        );
    }

    // Setup gate
    if (!isSetupComplete) {
        return <KanjiFormProvider initialState={{}}>
            <OnboardingFlow onComplete={actions.setupComplete} />
        </KanjiFormProvider>
    }

    // The Main hub ('/') is the landing page - the About link belongs there, mirroring
    // where it lived when the quiz screen itself was '/'. The quiz session ('/quiz')
    // keeps the vertically-centered layout its single-card content is designed for;
    // every other page (including the hub's activity cards) is top-aligned instead.
    const isMainScreen = location.pathname === '/';
    const isQuizScreen = location.pathname === '/quiz' || location.pathname === '/grammar';

    return (
        <div className="min-h-screen flex flex-col relative bg-background transition-colors duration-200">
            {/*
              * Top bar. One row from `md` up; on a phone the search bar wraps onto
              * a second full-width row of its own, because sharing row one with the
              * logo and five icons left it too narrow to read what you had typed.
              * `order` (rather than two separate markup blocks) keeps a single
              * header in the DOM, so nothing remounts when the viewport crosses the
              * breakpoint and the field does not lose focus mid-search.
              */}
            <header className={'flex flex-wrap items-center gap-x-2 gap-y-3 p-4 md:flex-nowrap md:gap-x-4 md:p-8'}>
                <Link to="/" className="order-1 cursor-pointer shrink-0">
                    <Logo />
                </Link>

                <div className={'order-2 grow md:order-3'}></div>

                <div className="order-3 flex gap-4 items-center md:order-4">
                    <SyncStatusIndicator />
                    <button
                        onClick={() => navigate("/grammar/browse")}
                        title="Browse grammar points"
                        aria-label="Browse grammar points"
                        className={`cursor-pointer transition-colors ${location.pathname === '/grammar/browse' ? 'text-primary' : 'text-secondary hover:text-primary'}`}
                    >
                        <Library size={18} />
                    </button>
                    <button onClick={() => navigate("/stats")} title="Statistics" className="cursor-pointer text-secondary hover:text-primary transition-colors">
                        <BarChart2 size={18} />
                    </button>
                    <button onClick={() => navigate("/profile")} title="Kanji Configuration" className="cursor-pointer text-secondary hover:text-primary transition-colors flex items-center justify-center">
                        <span className="font-mincho font-bold text-[18px] leading-none">漢</span>
                    </button>
                    {/*
                      * A person icon, not a cog: the cog now belongs to the
                      * per-activity settings on the quiz screens, so keeping one
                      * here would read as "the same thing, globally". This page
                      * leads with the Google account and holds what is genuinely
                      * account-wide.
                      */}
                    <button onClick={() => navigate("/settings")} title="Profile and global settings" aria-label="Profile and global settings" className="cursor-pointer text-secondary hover:text-primary transition-colors">
                        <UserRound size={18} />
                    </button>
                </div>

                {/* Last in the DOM, but `order` puts it between the logo and the spacer from `md` up. */}
                <SearchBar className="order-4 w-full md:order-2 md:w-64 lg:w-96" />
            </header>

            {/* Screen content */}
            <div className={`flex-1 flex flex-col items-center p-4 md:p-0 ${isQuizScreen ? 'justify-center' : 'justify-start'}`}>
                <Suspense fallback={<Loader title="Loading..." />}>
                    <Routes>
                        <Route path="/" element={
                            <MainScreen />
                        } />
                        <Route path="/quiz" element={
                            <VocabQuizScreen onVocabClick={(id) => navigate(`/vocab/${id}`)} />
                        } />
                        <Route path="/grammar" element={
                            <GrammarScreen />
                        } />
                        <Route path="/stats" element={
                            <StatsScreen
                                onBack={() => navigate('/')}
                                onVocabClick={(id) => navigate(`/vocab/${id}`)}
                                onGrammarClick={(id) => navigate(`/grammar/${id}`)}
                            />
                        } />
                        <Route path="/about" element={
                            <AboutScreen onBack={() => navigate('/')} />
                        } />
                        <Route path="/settings" element={
                            <SettingsScreen
                                settings={state.settings!}
                                onUpdateSettings={actions.saveSettings}
                                onReset={actions.reset}
                                onResetGrammar={actions.resetGrammarProgress}
                                onBack={() => navigate('/')}
                            />
                        } />
                        <Route path="/profile" element={
                            <KanjiFormProvider initialState={{
                                kanjiCount: state.progress!.kanjiKnowledge.step,
                                kanjiMethod: state.progress!.kanjiKnowledge.method,
                                knownKanji: state.progress!.kanjiKnowledge.kanjiSet
                            }}>
                                <UserProfileScreen
                                    onBack={() => navigate('/')}
                                    onVocabClick={(id) => navigate(`/vocab/${id}`)}
                                />
                            </KanjiFormProvider>
                        } />
                        <Route path="/vocab/:vocabId" element={
                            <VocabDetailScreen />
                        } />
                        <Route path="/kanji/:character" element={
                            <KanjiDetailScreen />
                        } />
                        <Route path="/grammar/browse" element={
                            <GrammarBrowseScreen />
                        } />
                        <Route path="/grammar/family/:familyId" element={
                            <GrammarFamilyScreen />
                        } />
                        <Route path="/grammar/:grammarId" element={
                            <GrammarDetailScreen />
                        } />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
            </div>

            {/* Footer links - only shown on the Main hub landing page */}
            {isMainScreen && (
                <footer className="p-4 flex items-center justify-center gap-4">
                    <Link
                        to="/about"
                        className="text-xs text-secondary hover:text-primary transition-colors"
                    >
                        About Gokan SRS
                    </Link>
                    {/*
                      A plain <a>, not a <Link>: the dictionary is a separate statically
                      generated app served from the /dictionary prefix of this same origin, so
                      it is a real page load rather than a route this SPA knows about. Same tab
                      deliberately - it is part of the same site, and the dictionary's own
                      footer links back here.

                      Note this 404s under `bun run dev`, where only the SRS app is served.
                    */}
                    <a
                        href="/dictionary/"
                        className="text-xs text-secondary hover:text-primary transition-colors"
                    >
                        Dictionary
                    </a>
                </footer>
            )}
        </div>
    );
};
