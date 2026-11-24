import { useMemo } from "react";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { JlptChip } from "../../components/JlptChip";
import { SecondaryForm } from "../../components/SecondaryForm";
import { WordStudyStatus } from "../../components/WordStudyStatus";
import { ListRow } from "../../components/ui/ListRow";
import { Marked } from "../../components/ui/Marked";
import { useAsyncData } from "../../hooks/useAsyncData";
import { VocabularyService } from "../../services/vocabulary.service";
import { englishRanges, resultCountLine, type ExploreQuery } from "../../utils/exploreSearch.utils";
import { vocabPath } from "../../utils/navigation.utils";
import { PanelSearch } from "../../components/search/PanelSearch";
import { useIndexSearch } from "../../components/search/useIndexSearch";
import { ShowMore } from "../../components/search/ShowMore";
import { usePagedPanel } from "../../components/search/usePagedPanel";

/** A kanji's Words tab, 20 at a time (一 has 660 words). */
const PAGE = 20;

/**
 * Word rows, in the order given, each a word's headword, its other form and first meaning, with
 * the learner's status (or Learn) at its right. Only these words' files load. `compact` (a column
 * about 300px wide, the full page's side) leaves out the JLPT chip: `sm:` keys on the viewport,
 * not the column, so it would crowd the gloss there.
 */
export function KanjiWordRows({ ids, query = null, compact = false }: { ids: readonly string[]; query?: ExploreQuery | null; compact?: boolean }) {
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
                                {v.jlptLevel && !compact && <span className="hidden sm:inline-flex"><JlptChip level={v.jlptLevel} /></span>}
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
    /** In the full page's side column: no JLPT chip, so the gloss keeps its width. */
    compact?: boolean;
}

/** Words using a kanji, searchable in English or Japanese, `pageSize` at a time. */
export function KanjiWordsPanel({ ids, label, pageSize = PAGE, compact = false }: KanjiWordsPanelProps) {
    const panel = usePagedPanel(pageSize);
    const { keep, notice } = useIndexSearch(panel.query);
    const matched = useMemo(() => keep(ids), [keep, ids]);
    return (
        <div>
            {panel.searchable(ids.length) && <PanelSearch
                text={panel.text}
                onChange={panel.setText}
                label={label}
                placeholder="Search in English or Japanese"
                countLine={notice ?? resultCountLine(matched.length, ids.length, 'word', panel.query)}
            />}
            <KanjiWordRows ids={matched.slice(0, panel.shown())} query={panel.query} compact={compact} />
            <ShowMore panel={panel} total={matched.length} className="mt-4" />
        </div>
    );
}
