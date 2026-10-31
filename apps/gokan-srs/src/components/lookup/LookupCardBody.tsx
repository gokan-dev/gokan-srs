import { Link } from "react-router-dom";
import { headwordOf } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import { hasSessionInProgress } from "../../context/quiz/quizSelectors";
import { useAsyncData } from "../../hooks/useAsyncData";
import { VocabularyService } from "../../services/vocabulary.service";
import { vocabLearningStatus } from "../../utils/learningStatus.utils";
import type { LookupTarget } from "../../utils/lookup.utils";
import { vocabPath } from "../../utils/navigation.utils";
import { CardSkeleton } from "../CardSkeleton";
import { KanjiSummary } from "../KanjiSummary";
import { SecondaryForm } from "../SecondaryForm";
import { StatusDot } from "../StatusDot";
import { Button } from "../ui/Button";

/** Senses shown: a glance, as the old hover gloss; the word's page is one click away. */
const MAX_SENSES = 2;
const MAX_GLOSSES_PER_SENSE = 4;

const OPEN_LINK = "font-sans text-sm text-accent hover:underline";

interface BodyProps {
    /** Called when a link in the card is followed, so the card closes behind it. */
    onNavigate: () => void;
}

/** What a lookup card says about its target: the word card or the kanji card. */
export function LookupCardBody({ target, onNavigate }: BodyProps & { target: LookupTarget }) {
    switch (target.kind) {
        case 'word': return <WordCardBody vocabId={target.vocabId} onNavigate={onNavigate} />;
        case 'kanji': return <KanjiCardBody glyph={target.glyph} onNavigate={onNavigate} />;
    }
}

/**
 * A word in brief: its headword and reading, its first meanings, where it is in the learner's
 * study and its page. A word not in study can be learned from here, exactly as from its page,
 * except mid-session, where the session decides what comes next.
 */
function WordCardBody({ vocabId, onNavigate }: BodyProps & { vocabId: string }) {
    const { state, actions } = useQuiz();
    const load = useAsyncData(vocabId, () => VocabularyService.loadVocab(vocabId));
    if (load.status === 'error') return <p className="type-support text-error">Could not load this word.</p>;
    if (load.status !== 'ready') return <CardSkeleton variant="line" />;

    const vocab = load.data;
    const senses = vocab.senses.slice(0, MAX_SENSES);
    const hiddenSenses = vocab.senses.length - senses.length;
    const progress = state.progress?.learningQueue.find(p => p.vocabId === vocabId);
    const canLearn = state.progress !== null && !progress && !hasSessionInProgress(state);

    return (
        <div className="space-y-2 min-w-0" data-lookup-word>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 min-w-0">
                <span lang="ja" className="font-mincho text-2xl text-primary">{headwordOf(vocab)}</span>
                <SecondaryForm vocab={vocab} truncate={false} />
            </div>
            {/* Where the pitch accent (issue 176) and the play button (issue 178) will follow the reading. */}
            <ol className="space-y-0.5">
                {senses.map((sense, i) => (
                    <li key={i} className="type-support">
                        {senses.length > 1 && <span className="text-tertiary mr-1">{i + 1}.</span>}
                        {sense.pos.length > 0 && <span className="text-tertiary italic mr-1">{sense.pos[0]}</span>}
                        {sense.glosses.slice(0, MAX_GLOSSES_PER_SENSE).join(', ')}
                    </li>
                ))}
            </ol>
            {hiddenSenses > 0 && <p className="type-meta">+{hiddenSenses} more {hiddenSenses > 1 ? 'meanings' : 'meaning'}</p>}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-1">
                {state.progress && <StatusDot status={vocabLearningStatus(progress, state.settings ?? undefined)} />}
                {canLearn && (
                    <Button variant="secondary" size="sm" onClick={() => actions.saveVocabIntroChoice(vocab, 'learn')}>
                        Learn this word
                    </Button>
                )}
                <Link to={vocabPath(vocabId)} onClick={onNavigate} className={OPEN_LINK}>Open word page</Link>
            </div>
        </div>
    );
}

/** A kanji in brief (the Kanji tab's KanjiSummary) and its page. */
function KanjiCardBody({ glyph, onNavigate }: BodyProps & { glyph: string }) {
    const { state } = useQuiz();
    const load = useAsyncData(glyph, () => VocabularyService.loadKanji(glyph));
    if (load.status === 'error') return <p className="type-support text-error">Could not load this kanji.</p>;
    return (
        <div className="space-y-3 min-w-0" data-lookup-kanji>
            <KanjiSummary glyph={glyph} kanji={load.status === 'ready' ? load.data : 'loading'} known={state.progress?.kanjiKnowledge.kanjiSet.has(glyph)} />
            <Link to={`/kanji/${glyph}`} onClick={onNavigate} className={`block ${OPEN_LINK}`}>Open kanji page</Link>
        </div>
    );
}
