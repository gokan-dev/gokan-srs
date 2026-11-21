import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuiz } from "../../context/useQuiz";
import { drillSummary, loadDrill, runOnPath } from "../../context/quiz/drillSelectors";
import type { Drill, DrillPick } from "../../context/quiz/drillSelectors";
import type { DrillSet } from "../../models/grammar.model";
import { useAsyncData } from "../../hooks/useAsyncData";
import { drillPath, grammarChapterPath, grammarFamilyPath, vocabPath } from "../../utils/navigation.utils";
import { MixedText } from "../../components/MixedText";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";
import { LoadingScreen } from "../../components/LoadingScreen";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { QuizCardFrame } from "../../components/quiz/QuizCardFrame";
import { Button } from "../../components/ui/Button";
import { ExerciseCard } from "./ExerciseCard";

/** The set a drill route names, from its kind and its params; null when a param is missing. */
function setOf(kind: DrillSet['kind'], params: Readonly<Partial<Record<string, string>>>): DrillSet | null {
    switch (kind) {
        case 'lesson': return params.familyId && params.lessonId ? { kind, familyId: params.familyId, lessonId: params.lessonId } : null;
        case 'family': return params.familyId ? { kind, familyId: params.familyId } : null;
        case 'chapter': return params.chapterId ? { kind, chapterId: params.chapterId } : null;
        case 'point': return params.grammarId ? { kind, grammarId: params.grammarId } : null;
    }
}

/** Where Back goes from a drill with no history to pop: the page it was started from. */
function parentOf(set: DrillSet | null): string {
    switch (set?.kind) {
        case 'lesson':
        case 'family': return grammarFamilyPath(set.familyId);
        case 'chapter': return grammarChapterPath(set.chapterId);
        case 'point': return `/grammar/${set.grammarId}`;
        case undefined: return '/grammar/chapters';
    }
}

/**
 * Routes /grammar/drill/... - the contrast drill (issue #249): a short quiz over one set
 * of similar points, open to every learner on every point. Its cards run on the exercise
 * engine in `drill` mode, so nothing it is answered with reaches the SRS. The summary at
 * the end is kept only on screen.
 */
export default function DrillScreen({ kind }: { kind: DrillSet['kind'] }) {
    const params = useParams();
    const set = setOf(kind, params);
    const path = set ? drillPath(set) : null;
    const navigate = useNavigate();
    const { state, exercises, drillActions } = useQuiz();
    // The run on this page, kept while the learner looked something up from it (ended by
    // where they go next, useDrillOrchestration): coming back resumes it in its order.
    const kept = path ? runOnPath(state.drill, path) : null;
    // A fresh order on every new run: the builder takes its randomness from here.
    const [seed, setSeed] = useState(() => kept?.seed ?? String(Date.now()));
    const run = kept?.seed === seed ? kept : null;
    const loaded = useAsyncData(set && path && !run ? `${path}:${seed}` : null, () => (set ? loadDrill(set, seed) : Promise.resolve(null)));

    useEffect(() => {
        if (path && loaded.data) drillActions.startDrill(path, seed, loaded.data);
    }, [path, seed, loaded.data, drillActions]);

    const parentPath = parentOf(set);
    if (!set) return <DetailErrorScreen message="This drill does not exist." />;
    if (!run) {
        if (loaded.status === 'error') return <DetailErrorScreen message="This drill could not be loaded. Check your connection and try again." />;
        if (loaded.status === 'ready' && !loaded.data) {
            return (
                <Page width="narrow">
                    <PageHeader title="Nothing to drill here yet" parentPath={parentPath} />
                    <p className="type-body mt-4">These points do not have enough example sentences to compare yet.</p>
                </Page>
            );
        }
        // Loading, or built and about to start.
        return <LoadingScreen />;
    }

    const { drill } = run;
    const done = run.index >= drill.cards.length;

    return (
        <Page width="narrow">
            <PageHeader
                title={<>Drill: <MixedText text={drill.title} /></>}
                subtitle="Practice only: nothing you answer here changes your reviews."
                parentPath={parentPath}
                className="mb-6"
            />
            {done ? (
                <DrillSummary drill={drill} picks={run.picks} onAgain={() => setSeed(String(Date.now()))} />
            ) : (
                <>
                    <p className="type-support text-center mb-2">Card {run.index + 1} of {drill.cards.length}</p>
                    <ExerciseCard api={exercises.drill} onVocabClick={id => void navigate(vocabPath(id))} />
                </>
            )}
        </Page>
    );
}

/**
 * The end of a drill: how many right, and which pairs were confused, each linking to where the
 * family is compared. In the question card's frame, so the column keeps its edges as the drill ends.
 */
function DrillSummary({ drill, picks, onAgain }: { drill: Drill; picks: DrillPick[]; onAgain: () => void }) {
    const { right, total, confusions } = drillSummary(picks);
    const marker = (id: string) => drill.points[id]?.marker ?? id;
    return (
        <QuizCardFrame>
            <h2 className="type-section mb-2" data-drill-summary>{right} of {total} right</h2>
            {confusions.length === 0 ? (
                <p className="type-body">No pair was confused.</p>
            ) : (
                <>
                    <p className="type-label mb-3">Confused</p>
                    <ul className="space-y-2">
                        {confusions.map(c => {
                            const familyId = drill.points[c.asked]?.comparedOn;
                            const times = c.times === 1 ? 'once' : `${c.times} times`;
                            return (
                                <li key={`${c.asked}:${c.picked}`}>
                                    {/* A <p>, so `p a` underlines the link in the sentence. */}
                                    <p className="font-sans text-sm text-primary">
                                        Picked <span className="font-mincho" lang="ja">{marker(c.picked)}</span> where{" "}
                                        <span className="font-mincho" lang="ja">{marker(c.asked)}</span> fit, {times}.
                                        {familyId && (
                                            <>
                                                {" "}
                                                <Link to={grammarFamilyPath(familyId)} className="text-accent">Compare them</Link>
                                            </>
                                        )}
                                    </p>
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
            <div className="mt-6">
                <Button variant="secondary" onClick={onAgain}>Drill again</Button>
            </div>
        </QuizCardFrame>
    );
}
