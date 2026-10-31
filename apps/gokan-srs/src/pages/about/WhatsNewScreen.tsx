import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";
import { CardSkeleton } from "../../components/CardSkeleton";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { ChangelogEntry } from "../../models/release.model";
import { APP_VERSION, loadChangelog } from "../../services/release.service";
import { changelogDate } from "../../utils/changelog.utils";
import { formatDate } from "../../utils/time.utils";

const ISSUES = 'https://github.com/gokan-dev/gokan-srs/issues';

/** A link to an issue or pull request, as the shipped-change line shows it. */
function IssueLink({ issue }: { issue: number }) {
    return (
        <>
            {' '}
            <a href={`${ISSUES}/${issue}`} target="_blank" rel="noopener noreferrer" className="font-sans text-sm text-accent hover:underline">
                #{issue}
            </a>
        </>
    );
}

/**
 * One shipped change: its version and day, then the sentence. A release that bundled several
 * features (a sprint) shows the headline, then each feature as its own line.
 */
function ChangelogItem({ entry }: { entry: ChangelogEntry }) {
    return (
        <li className="py-4 first:pt-0">
            <p className="type-meta">
                <span className={entry.version === APP_VERSION ? 'text-primary' : undefined}>{entry.version}</span>
                {' · '}{formatDate(changelogDate(entry.date))}
                {entry.version === APP_VERSION && ' · Your version'}
            </p>
            <p className="type-body mt-1">
                {entry.summary}
                {entry.issue !== undefined && <IssueLink issue={entry.issue} />}
            </p>
            {entry.changes !== undefined && (
                <ul className="mt-2 list-disc ps-5 space-y-1">
                    {entry.changes.map((change, i) => (
                        <li key={change.issue ?? `change-${i}`} className="type-body">
                            {change.summary}
                            {change.issue !== undefined && <IssueLink issue={change.issue} />}
                        </li>
                    ))}
                </ul>
            )}
        </li>
    );
}

/**
 * Every shipped change, newest first, from the live deploy's `/changelog.json`: a tab still on
 * an older version sees what it is missing.
 */
export function WhatsNewScreen() {
    const changelog = useAsyncData('changelog', loadChangelog);

    return (
        <Page width="narrow">
            <PageHeader title="What's new" subtitle={`You are on version ${APP_VERSION}.`} parentPath="/about" className="mb-8" />
            {changelog.status === 'error' && <p className="type-body">The list of changes could not be loaded. Check your connection, then reload the page.</p>}
            {(changelog.status === 'loading' || changelog.status === 'idle') && <CardSkeleton />}
            {changelog.status === 'ready' && (
                <ol className="w-full divide-y divide-divider" data-changelog>
                    {changelog.data.map(entry => <ChangelogItem key={entry.version} entry={entry} />)}
                </ol>
            )}
        </Page>
    );
}
