import type { GrammarBrowseIndex } from "@gokan/dataset-schema";
import { PageHeader } from "../../components/PageHeader";
import { TabNav } from "../../components/ui/TabNav";

const TABS = [
    { label: 'Curriculum', to: '/grammar/chapters' },
    { label: 'All points', to: '/grammar/browse' },
];

/** The Grammar home's shared header: the title, the curriculum's size, and its two tabs. */
export function GrammarHomeHeader({ stats }: { stats: GrammarBrowseIndex['stats'] | null }) {
    return (
        <>
            <PageHeader
                title="Grammar"
                subtitle={stats ? `${stats.introduced.toLocaleString('en-US')} points in ${stats.chapters} chapters` : undefined}
                className="mb-4"
            />
            <TabNav label="Grammar" tabs={TABS} className="mb-8" />
        </>
    );
}
