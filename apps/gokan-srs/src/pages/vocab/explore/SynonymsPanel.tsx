import { useMemo, useState } from "react";
import { headwordOf, secondaryForm } from "@gokan/dataset-schema";
import type { Vocabulary } from "@gokan/dataset-schema";
import { RelatedEntryList, type RelatedSection } from "../../../components/RelatedEntriesCard";
import { SecondaryForm } from "../../../components/SecondaryForm";
import { TagChip } from "../../../components/TagChip";
import { Marked } from "../../../components/ui/Marked";
import { TextButton } from "../../../components/ui/TextButton";
import { CLOSENESS_LABEL, closenessOf } from "../../../services/exercise/wordRelation";
import type { Closeness, ListedSynonym } from "../../../services/exercise/wordRelation";
import { englishRanges, matchesExploreQuery, resultCountLine, type ExploreQuery } from "../../../utils/exploreSearch.utils";
import { mixedUpLabel } from "../../../utils/mixups.utils";
import { senseNumbers } from "../../../utils/senses.utils";
import { filterSynonymSections, GROUP_ROWS, sectionGlossLine, GROUPS_AT_ONCE, shownGroups, synonymCount, type SynonymSection } from "../../../utils/synonymSections.utils";
import { PanelSearch } from "./PanelSearch";
import { usePanelQuery } from "./usePanelQuery";
import { vocabPath } from "../../../utils/navigation.utils";

/** How close two words are, as a neutral chip told apart by its sign and its word, never a colour. */
function ClosenessChip({ closeness }: { closeness: Closeness }) {
    const { sign, label } = CLOSENESS_LABEL[closeness];
    return (
        <TagChip size="sm">
            <span aria-hidden="true" className="mr-1 font-sans">{sign}</span>
            {label}
        </TagChip>
    );
}

function matchesSynonym(query: ExploreQuery, synonym: ListedSynonym): boolean {
    return matchesExploreQuery(query, { english: synonym.shared, japanese: [headwordOf(synonym.forms), secondaryForm(synonym.forms), synonym.forms.reading.primary] });
}

/**
 * Every synonym of the word, grouped by the meaning it shares (synonymSections, as it is), each
 * row labelled by how close the two words are, as grading reads the pair (closenessOf). Three
 * rows a group and four groups at a time; a search keeps the grouping and every group that matches.
 */
export function SynonymsPanel({ vocab, sections, mixedUp }: { vocab: Vocabulary; sections: SynonymSection[]; mixedUp: ReadonlyMap<string, number> }) {
    const { text, setText, query } = usePanelQuery();
    const [groupsShown, setGroupsShown] = useState(GROUPS_AT_ONCE);
    const [openGroups, setOpenGroups] = useState<ReadonlySet<number>>(new Set());
    const numbers = useMemo(() => senseNumbers(vocab.senses), [vocab.senses]);
    const total = synonymCount(sections);

    const matched = useMemo(() => (query ? filterSynonymSections(sections, w => matchesSynonym(query, w)) : sections), [sections, query]);
    // A search shows every group that matches; browsing shows a few at a time.
    const { shown, hidden } = query ? { shown: matched, hidden: 0 } : shownGroups(matched, groupsShown, mixedUp);
    const headword = headwordOf(vocab);

    const groups: RelatedSection[] = shown.map(section => {
        const open = openGroups.has(section.sense);
        const rows = open ? section.words : section.words.slice(0, GROUP_ROWS);
        return {
            // The sense's number in Meanings, then its first glosses: "3 · to get, to obtain".
            label: `${numbers[section.sense]} · ${sectionGlossLine(section)}`,
            count: section.words.length,
            ...(section.words.length > GROUP_ROWS ? {
                footer: (
                    <TextButton onClick={() => setOpenGroups(toggled(openGroups, section.sense))}>
                        {open ? 'Show fewer for this meaning' : `Show all ${section.words.length.toLocaleString('en-US')} for this meaning`}
                    </TextButton>
                ),
            } : {}),
            entries: rows.map(synonym => {
                const times = mixedUp.get(synonym.vocabId);
                const shared = synonym.shared.join(', ');
                return {
                    key: synonym.vocabId,
                    to: vocabPath(synonym.vocabId),
                    lookup: { kind: 'word', vocabId: synonym.vocabId },
                    primary: headwordOf(synonym.forms),
                    // The reading is never broken: on a narrow row the chip wraps to the row's edge.
                    secondary: (
                        <>
                            <SecondaryForm vocab={synonym.forms} truncate={false} />
                            <ClosenessChip closeness={closenessOf(synonym.pair, section.glosses)} />
                        </>
                    ),
                    ...(times ? { trailing: <span className="type-meta tabular-nums">{mixedUpLabel(times)}</span> } : {}),
                    ...(shared ? { description: <Marked text={shared} ranges={englishRanges(query, shared)} /> } : {}),
                };
            }),
        };
    });

    return (
        <div>
            <p className="type-support mb-4">
                Never penalized on a <span lang="ja" className="font-mincho">{headword}</span> card; = and ≈ are accepted when they fit its meaning.
            </p>
            <PanelSearch
                text={text}
                onChange={value => { setText(value); setOpenGroups(new Set()); }}
                label="Search the synonyms"
                placeholder="Search in English or Japanese"
                countLine={resultCountLine(synonymCount(matched), total, 'synonym', query)}
            />
            <RelatedEntryList sections={groups} wrapDescription groupHeadings />
            {hidden > 0 && (
                <TextButton onClick={() => setGroupsShown(groupsShown + GROUPS_AT_ONCE)} className="mt-4">
                    Show {Math.min(GROUPS_AT_ONCE, hidden)} more meaning{Math.min(GROUPS_AT_ONCE, hidden) === 1 ? '' : 's'}
                </TextButton>
            )}
        </div>
    );
}

function toggled(set: ReadonlySet<number>, value: number): Set<number> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
}
