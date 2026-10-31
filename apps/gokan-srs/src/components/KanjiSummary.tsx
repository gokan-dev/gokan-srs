import type { Kanji } from "@gokan/dataset-schema";
import { CardSkeleton } from "./CardSkeleton";
import { KanjiReadings } from "./KanjiReadings";
import { KanjiTile } from "./KanjiTile";

interface KanjiSummaryProps {
    glyph: string;
    /** The kanji's own file, `loading` until it arrives, or null when the dataset has none for the glyph. */
    kanji: Kanji | null | 'loading';
    /** Whether the learner knows it; absent before onboarding has set the known kanji. */
    known: boolean | undefined;
}

/**
 * One kanji in brief: its tile linking to its page, its meanings, its on and kun readings
 * (まな(ぶ)) and whether the learner knows it. A word's Kanji tab lists one per kanji; it is the
 * body of the kanji card (#174) too.
 */
export function KanjiSummary({ glyph, kanji, known }: KanjiSummaryProps) {
    const loaded = kanji === 'loading' ? null : kanji;
    return (
        <div className="flex items-start gap-4 min-w-0">
            <KanjiTile glyph={glyph} to={`/kanji/${glyph}`} />
            <div className="min-w-0 flex-1 space-y-1">
                {kanji === 'loading' && <CardSkeleton variant="line" />}
                {loaded && loaded.meanings.length > 0 && <p className="type-body">{loaded.meanings.join(', ')}</p>}
                {loaded && <KanjiReadings kanji={loaded} size="compact" />}
                {known !== undefined && <p className="type-meta">{known ? 'Known' : 'Not known'}</p>}
            </div>
        </div>
    );
}
