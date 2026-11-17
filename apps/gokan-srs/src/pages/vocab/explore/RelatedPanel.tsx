import { useMemo } from "react";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { RelatedEntryList, type RelatedEntry, type RelatedSection } from "../../../components/RelatedEntriesCard";
import { SecondaryForm } from "../../../components/SecondaryForm";
import { Marked } from "../../../components/ui/Marked";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { englishRanges, resultCountLine, type ExploreQuery } from "../../../utils/exploreSearch.utils";
import { PanelSearch } from "../../../components/search/PanelSearch";
import { useIndexSearch } from "../../../components/search/useIndexSearch";
import { ShowMore } from "../../../components/search/ShowMore";
import { usePagedPanel } from "../../../components/search/usePagedPanel";
import { relatedCount } from "./counts";
import { vocabPath } from "../../../utils/navigation.utils";

const PAGE = 10;

function toEntry(v: Vocabulary, query: ExploreQuery | null): RelatedEntry {
    const gloss = v.senses[0]?.glosses.join(", ") ?? '';
    return {
        key: v.id,
        to: vocabPath(v.id),
        lookup: { kind: 'word', vocabId: v.id },
        primary: headwordOf(v),
        // A word shown in kana names its kanji spelling where the reading would go.
        secondary: <SecondaryForm vocab={v} />,
        ...(gloss ? { description: <Marked text={gloss} ranges={englishRanges(query, gloss)} /> } : {}),
    };
}

/**
 * The words this one is built from and those it is used in, 10 at a time a group (`pageSize`,
 * fewer as a full page's section). A word can
 * be in hundreds (639 at most), so a row's file loads only when shown, and a search reads the
 * search index (`useIndexSearch`), not every word.
 */
export function RelatedPanel({ vocab, pageSize = PAGE }: { vocab: Vocabulary; pageSize?: number }) {
    const panel = usePagedPanel(pageSize);
    const { query } = panel;

    const { keep, searching } = useIndexSearch(query);
    const groups = useMemo(() => [
        { key: 'built' as const, label: 'Built from', ids: keep(vocab.components ?? []) },
        { key: 'used' as const, label: 'Used in', ids: keep(vocab.parents ?? []) },
    ], [vocab, keep]);

    const displayed = groups.map(g => g.ids.slice(0, panel.shown(g.key)));
    const ids = displayed.flat();
    const loaded = useAsyncData(ids.join(','), () => VocabularyService.loadVocabs(ids), { keepPrevious: true }).data ?? [];
    const loadedById = new Map(loaded.map(v => [v.id, v]));

    const sections: RelatedSection[] = groups.flatMap((group, i) => {
        if (group.ids.length === 0) return [];
        return [{
            label: group.label,
            count: group.ids.length,
            entries: displayed[i].flatMap(id => {
                const v = loadedById.get(id);
                return v ? [toEntry(v, query)] : [];
            }),
            ...(panel.more(group.ids.length, group.key) > 0 ? { footer: <ShowMore panel={panel} total={group.ids.length} group={group.key} /> } : {}),
        }];
    });

    const matched = groups.reduce((n, g) => n + g.ids.length, 0);
    return (
        <div>
            {/* Each group is paged on its own: the search is there when either runs past a page. */}
            {panel.searchable(Math.max(vocab.components?.length ?? 0, vocab.parents?.length ?? 0)) && <PanelSearch
                text={panel.text}
                onChange={panel.setText}
                label="Search the related words"
                placeholder="Search in English or Japanese"
                countLine={searching ? 'Searching…' : resultCountLine(matched, relatedCount(vocab), 'related word', query)}
            />}
            <RelatedEntryList sections={sections} />
        </div>
    );
}
