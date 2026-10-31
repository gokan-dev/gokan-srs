#!/usr/bin/env bun
// Folds a sprint's changelog fragments into one multi-feature entry at `release` -> `main`, so the
// whole release ships as a single version. During a sprint, each member PR drops one
// `release/changelog.d/<issue>-<slug>.md` fragment (a single learner-facing sentence) instead of
// editing changelog.ts, which keeps members from colliding on one file and from each minting their
// own version. This runs once, in the release's final PR (claude-start-release.yml's advance step).
//
// The single-issue flow does not use this: a lone PR edits release/changelog.ts directly, as before.
//
// Usage:
//   bun apps/gokan-srs/release/assemble-fragments.ts --version 1.45.0 --headline "Detail pages" [--date YYYY-MM-DD]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ChangelogChange, ChangelogEntry } from '../src/models/release.model';
import { changelogProblems, fragmentIssue, insertChangelogEntry } from '../src/utils/changelog.utils';
import { CHANGELOG } from './changelog';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function arg(flag: string): string | undefined {
    const i = process.argv.indexOf(flag);
    return i === -1 ? undefined : process.argv[i + 1];
}

function main(): void {
    const version = arg('--version');
    const headline = arg('--headline');
    const date = arg('--date') ?? new Date().toISOString().slice(0, 10);
    if (!version || !headline) {
        throw new Error('usage: assemble-fragments.ts --version X.Y.Z --headline "..." [--date YYYY-MM-DD]');
    }

    const dir = path.join(HERE, 'changelog.d');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
    if (files.length === 0) throw new Error(`no fragments in ${dir}: a shipping release must have at least one`);

    const changes: ChangelogChange[] = files
        .map((file): ChangelogChange => {
            const issue = fragmentIssue(file) ?? undefined;
            const summary = fs.readFileSync(path.join(dir, file), 'utf8').trim();
            return issue === undefined ? { summary } : { summary, issue };
        })
        .sort((a, b) => (a.issue ?? Infinity) - (b.issue ?? Infinity));

    const entry: ChangelogEntry = { version, date, summary: headline, changes };

    // Validate against the current list before touching the file, so a bad version or order fails
    // here rather than at the next build.
    const problems = changelogProblems([entry, ...CHANGELOG]);
    if (problems.length) throw new Error(`assembled changelog is invalid: ${problems.join('; ')}`);

    const changelogPath = path.join(HERE, 'changelog.ts');
    const source = fs.readFileSync(changelogPath, 'utf8');
    fs.writeFileSync(changelogPath, insertChangelogEntry(source, entry));

    for (const file of files) fs.rmSync(path.join(dir, file));
    process.stdout.write(`Assembled ${version} from ${files.length} fragment(s); removed them.\n`);
}

main();
