import { TabNav } from "../../components/ui/TabNav";

const TABS = [
    { label: 'Your words', to: '/vocab' },
    { label: 'Mix-ups', to: '/vocab/mixups' },
];

/** The Vocabulary pages' tabs: the learner's words, and the words they mix up. */
export function VocabularyTabs() {
    return <TabNav label="Vocabulary" tabs={TABS} className="mb-8" />;
}
