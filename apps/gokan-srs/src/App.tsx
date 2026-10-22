import React, { Suspense, lazy } from 'react';
import './App.css';
import { OnboardingFlow } from './pages/setup/OnboardingFlow';
import { useQuiz } from "./context/useQuiz";
import { KanjiFormProvider } from "./context/KanjiForm/KanjiFormProvider";
import { useGoogleDrive } from "./context/useGoogleDrive";
import { Loader } from "./components/Loader";
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { AppHeader } from './components/nav/AppHeader';
import { BottomTabBar } from './components/nav/BottomTabBar';
import { AppFooter } from './components/nav/AppFooter';
import { isSessionPath } from './utils/navigation.utils';
import { ResumeSessionBar } from './components/ResumeSessionBar';
import { StorageFullBanner } from './components/StorageFullBanner';
import { PageRenderedSignal } from './components/PageRenderedSignal';
import { RouteSeo } from './components/RouteSeo';
import { isAboutPath } from './utils/seo.utils';

// Lazy Load Pages
// Note: Adapting named exports to default exports for lazy loading where necessary
const MainScreen = lazy(() => import('./pages/main/MainScreen').then(module => ({ default: module.MainScreen })));
const VocabQuizScreen = lazy(() => import('./pages/quiz/VocabQuizScreen').then(module => ({ default: module.VocabQuizScreen })));
const GrammarScreen = lazy(() => import('./pages/grammar/GrammarScreen').then(module => ({ default: module.GrammarScreen })));
const GrammarBrowseScreen = lazy(() => import('./pages/grammar/GrammarBrowseScreen').then(module => ({ default: module.GrammarBrowseScreen })));
const GrammarChapterBrowseScreen = lazy(() => import('./pages/grammar/GrammarChapterBrowseScreen').then(module => ({ default: module.GrammarChapterBrowseScreen })));
const SettingsScreen = lazy(() => import('./pages/settings/Settings').then(module => ({ default: module.SettingsScreen })));
const UserProfileScreen = lazy(() => import('./pages/profile/UserProfileScreen').then(module => ({ default: module.UserProfileScreen })));
const StatsScreen = lazy(() => import('./pages/stats/StatsScreen').then(module => ({ default: module.StatsScreen }))); // START_ADD (conceptually)
const AboutScreen = lazy(() => import('./pages/about/AboutScreen').then(module => ({ default: module.AboutScreen })));
const VocabDetailScreen = lazy(() => import('./pages/vocab/VocabDetailScreen'));
const VocabularyListScreen = lazy(() => import('./pages/vocab/VocabularyListScreen').then(module => ({ default: module.VocabularyListScreen })));
const KanjiDetailScreen = lazy(() => import('./pages/kanji/KanjiDetailScreen'));
const GrammarDetailScreen = lazy(() => import('./pages/grammar/GrammarDetailScreen'));
const GrammarFamilyScreen = lazy(() => import('./pages/grammar/GrammarFamilyScreen'));
const ListeningLibraryScreen = lazy(() => import('./pages/listening/ListeningLibraryScreen').then(module => ({ default: module.ListeningLibraryScreen })));
const ListeningTitleScreen = lazy(() => import('./pages/listening/ListeningTitleScreen').then(module => ({ default: module.ListeningTitleScreen })));

/** Every screen of the app, each route declaring what search engines should do with it. */
export const App: React.FC = () => (
    <>
        <RouteSeo />
        <AppScreens />
    </>
);

