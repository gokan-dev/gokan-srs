import type { ChangelogEntry } from '../src/models/release.model';

/**
 * Every shipped change, newest first: the What's new page, and the app's version (the newest
 * entry's). A change that ships adds one entry at the top, in the same pull request: the next
 * minor after the entry below it, which is the version the agent pipeline's rc tags give that
 * pull request (`v1.43.0-rc.1` ships as `1.43.0`), dated the day it merges, in one plain
 * sentence a learner can read. A change that ships nothing (docs, CI, tests) adds none.
 *
 * Committed rather than generated from tags at deploy: the production build is a shallow
 * checkout of `main` with no tags, so the version must be in the tree it builds. vite.config.ts
 * bakes the version in and writes this list to `/changelog.json`; the build fails on a list
 * that is not newest first (`changelogProblems`).
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
    {
        version: '1.44.0',
        date: '2026-10-29',
        summary: 'Groundwork for listening: words and sentences will be read aloud in a coming version, and the About page will credit the voice.',
        issue: 164,
    },
    {
        version: '1.43.0',
        date: '2026-10-28',
        summary: 'The app now shows its version, has this What\'s new page, and offers a reload when a newer version is live.',
        issue: 171,
    },
    {
        version: '1.42.0',
        date: '2026-10-28',
        summary: 'A word\'s page shows its closest synonyms and the words you mixed it up with; the separate Mix-ups page is gone.',
        issue: 162,
    },
    {
        version: '1.41.0',
        date: '2026-10-21',
        summary: 'Progress is stored in IndexedDB, which holds far more than the browser storage it used before.',
        issue: 153,
    },
    {
        version: '1.40.0',
        date: '2026-10-20',
        summary: 'Setup asks for your kanji count and vocabulary order first, with the kanji grid folded away below.',
        issue: 158,
    },
    {
        version: '1.39.0',
        date: '2026-10-20',
        summary: 'The kanji coverage order favours useful words over long compounds.',
        issue: 156,
    },
    {
        version: '1.38.0',
        date: '2026-10-20',
        summary: 'A review history takes less storage, so long-time learners stay within the browser\'s limit.',
        issue: 154,
    },
    {
        version: '1.37.0',
        date: '2026-10-19',
        summary: 'Near-synonyms are graded the same way everywhere, and the words you mix up are recorded.',
        issue: 150,
    },
    {
        version: '1.36.0',
        date: '2026-10-18',
        summary: 'The dictionary lists, for each kanji learning order, the words each step unlocks.',
        issue: 147,
    },
    {
        version: '1.35.0',
        date: '2026-10-18',
        summary: 'The welcome page says what Gokan is for, and About credits the data sources.',
        issue: 148,
    },
    {
        version: '1.34.0',
        date: '2026-10-18',
        summary: 'Furigana sits over the kanji only, and neighbouring readings no longer run together.',
        issue: 137,
    },
];
