import { KanjiSummary } from "../../components/KanjiSummary";
import { useAsyncData } from "../../hooks/useAsyncData";
import { VocabularyService } from "../../services/vocabulary.service";

interface KanjiTabProps {
    /** The word's kanji, in its order (`writtenForm.containedKanji`). */
    glyphs: readonly string[];
    knownKanji: ReadonlySet<string> | undefined;
}

/** Each kanji of the word, in order, in brief (KanjiSummary): its tile, meanings, readings and whether it is known. */
export function KanjiTab({ glyphs, knownKanji }: KanjiTabProps) {
    const load = useAsyncData(glyphs.join(''), () => Promise.all(glyphs.map(glyph => VocabularyService.loadKanji(glyph))));
    if (load.status === 'error') return <p className="type-support text-error">Could not load this word's kanji.</p>;
    return (
        <ul className="space-y-6">
            {glyphs.map((glyph, i) => (
                <li key={`${glyph}-${i}`}>
                    <KanjiSummary glyph={glyph} kanji={load.status === 'ready' ? load.data[i] ?? null : 'loading'} known={knownKanji?.has(glyph)} />
                </li>
            ))}
        </ul>
    );
}
