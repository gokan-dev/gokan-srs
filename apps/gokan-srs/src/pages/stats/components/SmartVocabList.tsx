import { useCallback, useMemo } from "react";
import type { Vocabulary } from "@gokan/dataset-schema";
import type { VocabProgress } from "../../../models/vocabulary.model";
import type { UserSettings } from "../../../models/user.model";
import { VocabularyService } from "../../../services/vocabulary.service";
import { VocabCard } from "../../../components/VocabCard";
import { SmartList } from "../../../components/SmartList";
import { commonSortOptions, type SortOption } from "../../../utils/smartList.utils";
import { romajiToHiragana, looksLikeRomaji } from "../../../utils/romaji";
import { isVocabFullyMastered } from "../../../services/scheduling";
import { countWrongReviews } from "../../../utils/winRate.utils";
import { useAsyncData } from "../../../hooks/useAsyncData";

interface SmartVocabListProps {
    progress: VocabProgress[];
    settings?: UserSettings;
    onVocabClick?: (vocabId: string) => void;
}

type VocabSortField = 'added_date' | 'next_review' | 'srs_stage' | 'failures' | 'kanji_rank' | 'reading_mastery' | 'meaning_mastery' | 'production_mastery';

const idOf = (p: VocabProgress) => p.vocabId;
const itemIdOf = (v: Vocabulary) => v.id;
const loadItems = (ids: string[]) => VocabularyService.loadVocabs(ids);

/** Matches the written form, the reading (romaji is converted to kana, so "nichi" finds にち) or a gloss. */
function matchesSearch(v: Vocabulary, query: string): boolean {
    const kanaQuery = looksLikeRomaji(query) ? romajiToHiragana(query) : null;
    return v.writtenForm.kanji.includes(query)
        || v.reading.primary.includes(query)
        || (kanaQuery !== null && kanaQuery !== query && v.reading.primary.includes(kanaQuery))
        || v.senses.some(s => s.glosses.some(g => g.toLowerCase().includes(query)));
}

export function SmartVocabList({ progress, settings, onVocabClick }: SmartVocabListProps) {
    // Sorting by frequency covers words whose own file has not loaded yet.
    const frequencyIndex = useAsyncData('frequency-index', () => VocabularyService.loadFrequencyIndex()).data;

    const sortOptions = useMemo((): SortOption<VocabSortField, VocabProgress, Vocabulary>[] => {
        const frequencyRank = new Map(frequencyIndex?.map((entry, i) => [entry.id, i]) ?? []);
        return [
            ...commonSortOptions<VocabProgress, Vocabulary>(countWrongReviews),
            { value: 'reading_mastery', label: 'Reading Advancement', sortKey: p => p.reading.memoryStrength },
            { value: 'meaning_mastery', label: 'Meaning Advancement', sortKey: p => p.meaning.memoryStrength },
            { value: 'production_mastery', label: 'Production Advancement', sortKey: p => p.production?.memoryStrength ?? 0 },
            { value: 'kanji_rank', label: 'Frequency', sortKey: p => frequencyRank.get(p.vocabId) ?? Number.MAX_SAFE_INTEGER },
        ];
    }, [frequencyIndex]);

    const isMastered = useCallback((p: VocabProgress) => isVocabFullyMastered(p, settings), [settings]);

    return (
        <SmartList
            storageKey="gokan_stats_vocablist_state"
            progress={progress}
            idOf={idOf}
            loadItems={loadItems}
            itemIdOf={itemIdOf}
            isMastered={isMastered}
            matchesSearch={matchesSearch}
            searchPlaceholder="Search reading, meaning..."
            sortOptions={sortOptions}
            defaultSort="added_date"
            noun="vocabulary"
            renderCard={(p, vocab) => (
                <VocabCard key={vocab.id} vocab={vocab} progress={p} onClick={() => onVocabClick?.(vocab.id)} />
            )}
        />
    );
}
