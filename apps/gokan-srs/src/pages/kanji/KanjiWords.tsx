import { useMemo, useState } from "react";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { SecondaryForm } from "../../components/SecondaryForm";
import { WordStudyStatus } from "../../components/WordStudyStatus";
import { ListRow } from "../../components/ui/ListRow";
import { Marked } from "../../components/ui/Marked";
import { TextButton } from "../../components/ui/TextButton";
import { useAsyncData } from "../../hooks/useAsyncData";
import { VocabularyService } from "../../services/vocabulary.service";
import { englishRanges, resultCountLine, type ExploreQuery } from "../../utils/exploreSearch.utils";
import { vocabPath } from "../../utils/navigation.utils";
import { PanelSearch } from "../vocab/explore/PanelSearch";
import { useIndexSearch } from "../vocab/explore/useIndexSearch";
import { usePanelQuery } from "../vocab/explore/usePanelQuery";

/** A kanji's Words tab, 20 at a time (一 has 660 words). */
const PAGE = 20;

/**
 * Word rows, in the order given, each a word's headword, its other form and first meaning, with
 * the learner's status (or Learn) at its right. Only these words' files load.
 */
export function KanjiWordRows({ ids, query = null }: { ids: readonly string[]; query?: ExploreQuery | null }) {
    const key = ids.join(',');
    const vocabs: Vocabulary[] = useAsyncData(key, () => VocabularyService.loadVocabs(ids), { keepPrevious: true }).data ?? [];
    const byId = new Map(vocabs.map(v => [v.id, v]));
    return (
        <div className="flex flex-col divide-y divide-divider -mx-3">
            {ids.flatMap(id => {
                const v = byId.get(id);
                if (!v) return [];
                const gloss = v.senses[0]?.glosses.join(', ') ?? '';
                return [(
                    <ListRow
                        key={v.id}
                        to={vocabPath(v.id)}
                        lookup={{ kind: 'word', vocabId: v.id }}
                        trailing={
                            <div className="flex items-center gap-3">
                                {v.jlptLevel && <span className="hidden sm:inline-flex"><JlptChip level={v.jlptLevel} /></span>}
                                <WordStudyStatus vocabId={v.id} />
                            </div>
                        }
                    >
                        <div className="flex items-baseline gap-2 min-w-0">
                            {/* A word learned in kana lists as ここ with 此処 beside it, as in the dictionary. */}
                            <span className="jp-headword shrink-0">{headwordOf(v)}</span>
                            <SecondaryForm vocab={v} />
                        </div>
                        <div className="type-support truncate"><Marked text={gloss} ranges={englishRanges(query, gloss)} /></div>
                    </ListRow>
                )];
            })}
        </div>
    );
}

interface KanjiWordsPanelProps {
    /** The words, in frequency order. */
    ids: readonly string[];
    /** The search field's hidden label: "Search the words with 学". */
    label: string;
    /** How many show at first and per "Show N more" (a full page's section shows fewer). */
    pageSize?: number;
}

/** Words using a kanji, searchable in English or Japanese, `pageSize` at a time. */
export function KanjiWordsPanel({ ids, label, pageSize = PAGE }: KanjiWordsPanelProps) {
    const { text, setText, query } = usePanelQuery();
    const [shown, setShown] = useState(pageSize);
    const { keep, searching } = useIndexSearch(query);
    const matched = useMemo(() => keep(ids), [keep, ids]);
    const more = matched.length - shown;
    return (
        <div>
            <PanelSearch
                text={text}
                onChange={value => { setText(value); setShown(pageSize); }}
                label={label}
                placeholder="Search in English or Japanese"
                countLine={searching ? 'Searching…' : resultCountLine(matched.length, ids.length, 'word', query)}
            />
            <KanjiWordRows ids={matched.slice(0, shown)} query={query} />
            {more > 0 && (
                <TextButton onClick={() => setShown(shown + pageSize)} className="mt-4">
                    Show {Math.min(pageSize, more).toLocaleString('en-US')} more
                </TextButton>
            )}
        </div>
    );
}
