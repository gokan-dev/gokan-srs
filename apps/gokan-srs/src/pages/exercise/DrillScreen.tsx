import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuiz } from "../../context/useQuiz";
import { drillSummary, loadDrill } from "../../context/quiz/drillSelectors";
import type { Drill, DrillPick, DrillSet } from "../../context/quiz/drillSelectors";
import { useAsyncData } from "../../hooks/useAsyncData";
import { drillPath, vocabPath } from "../../utils/navigation.utils";
import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";
import { LoadingScreen } from "../../components/LoadingScreen";
import { DetailErrorScreen } from "../../components/detail/DetailErrorScreen";
import { Card } from "../../components/ui/Card";
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
        case 'family': return `/grammar/family/${set.familyId}`;
        case 'chapter': return `/grammar/chapters?chapter=${set.chapterId}`;
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
    const navigate = useNavigate();
    const { state, exercises, drillActions } = useQuiz();
    // A fresh order on every run: the builder takes its randomness from here.
    const [seed, setSeed] = useState(() => String(Date.now()));
    const loaded = useAsyncData(set ? `${drillPath(set)}:${seed}` : null, () => (set ? loadDrill(set, seed) : Promise.resolve(null)));

    useEffect(() => {
        if (loaded.data) drillActions.startDrill(loaded.data);
    }, [loaded.data, drillActions]);
    useEffect(() => () => drillActions.endDrill(), [drillActions]);

    const parentPath = parentOf(set);
    if (!set) return <DetailErrorScreen message="This drill does not exist." />;
    if (loaded.status === 'error') return <DetailErrorScreen message="This drill could not be loaded. Check your connection and try again." />;
    if (loaded.status !== 'ready') return <LoadingScreen />;
    if (!loaded.data) {
        return (
            <Page width="narrow">
                <PageHeader title="Nothing to drill here yet" parentPath={parentPath} />
                <p className="type-body mt-4">
                    A drill needs example sentences where the dataset says which of these points do not fit,
                    and these points do not have enough of them yet.
                </p>
            </Page>
        );
    }

    const drill = loaded.data;
    const run = state.drill;
    // Until the run on screen is this drill, there is nothing of it to show.
    if (run?.drill !== drill) return <LoadingScreen />;
    const done = run.index >= drill.cards.length;

    return (
        <Page width="narrow">
            <PageHeader
                title={`Drill: ${drill.title}`}
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

/** The end of a drill: how many right, and which pairs were confused, each linking to where the family is compared. */
function DrillSummary({ drill, picks, onAgain }: { drill: Drill; picks: DrillPick[]; onAgain: () => void }) {
    const { right, total, confusions } = drillSummary(picks);
    const marker = (id: string) => drill.points[id]?.marker ?? id;
    return (
        <Card size="md">
            <h2 className="type-section mb-2">{right} of {total} right</h2>
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
                                <li key={`${c.asked}:${c.picked}`} className="font-sans text-sm text-primary">
                                    Picked <span className="font-mincho" lang="ja">{marker(c.picked)}</span> where{" "}
                                    <span className="font-mincho" lang="ja">{marker(c.asked)}</span> fit, {times}.
                                    {familyId && (
                                        <>
                                            {" "}
                                            <Link to={`/grammar/family/${familyId}`} className="text-accent hover:underline">Compare them</Link>
                                        </>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}
            <div className="mt-6">
                <Button variant="secondary" onClick={onAgain}>Drill again</Button>
            </div>
        </Card>
    );
}
