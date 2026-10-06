import type { GrammarPoint } from "@gokan/dataset-schema";
import type { GrammarProgress } from "../../../models/grammar.model";
import { GrammarService } from "../../../services/grammar.service";
import { GrammarCard } from "../../../components/GrammarCard";
import { SmartList } from "../../../components/SmartList";
import { commonSortOptions, type SortOption } from "../../../utils/smartList.utils";
import { isGrammarFullyMastered } from "../../../services/grammarScheduling";

interface SmartGrammarListProps {
    progress: GrammarProgress[];
    onGrammarClick?: (grammarId: string) => void;
}

type GrammarSortField = 'added_date' | 'next_review' | 'srs_stage' | 'failures' | 'jlpt_level' | 'mastery';

const idOf = (g: GrammarProgress) => g.grammarId;
const itemIdOf = (p: GrammarPoint) => p.id;
const loadItems = (ids: string[]) => GrammarService.loadGrammarPoints(ids);
const isMastered = (g: GrammarProgress) => isGrammarFullyMastered(g);

function matchesSearch(point: GrammarPoint, query: string): boolean {
    return point.title.toLowerCase().includes(query)
        || point.shortExplanation.toLowerCase().includes(query)
        || point.longExplanation.toLowerCase().includes(query);
}

// Grammar has one SRS entry per point and no frequency data, so JLPT level stands in for that sort.
const SORT_OPTIONS: SortOption<GrammarSortField, GrammarProgress, GrammarPoint>[] = [
    ...commonSortOptions<GrammarProgress, GrammarPoint>(g => g.entry.history.filter(h => h.result === 'wrong').length),
    { value: 'mastery', label: 'Mastery', sortKey: g => g.entry.memoryStrength },
    { value: 'jlpt_level', label: 'JLPT Level', sortKey: (_g, point) => point?.jlptLevel ?? 99 },
];

/** Grammar's equivalent of SmartVocabList, through the same SmartList. */
export function SmartGrammarList({ progress, onGrammarClick }: SmartGrammarListProps) {
    return (
        <SmartList
            storageKey="gokan_stats_grammarlist_state"
            progress={progress}
            idOf={idOf}
            loadItems={loadItems}
            itemIdOf={itemIdOf}
            isMastered={isMastered}
            matchesSearch={matchesSearch}
            searchPlaceholder="Search title, explanation..."
            sortOptions={SORT_OPTIONS}
            defaultSort="added_date"
            noun="grammar points"
            renderCard={(g, point) => (
                <GrammarCard key={point.id} point={point} progress={g} onClick={() => onGrammarClick?.(point.id)} />
            )}
        />
    );
}
