import { useMemo, useState } from "react";
import { headwordOf, searchHeadword, searchSecondaryForm } from "@gokan/dataset-schema";
import type { SearchIndexEntry, Vocabulary } from "@gokan/dataset-schema";
import { RelatedEntryList, type RelatedEntry, type RelatedSection } from "../../../components/RelatedEntriesCard";
import { SecondaryForm } from "../../../components/SecondaryForm";
import { Marked } from "../../../components/ui/Marked";
import { TextButton } from "../../../components/ui/TextButton";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { englishRanges, matchesExploreQuery, resultCountLine, type ExploreQuery } from "../../../utils/exploreSearch.utils";
import { PanelSearch } from "./PanelSearch";
import { usePanelQuery } from "./usePanelQuery";
import { relatedCount } from "./counts";

const PAGE = 10;

function matchesEntry(query: ExploreQuery, entry: SearchIndexEntry | undefined): boolean {
    return entry !== undefined && matchesExploreQuery(query, { english: [entry.m], japanese: [entry.w, entry.r, searchHeadword(entry), searchSecondaryForm(entry)] });
}

function toEntry(v: Vocabulary, query: ExploreQuery | null): RelatedEntry {
    const gloss = v.senses[0]?.glosses.join(", ") ?? '';
    return {
        key: v.id,
        to: `/vocab/${v.id}`,
        primary: headwordOf(v),
        // A word shown in kana names its kanji spelling where the reading would go.
        secondary: <SecondaryForm vocab={v} />,
        ...(gloss ? { description: <Marked text={gloss} ranges={englishRanges(query, gloss)} /> } : {}),
    };
}

/**
 * The words this one is built from and those it is used in, 10 at a time a group. A word can
 * be in hundreds (639 at most), so a row's file loads only when shown, and a search reads the
 * search index (one file, shared with the header's search), not every word.
 */
export function RelatedPanel({ vocab }: { vocab: Vocabulary }) {
    const { text, setText, query } = usePanelQuery();
    const [limits, setLimits] = useState({ built: PAGE, used: PAGE });

    const index = useAsyncData(query ? 'search-index' : null, () => VocabularyService.loadSearchIndex(), { keepPrevious: true }).data;
    const byId = useMemo(() => new Map((index ?? []).map(e => [e.id, e])), [index]);

    const groups = useMemo(() => {
        // Searching before the index arrives keeps the rows as they were rather than showing none.
        const keep = (ids: readonly string[]) => (query && index ? ids.filter(id => matchesEntry(query, byId.get(id))) : [...ids]);
        return [
            { key: 'built' as const, label: 'Built from', ids: keep(vocab.components ?? []) },
            { key: 'used' as const, label: 'Used in', ids: keep(vocab.parents ?? []) },
        ];
    }, [vocab, query, index, byId]);
    const searching = query !== null && index === undefined;

    const displayed = groups.map(g => g.ids.slice(0, limits[g.key]));
    const ids = displayed.flat();
    const loaded = useAsyncData(ids.join(','), () => VocabularyService.loadVocabs(ids), { keepPrevious: true }).data ?? [];
    const loadedById = new Map(loaded.map(v => [v.id, v]));

    const sections: RelatedSection[] = groups.flatMap((group, i) => {
        if (group.ids.length === 0) return [];
        const more = group.ids.length - limits[group.key];
        return [{
            label: group.label,
            count: group.ids.length,
            entries: displayed[i].flatMap(id => {
                const v = loadedById.get(id);
                return v ? [toEntry(v, query)] : [];
            }),
            ...(more > 0 ? {
                footer: (
                    <TextButton onClick={() => setLimits({ ...limits, [group.key]: limits[group.key] + PAGE })}>
                        Show {Math.min(PAGE, more)} more
                    </TextButton>
                ),
            } : {}),
        }];
    });

    const matched = groups.reduce((n, g) => n + g.ids.length, 0);
    return (
        <div>
            <PanelSearch
                text={text}
                onChange={value => { setText(value); setLimits({ built: PAGE, used: PAGE }); }}
                label="Search the related words"
                placeholder="Search in English or Japanese"
                countLine={searching ? 'Searching…' : resultCountLine(matched, relatedCount(vocab), 'related word', query)}
            />
            <RelatedEntryList sections={sections} />
        </div>
    );
}
