import { Page } from "../../components/Page";
import { PageHeader } from "../../components/PageHeader";
import { CardSkeleton } from "../../components/CardSkeleton";
import { useAsyncData } from "../../hooks/useAsyncData";
import type { ChangelogEntry } from "../../models/release.model";
import { APP_VERSION, loadChangelog } from "../../services/release.service";
import { changelogDate } from "../../utils/changelog.utils";
import { formatDate } from "../../utils/time.utils";

const ISSUES = 'https://github.com/gokan-dev/gokan-srs/issues';

/** One shipped change: its version and day, then the sentence. */
export function ChangelogItem({ entry }: { entry: ChangelogEntry }) {
    return (
        <li className="py-4 first:pt-0">
            <p className="type-meta">
                <span className={entry.version === APP_VERSION ? 'text-primary' : undefined}>v{entry.version}</span>
                {' · '}{formatDate(changelogDate(entry.date))}
                {entry.version === APP_VERSION && ' · Your version'}
            </p>
            <p className="type-body mt-1">
                {entry.summary}
                {entry.issue !== undefined && (
                    <>
                        {' '}
                        <a href={`${ISSUES}/${entry.issue}`} target="_blank" rel="noopener noreferrer" className="font-sans text-sm text-accent hover:underline">
                            #{entry.issue}
                        </a>
                    </>
                )}
            </p>
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
            {changelog.status === 'error' && <p className="type-body">The list of changes could not be loaded. Check your connection and try again.</p>}
            {(changelog.status === 'loading' || changelog.status === 'idle') && <CardSkeleton />}
            {changelog.status === 'ready' && (
                <ol className="w-full divide-y divide-divider" data-changelog>
                    {changelog.data.map(entry => <ChangelogItem key={entry.version} entry={entry} />)}
                </ol>
            )}
        </Page>
    );
}
