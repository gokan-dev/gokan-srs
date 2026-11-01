import { Link } from "react-router-dom";
import { headwordOf } from "@gokan/dataset-schema";
import { useQuiz } from "../../context/useQuiz";
import { useAsyncData } from "../../hooks/useAsyncData";
import { VocabularyService } from "../../services/vocabulary.service";
import type { LookupTarget } from "../../utils/lookup.utils";
import { kanjiPath, vocabPath } from "../../utils/navigation.utils";
import { organizeSenses } from "../../utils/senses.utils";
import { CardSkeleton } from "../CardSkeleton";
import { KanjiSummary } from "../KanjiSummary";
import { PlayButton } from "../PlayButton";
import { SecondaryForm } from "../SecondaryForm";
import { WordStudyStatus } from "../WordStudyStatus";

/** Senses shown: a glance, as the old hover gloss; the word's page is one click away. */
const MAX_SENSES = 2;
const MAX_GLOSSES_PER_SENSE = 4;

/** The card's main action: 44px tall on phones, where the bottom sheet is the card. */
const OPEN_LINK = "inline-flex items-center min-h-11 md:min-h-0 font-sans text-sm text-accent hover:underline";

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
    const load = useAsyncData(vocabId, () => VocabularyService.loadVocab(vocabId));
    if (load.status === 'error') return <p className="type-support text-error">Could not load this word.</p>;
    if (load.status !== 'ready') return <CardSkeleton variant="line" />;

    const vocab = load.data;
    // The page's order (organizeSenses): the senses a learner meets first, archaic and rare ones
    // only for a word that has nothing else.
    const { common, rare } = organizeSenses(vocab.senses);
    const ordered = common.length > 0 ? common : rare;
    const senses = ordered.slice(0, MAX_SENSES);
    const hiddenSenses = vocab.senses.length - senses.length;

    return (
        <div className="space-y-2 min-w-0" data-lookup-word>
            {/* The pitch accent (issue 176) will follow the reading, before the play button. */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                <span lang="ja" className="font-mincho text-2xl text-primary">{headwordOf(vocab)}</span>
                <SecondaryForm vocab={vocab} truncate={false} />
                <PlayButton audio={vocab.audio} label={`Play ${headwordOf(vocab)}`} />
            </div>
            <ol className="space-y-0.5">
                {senses.map(({ sense, posLabel }, i) => (
                    <li key={i} className="type-support">
                        {senses.length > 1 && <span className="text-tertiary mr-1">{i + 1}.</span>}
                        {posLabel !== null && <span className="text-tertiary italic mr-1">{posLabel}</span>}
                        {sense.glosses.slice(0, MAX_GLOSSES_PER_SENSE).join(', ')}
                    </li>
                ))}
            </ol>
            {hiddenSenses > 0 && <p className="type-meta">+{hiddenSenses} more {hiddenSenses > 1 ? 'meanings' : 'meaning'}</p>}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-1">
                <WordStudyStatus vocabId={vocabId} variant="card" />
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
            <Link to={kanjiPath(glyph)} onClick={onNavigate} className={OPEN_LINK}>Open kanji page</Link>
        </div>
    );
}
