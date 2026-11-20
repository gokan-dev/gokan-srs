import { StatusDot } from './StatusDot';

/**
 * A kanji's place in the learner's study, in one wording wherever it is shown (its page's header,
 * a search result): Known, a solid dot, or Not known yet, a hollow ring.
 */
export function KanjiKnownStatus({ known }: { known: boolean }) {
    return <StatusDot status={known ? 'mastered' : 'new'} label={known ? 'Known' : 'Not known yet'} />;
}