const AppScreens: React.FC = () => {
    const { state, actions, isSetupComplete } = useQuiz();
    const { isInitialLoadComplete, isDownloading } = useGoogleDrive();
    const navigate = useNavigate();
    const location = useLocation();

    // Show sync loader if initial sync is in progress or manual download is happening
    if (!isInitialLoadComplete || isDownloading) {
        return <Loader title="Syncing your progress..." description="進捗を同期中..." />;
    }

    // Progress is read asynchronously, in a few milliseconds: until then whether it exists is
    // unknown, so neither onboarding nor the app is shown (nor a loader that would only flash).
    if (!state.progressLoaded) {
        return <div className="min-h-screen bg-background" aria-busy="true" />;
    }

    // Fatal Error Gate
    if (state.fatalError) {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-background p-8 text-center text-error">
                <div className="text-4xl mb-4">⚠️</div>
                <h1 className="text-2xl font-semibold mb-2">System Error</h1>
                <p className="max-w-md mb-6">{state.fatalError}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-error text-white rounded hover:opacity-90 transition"
                >
                    Reload Application
                </button>
            </div>
        );
    }

    // Setup gate. About is the one route shown before it, a crawler included: it is the page
    // indexed under /about, so it must not be the onboarding flow every other route shows them.
    // It gets the app's frame, so a visitor from search sees what site this is and has links on.
    if (!isSetupComplete && !isAboutPath(location.pathname)) {
        return <KanjiFormProvider initialState={{}}>
            <OnboardingFlow onComplete={actions.setupComplete} />
        </KanjiFormProvider>
    }

    // The study sessions are shown in focus mode: no navigation, no footer.
    const focusMode = isSessionPath(location.pathname);

    return (
        <div className="min-h-screen flex flex-col relative bg-background transition-colors duration-200">
            <AppHeader focusMode={focusMode} />

            {/* Its own row beneath the header, only while a session is paused on a consult page. */}
            <StorageFullBanner />
            <ResumeSessionBar />

            {/* Screen content */}
            {/* A session card is top-aligned on a phone, so it stays above the keyboard. */}
            <main className={`flex-1 flex flex-col items-center ${focusMode ? 'p-4 md:px-6 md:pt-6 justify-start md:justify-center' : 'justify-start'}`}>
                <Suspense fallback={<Loader title="Loading..." />}>
                    {/* Before setup the only route is About: the route elements below read progress,
                        which does not exist yet. Nor does PageRenderedSignal run: the background
                        loads it starts are the study flow's. */}
                    {!isSetupComplete ? <AboutScreen /> : (
                        <>
                            <Routes>
                                <Route path="/" element={
                                    <MainScreen />
                                } />
                                <Route path="/quiz" element={
                                    <VocabQuizScreen onVocabClick={(id) => void navigate(`/vocab/${id}`)} />
                                } />
                                <Route path="/grammar" element={
                                    <GrammarScreen onVocabClick={(id) => void navigate(`/vocab/${id}`)} />
                                } />
                                <Route path="/stats" element={
                                    <StatsScreen />
                                } />
                                <Route path="/about" element={
                                    <AboutScreen />
                                } />
                                <Route path="/settings" element={
                                    <SettingsScreen
                                        settings={state.settings!}
                                        onUpdateSettings={actions.saveSettings}
                                        onReset={actions.reset}
                                        onResetGrammar={actions.resetGrammarProgress}
                                    />
                                } />
                                <Route path="/profile" element={<Navigate to="/kanji" replace />} />
                                <Route path="/kanji" element={
                                    <KanjiFormProvider initialState={{
                                        kanjiCount: state.progress!.kanjiKnowledge.step,
                                        kanjiMethod: state.progress!.kanjiKnowledge.method,
                                        knownKanji: state.progress!.kanjiKnowledge.kanjiSet
                                    }}>
                                        <UserProfileScreen />
                                    </KanjiFormProvider>
                                } />
                                <Route path="/vocab" element={
                                    <VocabularyListScreen />
                                } />
                                {/* The Mix-ups page was removed: a word's synonyms and mix-ups are on its own page. */}
                                <Route path="/vocab/mixups" element={<Navigate to="/vocab" replace />} />
                                <Route path="/vocab/:vocabId" element={
                                    <VocabDetailScreen />
                                } />
                                <Route path="/kanji/:character" element={
                                    <KanjiDetailScreen />
                                } />
                                <Route path="/grammar/browse" element={
                                    <GrammarBrowseScreen />
                                } />
                                <Route path="/grammar/chapters" element={
                                    <GrammarChapterBrowseScreen />
                                } />
                                <Route path="/grammar/family/:familyId" element={
                                    <GrammarFamilyScreen />
                                } />
                                <Route path="/grammar/:grammarId" element={
                                    <GrammarDetailScreen />
                                } />
                                <Route path="/listening" element={
                                    <ListeningLibraryScreen />
                                } />
                                <Route path="/listening/:mediaId" element={
                                    <ListeningTitleScreen />
                                } />
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                            <PageRenderedSignal />
                        </>
                    )}
                </Suspense>
            </main>

            {/* Before setup there is no tab bar (and so no More sheet), so the footer shows at
                every width: on a phone it is About's only link on to the dictionary. */}
            {!focusMode && <AppFooter alwaysVisible={!isSetupComplete} />}
            {/* Its tabs all lead to onboarding before setup. */}
            {!focusMode && isSetupComplete && <BottomTabBar />}
        </div>
    );
};
