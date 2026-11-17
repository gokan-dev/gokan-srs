import { useMemo, useState } from "react";
import { headwordOf } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { RelatedEntryList, type RelatedEntry, type RelatedSection } from "../../../components/RelatedEntriesCard";
import { SecondaryForm } from "../../../components/SecondaryForm";
import { Marked } from "../../../components/ui/Marked";
import { TextButton } from "../../../components/ui/TextButton";
import { useAsyncData } from "../../../hooks/useAsyncData";
import { VocabularyService } from "../../../services/vocabulary.service";
import { englishRanges, resultCountLine, type ExploreQuery } from "../../../utils/exploreSearch.utils";
import { PanelSearch } from "./PanelSearch";
import { useIndexSearch } from "./useIndexSearch";
import { usePanelQuery } from "./usePanelQuery";
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
    const { text, setText, query } = usePanelQuery();
    const [limits, setLimits] = useState({ built: pageSize, used: pageSize });

    const { keep, searching } = useIndexSearch(query);
    const groups = useMemo(() => [
        { key: 'built' as const, label: 'Built from', ids: keep(vocab.components ?? []) },
        { key: 'used' as const, label: 'Used in', ids: keep(vocab.parents ?? []) },
    ], [vocab, keep]);

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
                    <TextButton onClick={() => setLimits({ ...limits, [group.key]: limits[group.key] + pageSize })}>
                        Show {Math.min(pageSize, more)} more
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
                onChange={value => { setText(value); setLimits({ built: pageSize, used: pageSize }); }}
                label="Search the related words"
                placeholder="Search in English or Japanese"
                countLine={searching ? 'Searching…' : resultCountLine(matched, relatedCount(vocab), 'related word', query)}
            />
            <RelatedEntryList sections={sections} />
        </div>
    );
}
