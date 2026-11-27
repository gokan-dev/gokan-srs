import type { ChangelogEntry } from '../src/models/release.model';

/**
 * Every shipped change, newest first: the What's new page, and the app's version (the newest
 * entry's). A change that ships adds one entry at the top, in the same pull request: the next
 * minor after the entry below it, which is the version the agent pipeline's rc tags give that
 * pull request (`v1.43.0-rc.1` ships as `1.43.0`), dated the day it merges, in one plain
 * sentence a learner can read. A change that ships nothing (docs, CI, tests) adds none, nor does one
 * that ships code but nothing a learner sees (a refactor, tooling a build imports, a change the
 * gate proves leaves the output identical, such as `check:parity --expect identical` or an
 * equality test): its PR says so (AGENTS.md, Workflow).
 *
 * Committed rather than generated from tags at deploy: the production build is a shallow
 * checkout of `main` with no tags, so the version must be in the tree it builds. vite.config.ts
 * bakes the version in and writes this list to `/changelog.json`; the build fails on a list
 * that is not newest first (`changelogProblems`).
 */
export const CHANGELOG: readonly ChangelogEntry[] = [
    {
        version: '1.74.0',
        date: '2026-11-27',
        summary: 'A few sentences across the app and the dictionary are reworded to read more naturally, such as the line saying what tells apart words read the same.',
    },
    {
        version: '1.72.0',
        date: '2026-11-25',
        summary: 'The dictionary now writes every word\'s reading in romaji, beside its kana and under each of its forms, shows a word\'s forms under its examples and for every adjective (静かでした, 高く), finds a な-adjective from a form of it, and links a word read like others to a page setting them side by side (hashi: 橋, 端, 箸).',
        issue: 278,
    },
    {
        version: '1.69.0',
        date: '2026-11-22',
        summary: 'Search for kanji and grammar, listening and contrast exercises',
        changes: [
            { summary: 'A new listening quiz, off by default: turn on Listening quizzes in Settings and some reading reviews play an example sentence aloud, with the word you are reviewing left blank for you to type what you heard.', issue: 165 },
            { summary: 'Contrast drills: a short quiz that tells similar grammar points apart, started from a family, one of its lessons, a grammar point or a chapter, open on any point and never counted in your reviews.', issue: 249 },
            { summary: 'The search bar, in the app and the dictionary, now finds kanji and grammar points as well as words: type a kanji, its English meaning or its reading in kana or romaji (water, みず, sui for 水), or a grammar pattern (てから, te kara). In both, every match is in one list, the best first and in the same order, each marked Word, Kanji or Grammar, and a conjugated form (食べた) finds its word in the app too.', issue: 264 },
        ],
    },
    {
        version: '1.68.0',
        date: '2026-11-19',
        summary: 'Pitch accent',
        changes: [
            { summary: 'A word now shows its pitch accent over its reading, on its page, on the card that opens when you tap the word and in the dictionary: where the pitch is high or low, and whether a particle after it stays high. You can turn it off in Settings.', issue: 176 },
        ],
    },
    {
        version: '1.67.0',
        date: '2026-11-18',
        summary: 'Detail pages, tabs on phones and one page on desktop',
        changes: [
            { summary: 'In the dictionary, a word\'s page now lists its synonyms, grouped by meaning as in the app, and follows the app\'s sections: tabs on a phone, one full page on a wide screen.', issue: 168 },
            { summary: 'Kanji and grammar pages now work like word pages: on a phone their content is in tabs, with every word using a kanji and every example of a grammar point searchable, and on a wide screen each is one page with its key facts in the header.', issue: 169 },
            { summary: 'In the dictionary, a word and its example sentences, and a grammar point\'s examples, now have a play button to hear them read aloud, as in the app.', issue: 255 },
            { summary: 'On a wide screen, a word\'s page is now one page instead of tabs: its sentences, synonyms, kanji and related words follow its meanings, each as a short section you can open further, while phones and tablets keep the tabs.', issue: 256 },
            { summary: 'In the dictionary, a kanji\'s page and a grammar point\'s page now follow the app\'s sections too: tabs on a phone, one full page on a wide screen.', issue: 257 },
        ],
    },
    {
        version: '1.66.0',
        date: '2026-11-17',
        summary: 'Start studying from the dictionary',
        changes: [
            { summary: 'A link from the dictionary to Gokan now opens setup on the kanji book and the number of kanji you were reading, ready to confirm.', issue: 243 },
            { summary: 'Every dictionary page now says in one line what Gokan would do with what you are reading, such as the kanji step at which a word becomes readable, and its link opens setup at that step.', issue: 244 },
            { summary: 'The dictionary home page now leads with the kanji learning orders, and a kanji page now says that each course step leads to the words you can read at that step.', issue: 245 },
        ],
    },
    {
        version: '1.65.0',
        date: '2026-11-13',
        summary: 'じゃ and では both count in a grammar sentence',
        changes: [
            { summary: 'When a grammar sentence asks for a form, every spelling its drill accepts now counts: すきじゃなかった is right where the sentence writes 好きではなかった.' },
        ],
    },
    {
        version: '1.64.0',
        date: '2026-11-12',
        summary: 'Long words fit on their card',
        changes: [
            { summary: 'A long word on a new word\'s card (乗り換える) is now drawn on one line, scaled to fit the card, where its last kana used to stack one per line.', issue: 239 },
        ],
    },
    {
        version: '1.63.0',
        date: '2026-11-11',
        summary: 'Grammar exercises that ask how a form connects and which form fits',
        changes: [
            { summary: 'Where a grammar point needs a particular form of the word before it, the card now gives that word in its dictionary form and asks for the whole connection (してから, not から after a given して).', issue: 237 },
            { summary: 'Conjugation points (the て-form, the polite past, くない and the others) are asked inside a real sentence after their first two reviews, with the dictionary form given, in place of the bare drill. Three forms with no reliable sentences yet keep the drill.', issue: 236 },
            { summary: 'A new choice exercise: on some reviews, a sentence is shown in Japanese only and you pick the form that fits among forms you have already learned. Once answered, each wrong option says what it attaches to. It appears where the sentence rules out at least two forms you know, about 80 grammar points for now.', issue: 238 },
        ],
    },
    {
        version: '1.62.0',
        date: '2026-11-11',
        summary: 'Chinese dictionary',
        changes: [
            { summary: 'The dictionary has a Simplified Chinese section: about 11,000 words with their meanings from Chinese sources, and their example sentences with a Mandarin translation where one exists. Kanji and grammar pages stay in English for now.', issue: 226 },
            { summary: 'The Chinese section is written in Chinese throughout, with its own home page and JLPT word lists, and a link at the top of a page switches between its English and Chinese versions.', issue: 227 },
            { summary: 'Search in the Chinese section finds a word by its kanji, kana, romaji or Chinese meaning.', issue: 228 },
        ],
    },
    {
        version: '1.52.0',
        date: '2026-11-06',
        summary: 'Japanese inside grammar lessons, usage notes and word meanings now always shows in a Japanese font, even on a device with none installed.',
        issue: 200,
    },
    {
        version: '1.51.0',
        date: '2026-11-06',
        summary: 'Most grammar points show a refreshed set of corpus examples, now chosen the same way on every update of the data.',
        issue: 198,
    },
    {
        version: '1.50.0',
        date: '2026-11-04',
        summary: "A new word's intro card now plays the word and its example sentence, and each of its kanji opens a card that links to the kanji's page.",
        issue: 196,
    },
    {
        version: '1.49.0',
        date: '2026-11-03',
        summary: "A new word's intro card now shows it in one example sentence, the easiest for you to read, with furigana and its English.",
        issue: 184,
    },
    {
        version: '1.48.0',
        date: '2026-11-02',
        summary: 'Japanese answers can now be typed in romaji, turned into kana as you type (taberu becomes たべる), with no Japanese keyboard needed, and a katakana word answered in hiragana now counts as right.',
        issue: 186,
    },
    {
        version: '1.47.0',
        date: '2026-11-01',
        summary: 'Review pacing is now a slider, from ×0.5 to ×4 on every interval. Under it, a forecast from your own progress shows how many reviews a day each setting would bring.',
        issue: 185,
    },
    {
        version: '1.46.0',
        date: '2026-11-01',
        summary: 'Detail pages (layout, cards, play buttons)',
        changes: [
            { summary: 'A word\'s page now opens on its meaning and status, with one row of tabs below (Dict, Sentences, Synonyms, Kanji, Related, Study).', issue: 172 },
            { summary: 'Words and kanji can now be looked up where they appear: point at or focus one in a sentence, a word\'s headword, a kanji tile or a word list (or tap a word in a sentence on a phone) to see its reading, meanings and your progress, and learn the word from there.', issue: 174 },
            { summary: 'Words and example sentences can now be heard: a play button after a word\'s reading, on its page and its word card, and at the end of each example sentence on word and grammar pages.', issue: 178 },
        ],
    },
    {
        version: '1.45.0',
        date: '2026-10-30',
        summary: 'Recordings of every word, and of the first sentences you meet for each, are ready, and the About page now credits their voice. Play buttons come in a later version.',
        issue: 164,
    },
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
        summary: 'A word\'s page shows its closest synonyms and the words you mixed it up with, which replaces the separate Mix-ups page.',
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
