// Which changed files can change what a deploy ships. deploy-site.yml builds both apps from
// apps/, packages/ and the lockfile, so a change outside them (CI, docs, the repo's check
// scripts, agent rules) leaves every deployed page as it was. A review round whose changes ship
// nothing skips the staging deploy and the rendered review (claude-review.yml): the pages are the
// ones already reviewed.
//
// Unknown paths under a shipped root count as shipped: a needless staging round costs minutes,
// a skipped one lets a rendered bug through unreviewed.

const SHIPPED = [
    /^apps\/gokan-(srs|dictionary)\//,
    /^packages\//,
    /^(package\.json|bun\.lock|\.gitmodules)$/,
    // A tag push runs deploy-staging.yml (and the deploy-site.yml it calls) from the tagged commit.
    /^\.github\/workflows\/deploy-(site|staging)\.yml$/,
];

const NOT_SHIPPED = [
    /\.md$/,
    /\.test\.tsx?$/,
    /\/src\/test\//,
    // Infrastructure has its own workflows (terraform-*.yml); a site deploy does not apply it.
    /^apps\/gokan-srs\/(terraform|docs)\//,
    /^apps\/gokan-srs\/github-actions-trust-policy\.json$/,
];

export function shipsInDeployment(path: string): boolean {
    return SHIPPED.some(re => re.test(path)) && !NOT_SHIPPED.some(re => re.test(path));
}

export function anyShipsInDeployment(paths: readonly string[]): boolean {
    return paths.some(shipsInDeployment);
}
