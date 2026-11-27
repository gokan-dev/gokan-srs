import { useMemo, useState } from "react";
import { headwordOf, secondaryForm } from "@gokan/dataset-schema";
import type { Closeness, Vocabulary } from "@gokan/dataset-schema";
import { MixedText } from "../../../components/MixedText";
import { RelatedEntryList, type RelatedSection } from "../../../components/RelatedEntriesCard";
import { SecondaryForm } from "../../../components/SecondaryForm";
import { TagChip } from "../../../components/TagChip";
import { Marked } from "../../../components/ui/Marked";
import { TextButton } from "../../../components/ui/TextButton";
import { CLOSENESS_LABEL, closenessOf } from "../../../services/exercise/wordRelation";
import type { ListedSynonym } from "../../../services/exercise/wordRelation";
import { englishRanges, matchesExploreQuery, resultCountLine, type ExploreQuery } from "../../../utils/exploreSearch.utils";
import { mixedUpLabel } from "../../../utils/mixups.utils";
import { senseNumbers } from "../../../utils/senses.utils";
import { filterSynonymSections, GROUP_ROWS, sectionGlossLine, GROUPS_AT_ONCE, shownGroups, synonymCount, synonymsSearchable, type SynonymSection } from "../../../utils/synonymSections.utils";
import { PanelSearch } from "../../../components/search/PanelSearch";
import { usePanelQuery } from "../../../components/search/usePanelQuery";
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

/** A row matches on its words and shared glosses, and on its nuance line, English or Japanese (帽子 finds 帽子を取る). */
function matchesSynonym(query: ExploreQuery, synonym: ListedSynonym): boolean {
    const nuance = synonym.nuance ? [synonym.nuance] : [];
    return matchesExploreQuery(query, {
        english: [...synonym.shared, ...nuance],
        japanese: [headwordOf(synonym.forms), secondaryForm(synonym.forms), synonym.forms.reading.primary, ...nuance],
    });
}

/** A nuance line's text: each Japanese run in a Japanese face, on one line. */
const nuanceText = (text: string) => <MixedText text={text} unbroken />;

/**
 * A row's description: what the two words share, as metadata, then how they differ when the dataset
 * says (its nuance line), in the primary text colour as the row's content, its Japanese in a
 * Japanese face whether or not a search marks it.
 */
function SynonymDescription({ shared, nuance, query }: { shared: string; nuance: string | undefined; query: ExploreQuery | null }) {
    return (
        <>
            {shared && <Marked text={shared} ranges={englishRanges(query, shared)} />}
            {nuance && (
                <span className={`block text-primary ${shared ? 'mt-1' : ''}`}>
                    <Marked text={nuance} ranges={englishRanges(query, nuance)} render={nuanceText} />
                </span>
            )}
        </>
    );
}

/**
 * Every synonym of the word, grouped by the meaning it shares (synonymSections, as it is), each
 * row labelled by how close the two words are, as grading reads the pair (closenessOf). Three
 * rows a group and four groups at a time (`groupsAtOnce`, fewer as a full page's section); a search
 * keeps the grouping and every group that matches.
 */
export function SynonymsPanel({ vocab, sections, mixedUp, groupsAtOnce = GROUPS_AT_ONCE }: {
    vocab: Vocabulary;
    sections: SynonymSection[];
    mixedUp: ReadonlyMap<string, number>;
    groupsAtOnce?: number;
}) {
    const { text, setText, query } = usePanelQuery();
    const [groupsShown, setGroupsShown] = useState(groupsAtOnce);
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
                    ...(shared || synonym.nuance ? { description: <SynonymDescription shared={shared} nuance={synonym.nuance} query={query} /> } : {}),
                };
            }),
        };
    });

    return (
        <div>
            <p className="type-support mb-4">
                Never penalized on a <span lang="ja" className="font-mincho">{headword}</span> card: = and ≈ are accepted when they fit its meaning.
            </p>
            {/* Only past one page, as every panel's search and the dictionary's Synonyms (synonymsSearchable). */}
            {synonymsSearchable(sections, groupsAtOnce) && (
                <PanelSearch
                    text={text}
                    onChange={value => { setText(value); setOpenGroups(new Set()); }}
                    label="Search the synonyms"
                    placeholder="Search in English or Japanese"
                    countLine={resultCountLine(synonymCount(matched), total, 'synonym', query)}
                />
            )}
            <RelatedEntryList sections={groups} wrapDescription groupHeadings />
            {hidden > 0 && (
                <TextButton onClick={() => setGroupsShown(groupsShown + groupsAtOnce)} className="mt-4">
                    Show {Math.min(groupsAtOnce, hidden)} more meaning{Math.min(groupsAtOnce, hidden) === 1 ? '' : 's'}
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
