/**
 * The layout rules no static check can see (AGENTS.md, Design rules; docs/DESIGN_SYSTEM.md),
 * measured in a real browser on both production builds at phone widths (320 and 375px):
 *
 * - no page scrolls sideways;
 * - no text below the 12px floor (furigana, in `rt`, and SVG chart labels excepted);
 * - every text input is at least 16px, or iOS zooms into it on focus;
 * - the dictionary's nav links, pager links, toggles, tiles, disclosure summaries and single links
 *   in a row (a kanji's book position, a range step's glyph) are at least 44px tall;
 * - a dictionary list row (`.entry-list a`, `.grammar-list a`, `.range-list a`) is plain: primary
 *   ink, no underline (docs/DESIGN_SYSTEM.md section 8: a row is a link by its shape);
 * - a word in a dictionary sentence (`.sentence-jp a`) has no text underline: the running-text
 *   underline on `p a` must not stack on its dotted border;
 * - a dictionary pager link's spoken name contains its visible text (WCAG 2.5.3, Label in Name):
 *   no `aria-label` that replaces "301-400" with other words;
 * - About before setup shows a visible dictionary link, in a footer aligned with the header;
 * - the update banner, shown by a server whose version.json names a newer version, has Reload and
 *   Dismiss at least 44px tall, like ResumeSessionBar in the same slot;
 * - setup's "Vocabulary order" heading and "Start learning" button sit within about two screens of
 *   the top at 320px, 375px and 1280px, not under the kanji grid (issue #158); with the grid
 *   opened, "Done marking" sits within a screen of the page's end and brings Start learning back
 *   into view;
 * - furigana sits over kanji only, never over kana, no ruby (a run of kanji with its reading)
 *   breaks across lines, and no two readings on a line touch (word pages' example sentences, in each app);
 * - a `#synonyms` link followed inside the app opens a word page on its Synonyms tab;
 * - a word page's first screen, on a small phone (375x667 and 320x568), holds its headword,
 *   reading and its play button, summary gloss and status line;
 * - a word page's tab row sticks to the top once scrolled to, with no sideways page scroll at
 *   320px, the open tab inside the row's view, and a tab chosen while it is stuck brings its
 *   panel's top just under the row, as does tapping the open tab again;
 * - a word page's tab row too wide for a phone runs to the screen's edge on each side it has tabs
 *   past, with a tab cut by that edge, so the row shows it scrolls (no tab hidden at the padding),
 *   scrolled to either end and after choosing any tab;
 * - a word page's Review now leaves the word page once in history: a finished review goes back to
 *   it, and Back mid-review lands on it;
 * - a sentence word tapped on a phone opens its lookup card as a bottom sheet that fits the
 *   viewport, with a 44px Close and 44px links (Open word page), and no sideways scroll;
 * - a word page's tabs are 44px tap targets on a phone;
 * - no word in an app sentence has side space (margin or padding): Japanese has no spaces;
 * - example sentences (a word page's Dict tab, a grammar page) are spaced apart, never ruled;
 * - play buttons (a word's reading, a word page's and a grammar page's example sentences) are
 *   44px tap targets on a phone at the first line of what they play (the sentence, the reading, a
 *   kana word's note), and each of those pages has a "Play sentence" button.
 *
 * Usage: build both apps (`bun run --cwd apps/gokan-srs build`, `bun run --cwd
 * apps/gokan-dictionary build`), then `bun run check:layout`. Needs Chrome or Chromium: found at
 * the usual paths, or named by CHROME_PATH. Run by CI (.github/workflows/ci-layout.yml).
 *
 * Chrome is driven over the DevTools protocol with Bun's own WebSocket: Playwright's transports
 * do not work under Bun on Windows, and this needs nothing installed.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KANJI_CHARS } from '@gokan/dataset-schema';
import { buildMissing, dictionaryFile, dictionaryPages, listeningTitlesToMark, serve, srsFile, srsRoutes, srsVersion } from './lib/builtSite';
import { launchChrome, type Tab } from './lib/chrome';

const VIEWPORTS = [{ width: 320, height: 720 }, { width: 375, height: 812 }];
const DESKTOP = { width: 1280, height: 800 };

function fail(message: string): never {
    console.error(`[check-layout] ${message}`);
    process.exit(1);
}

const missing = buildMissing();
if (missing) fail(missing);

const srs = await serve(srsFile);
const dictionary = await serve(dictionaryFile);
const chrome = await launchChrome().catch((error: unknown): never => fail(error instanceof Error ? error.message : String(error)));

// -- The measurements -----------------------------------------------------------------------------

/**
 * Runs in the page; returns one line per broken rule. Widths are measured against the device's,
 * not innerWidth: on a phone, content wider than the screen widens the layout viewport (the page
 * is zoomed out, every text shrinks), so innerWidth grows with it and hides the overflow.
 */
const MEASURE = (deviceWidth: number, tapTargets: string) => `(() => {
    const problems = [];
    const describe = el => (el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0, 3).join('.') : '') + ' "' + (el.textContent || el.placeholder || '').trim().slice(0, 30) + '"');
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const overflow = document.documentElement.scrollWidth - ${deviceWidth};
    if (overflow > 1) {
        const wide = [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > ${deviceWidth} + 1 && visible(el)).slice(-3).map(describe);
        problems.push('scrolls sideways by ' + overflow + 'px (widest: ' + wide.join(', ') + ')');
    }
    const small = [];
    for (const el of document.querySelectorAll('body *')) {
        if (el.closest('rt, svg') || !visible(el)) continue;
        const hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (hasText && parseFloat(getComputedStyle(el).fontSize) < 12) small.push(describe(el) + ' ' + getComputedStyle(el).fontSize);
    }
    if (small.length) problems.push('text below 12px: ' + small.slice(0, 4).join(', ') + (small.length > 4 ? ' (+' + (small.length - 4) + ')' : ''));
    const inputs = [...document.querySelectorAll('input, textarea, select')]
        .filter(el => !['checkbox', 'radio', 'range', 'hidden', 'button', 'submit'].includes(el.type) && visible(el) && parseFloat(getComputedStyle(el).fontSize) < 16);
    if (inputs.length) problems.push('input below 16px (iOS zooms in): ' + inputs.slice(0, 3).map(el => describe(el) + ' ' + getComputedStyle(el).fontSize).join(', '));
    const short = ${JSON.stringify(tapTargets)} ? [...document.querySelectorAll(${JSON.stringify(tapTargets)})].filter(el => visible(el) && el.getBoundingClientRect().height < 43.5) : [];
    if (short.length) problems.push('tap target under 44px: ' + short.slice(0, 3).map(el => describe(el) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px').join(', '));
    const underlined = [...document.querySelectorAll('.sentence-jp a')].filter(el => visible(el) && getComputedStyle(el).textDecorationLine !== 'none');
    if (underlined.length) problems.push('sentence word underlined (only its dotted border is): ' + underlined.slice(0, 3).map(describe).join(', '));
    const probe = document.body.appendChild(document.createElement('span'));
    probe.style.color = 'var(--primary)';
    const ink = getComputedStyle(probe).color;
    probe.remove();
    const inked = [...document.querySelectorAll('.entry-list a, .grammar-list a, .range-list a')].filter(el => visible(el) && (getComputedStyle(el).color !== ink || getComputedStyle(el).textDecorationLine !== 'none'));
    if (inked.length) problems.push('list row not plain (primary ink, no underline): ' + inked.slice(0, 3).map(el => describe(el) + ' ' + getComputedStyle(el).color).join(', '));
    const renamed = [...document.querySelectorAll('.pager a[aria-label]')].filter(el => !el.getAttribute('aria-label').includes(el.textContent.trim()));
    if (renamed.length) problems.push('pager link named without its visible text (WCAG 2.5.3; prefix it with a visually hidden span instead): ' + renamed.slice(0, 3).map(el => describe(el) + ' named "' + el.getAttribute('aria-label') + '"').join(', '));
    const sideSpace = el => { const s = getComputedStyle(el); return parseFloat(s.marginLeft) + parseFloat(s.marginRight) + parseFloat(s.paddingLeft) + parseFloat(s.paddingRight); };
    const spaced = [...document.querySelectorAll('[data-sentence] > *')].filter(el => visible(el) && sideSpace(el) > 0);
    if (spaced.length) problems.push('sentence word has side margin or padding (reads as a space in Japanese): ' + spaced.slice(0, 3).map(describe).join(', '));
    // Furigana (docs/DESIGN_SYSTEM.md): a reading sits over kanji only (what rubyParts counts as
    // kanji), unless rubyParts fell back to the whole word, which it marks; a ruby (a run of kanji
    // with its reading) never breaks across lines (the browser would cut base and reading apart, putting the wrong
    // syllables over each kanji); and two readings on a line never touch, measured on the
    // reading's glyphs (a Range over its text), not its box, whose padding keeps them apart.
    const kanjiOnly = /^[${KANJI_CHARS}]+$/;
    const rubies = [...document.querySelectorAll('ruby')].filter(visible);
    const overKana = rubies.filter(el => !el.hasAttribute('data-ruby-fallback') && !kanjiOnly.test([...el.childNodes].filter(n => n.nodeName !== 'RT').map(n => n.textContent).join('')));
    if (overKana.length) problems.push('reading over kana (furigana goes over the kanji only): ' + overKana.slice(0, 3).map(describe).join(', '));
    const broken = rubies.filter(el => { const tops = [...el.getClientRects()].filter(r => r.width > 0).map(r => r.top); return tops.some(top => Math.abs(top - tops[0]) >= 2); });
    if (broken.length) problems.push('ruby breaks across lines: ' + broken.slice(0, 3).map(describe).join(', '));
    const readings = [...document.querySelectorAll('rt')].filter(visible).map(el => { const range = document.createRange(); range.selectNodeContents(el); return { el, rect: range.getBoundingClientRect() }; }).filter(r => r.rect.width > 0);
    // Lines first (tops within 2px), then left to right in each: a sub-pixel difference in top
    // must not put a reading on the right before one on its left.
    readings.sort((a, b) => a.rect.top - b.rect.top);
    const lines = [];
    for (const reading of readings) {
        const line = lines[lines.length - 1];
        if (line && reading.rect.top - line[0].rect.top < 2) line.push(reading);
        else lines.push([reading]);
    }
    const touching = [];
    for (const line of lines) {
        line.sort((a, b) => a.rect.left - b.rect.left);
        for (let i = 1; i < line.length; i++) {
            const prev = line[i - 1].rect, next = line[i].rect;
            if (next.left - prev.right < 1) touching.push(line[i - 1].el.textContent + ' / ' + line[i].el.textContent + ' (' + (next.left - prev.right).toFixed(1) + 'px)');
        }
    }
    if (touching.length) problems.push('neighbouring readings touch: ' + touching.slice(0, 3).join(', ') + (touching.length > 3 ? ' (+' + (touching.length - 3) + ')' : ''));
    // A reading (any Japanese span) in a list row is one unit beside its headword: it is cut with
    // an ellipsis or wraps whole, never broken mid-word (しょうじょ / う). Counted on its text's
    // line boxes, since a flex item's own box is one rectangle however many lines it holds.
    const splitInRow = [...document.querySelectorAll('[data-list-row] span[lang=ja]')].filter(visible).filter(el => {
        const tops = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.parentElement.closest('rt')) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const rect of range.getClientRects()) if (rect.width > 0) tops.push(rect.top);
        }
        return tops.some(top => Math.abs(top - tops[0]) >= 2);
    });
    if (splitInRow.length) problems.push('Japanese in a list row breaks across lines (a reading is one unit): ' + splitInRow.slice(0, 3).map(describe).join(', '));
    return problems;
})()`;

const DICTIONARY_TAP_TARGETS = '.site-nav a, .pager a, summary, .kanji-tiles a, .range-list a, .kanji-courses a, .range-step h3 a, button.button';

const failures: string[] = [];
let checked = 0;
async function measure(tab: Tab, page: string, width: number, tapTargets = ''): Promise<void> {
    checked++;
    for (const problem of await tab.evaluate<string[]>(MEASURE(width, tapTargets))) failures.push(`${width}px ${page}: ${problem}`);
}

const DICTIONARY_PAGES = dictionaryPages();
const SRS_ROUTES = srsRoutes();
const SRS_VERSION = srsVersion();
// The same build behind a version.json naming the next major: what an open tab sees once a newer
// deploy is live, the one way to render the update banner.
const NEWER_VERSION = `${Number(SRS_VERSION.split('.')[0]) + 1}.0.0`;
const NEWER_DIR = mkdtempSync(join(tmpdir(), 'gokan-layout-'));
writeFileSync(join(NEWER_DIR, 'version.json'), JSON.stringify({ version: NEWER_VERSION, dataset: 'check-layout' }));
const updated = await serve(pathname => (pathname === '/version.json' ? join(NEWER_DIR, 'version.json') : srsFile(pathname)));
const [COMPLETED_TITLE, WATCHING_TITLE] = listeningTitlesToMark();
// 登場人物: its sentences hold long readings that wrap at the end of a line at 320 and 375px, the
// case where a ruby broken across lines puts the wrong syllables over each kanji. A dataset
// fixture, not discovered from the build: when a dataset bump drops the word or its sentences,
// measureFuriganaFixture names it as the thing to update.
const FURIGANA_VOCAB = '1638880';
const FIXTURE_MOVED = `FURIGANA_VOCAB ${FURIGANA_VOCAB} has no example sentence with furigana: pick another word whose sentences wrap at 320px`;

// A word page with mix-ups (輝く: more than the five shown, a long English sentence, an answer
// naming a word, raw ones and an unconverted Latin token with no break point), learned so its Study
// tab shows them, then its Synonyms tab, which holds a mixed-up word, and its Kanji tab. Then 取る,
// whose pairs make the longest Synonyms tab, as it opens and with every meaning and row shown. Readable records under a
// readable key, which the compact payload keeps as it is.
const MIXUP_WORD = '1224020';
/** Its reading, the answer to its one due card in the Review now check. */
const MIXUP_WORD_READING = 'かがやく';
const LONG_SYNONYMS_WORD = '1326980';
const MIXUPS = [
    { answer: '光る', outcome: 'accepted', typed: '1272820', meaning: 'shine', cue: 'The stars were shining brightly in the clear winter sky above the sleeping mountain village.' },
    { answer: 'ひかる', outcome: 'accepted', typed: '1272820' },
    { answer: 'てらす', outcome: 'wrong', cue: 'Her eyes shone with joy.' },
    { answer: '差す', outcome: 'neutral', typed: '1291330', cue: 'The morning sun shone through the window.' },
    { answer: 'かがやかせる', outcome: 'wrong' },
    { answer: 'ひかりかがやく', outcome: 'accepted', meaning: 'glitter', cue: 'The lake glittered.' },
    { answer: `kagayaku${'u'.repeat(32)}`, outcome: 'wrong', cue: 'The lake glittered.' },
].map((record, i) => ({ asked: MIXUP_WORD, ...record, date: Date.UTC(2026, 9, 1) + i * 3_600_000 }));
// Progress is one record in IndexedDB (StorageService), the payload localStorage used to hold.
const SEED_MIXUPS = `(async () => {
    const key = 'GOKAN_SRS_PROGRESS';
    const done = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const db = await done(indexedDB.open('gokan-srs'));
    const progress = JSON.parse(await done(db.transaction('progress').objectStore('progress').get(key)));
    progress.mixups = ${JSON.stringify(MIXUPS)};
    await done(db.transaction('progress', 'readwrite').objectStore('progress').put(JSON.stringify(progress), key));
    db.close();
})()`;

// 差す: its examples load after the word, so a `#synonyms` link must still land on Synonyms.
const SYNONYMS_LINK_WORD = '1291330';
/** The word page's Synonyms tab is open: its tab selected, its panel shown with its rows. */
const SYNONYMS_OPEN = `(() => {
    const panel = document.getElementById('word-panel-synonym');
    return document.getElementById('word-tab-synonym')?.getAttribute('aria-selected') === 'true'
        && !!panel && !panel.hidden && panel.querySelector('a') !== null;
})()`;
/**
 * Follows a `#synonyms` link inside the app, as the quiz's "Compare synonyms" does (no page
 * load), and checks the page opened on its Synonyms tab, still open once the page has settled.
 */
async function checkSynonymsLink(tab: Tab, app: string, width: number): Promise<void> {
    await tab.goto(`${app}/vocab`, 'Vocabulary');
    await tab.evaluate(`(() => {
        history.pushState({}, '', '/vocab/${SYNONYMS_LINK_WORD}#synonyms');
        dispatchEvent(new PopStateEvent('popstate'));
    })()`);
    try {
        await tab.until(`${SYNONYMS_OPEN} && document.querySelector('[data-sentences="settled"]') !== null`, 'the Synonyms tab open, the page settled', 10000);
        await new Promise(resolve => setTimeout(resolve, 1000));
        await tab.until(SYNONYMS_OPEN, 'the Synonyms tab still open', 1000);
    } catch {
        failures.push(`${width}px srs /vocab/${SYNONYMS_LINK_WORD}#synonyms: the page did not open on its Synonyms tab`);
    }
}

/** Opens every meaning and every row of the open Synonyms panel: its longest state. */
const EXPAND_SYNONYMS = `(async () => {
    const more = () => [...document.querySelectorAll('#word-panel-synonym button')].filter(b => /^Show (all .* for this meaning|\\d+ more meanings?)$/.test(b.textContent.trim()));
    for (let round = 0; round < 50 && more().length > 0; round++) {
        for (const button of more()) button.click();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return more().length;
})()`;

/**
 * A Synonyms row's description is the senses the two words share, its content: it wraps, and
 * a description cut off with an ellipsis is a failure naming the row. Finding no description at
 * all is a failure too, so a changed selector cannot leave the check passing on nothing.
 */
async function checkSynonymDescriptions(tab: Tab, page: string, width: number): Promise<void> {
    const { found, clipped } = await tab.evaluate<{ found: number; clipped: string[] }>(`(() => {
        const descriptions = [...document.querySelectorAll('#word-panel-synonym a .type-support')];
        return {
            found: descriptions.length,
            clipped: descriptions
                .filter(el => el.scrollWidth > el.clientWidth)
                .map(el => el.closest('a').querySelector('.font-mincho')?.textContent ?? el.textContent),
        };
    })()`);
    if (found === 0) failures.push(`${width}px ${page}: no Synonyms descriptions found: the check measured nothing`);
    for (const row of clipped) failures.push(`${width}px ${page}: the shared senses of ${row} are cut off, not wrapped`);
}

/** Opens a word page's tab by its label (a `role=tab` button: other buttons share the words). */
async function openWordTab(tab: Tab, page: string, width: number, label: string): Promise<boolean> {
    const opened = await tab.evaluate<boolean>(`(() => {
        const button = [...document.querySelectorAll('[role=tab]')].find(el => el.textContent.trim() === ${JSON.stringify(label)});
        if (!button) return false;
        button.click();
        return true;
    })()`);
    if (!opened) failures.push(`${width}px ${page}: no ${label} tab`);
    await new Promise(resolve => setTimeout(resolve, 400));
    return opened;
}

/**
 * The smaller phones whose first screen must hold a word page's essentials, by the width the
 * page is measured at: the iPhone SE (375x667) and the first SE (320x568).
 */
const FIRST_SCREEN: Record<number, number> = { 320: 568, 375: 667 };
const FIRST_SCREEN_PARTS = [
    ['headword', 'h1'],
    ['reading', '[data-word-reading]'],
    ['summary gloss', '[data-summary-gloss]'],
    ['status line', '[data-word-status]'],
    // Every word in the dataset has a clip, so its play button follows the reading (issue 178).
    ['reading\'s play button', '[data-word-reading] [data-play-button]'],
] as const;
/** Play buttons (components/PlayButton.tsx): a 44px tap target on a phone, measured by measure(). */
const PLAY_BUTTONS = '[data-play-button]';
// Its examples all have clips, as every grammar example a clip was made for does.
const GRAMMAR_POINT = 'n5-001';

/** A word learned in kana: its header's play button follows the kanji-spelling note, which wraps at 320px. */
const KANA_WORD = '1000225';

/** A word page's tabs (components/ui/TabNav.tsx, page tabs): a phone's main way around the page. */
const PAGE_TABS = '[role="tab"]';

/**
 * Example sentences are spaced apart, not ruled (docs/DESIGN_SYSTEM.md section 4: nothing draws a
 * line inside a level), on a word page's Dict tab and a grammar page alike.
 */
async function checkExamplesUnruled(tab: Tab, page: string, width: number): Promise<void> {
    const result = await tab.evaluate<{ count: number; ruled: string[] }>(`(() => {
        const items = [...document.querySelectorAll('[data-example-sentence]')].filter(el => el.getBoundingClientRect().width > 0);
        const ruled = items.filter(el => { const s = getComputedStyle(el); return parseFloat(s.borderTopWidth) > 0 || parseFloat(s.borderBottomWidth) > 0; });
        return { count: items.length, ruled: ruled.slice(0, 3).map(el => el.textContent.trim().slice(0, 20)) };
    })()`);
    if (result.count === 0) failures.push(`${width}px ${page}: no example sentence ([data-example-sentence]) to check`);
    for (const text of result.ruled) failures.push(`${width}px ${page}: example sentence ruled with a top or bottom border (space them apart): ${text}`);
}

/**
 * A kanji's reading (components/KanjiReadings.tsx) never breaks across lines: ショ / ウ reads as
 * two readings, or one that does not exist. Lines break only between readings.
 */
async function checkKanjiReadingsUnbroken(tab: Tab, page: string, width: number): Promise<void> {
    const result = await tab.evaluate<{ count: number; broken: string[] }>(`(() => {
        const readings = [...document.querySelectorAll('[data-kanji-reading]')].filter(el => el.getBoundingClientRect().width > 0);
        // One rect per text node (the reading and its 、 are two), so a break shows as rects on two rows.
        const broken = readings.filter(el => { const tops = [...el.getClientRects()].filter(r => r.width > 0).map(r => r.top); return tops.some(top => Math.abs(top - tops[0]) >= 2); });
        return { count: readings.length, broken: broken.slice(0, 3).map(el => el.textContent.trim()) };
    })()`);
    if (result.count === 0) failures.push(`${width}px ${page}: no kanji reading ([data-kanji-reading]) to check`);
    for (const text of result.broken) failures.push(`${width}px ${page}: a kanji reading breaks across lines: ${text}`);
}

/** At least one sentence on the page carries a play button, named for what it plays. */
async function checkSentencePlayButtons(tab: Tab, page: string, width: number): Promise<void> {
    const named = await tab.evaluate<number>(`[...document.querySelectorAll('[data-play-row] [data-sentence]')].map(el => el.closest('[data-play-row]').querySelector(':scope > [data-play-button]')).filter(el => el && el.getAttribute('aria-label') === 'Play sentence' && el.getBoundingClientRect().width > 0).length`);
    if (named === 0) failures.push(`${width}px ${page}: no sentence has a "Play sentence" button`);
    await checkPlayButtonsOnFirstLine(tab, page, width);
}

/**
 * Every play button on the page sits at the first line of what it plays (the element before it:
 * the sentence, the reading, the kana note): its centre within the upper three quarters of that
 * first line. A button wrapped alone onto a line below the sentence, or centred between a
 * wrapped note's two lines, reads as a control of its own.
 */
async function checkPlayButtonsOnFirstLine(tab: Tab, page: string, width: number): Promise<void> {
    const strays = await tab.evaluate<string[]>(`[...document.querySelectorAll(${JSON.stringify(PLAY_BUTTONS)})].filter(el => el.getBoundingClientRect().width > 0).flatMap(el => {
        const before = el.previousElementSibling;
        if (!before) return [el.getAttribute('aria-label') + ': nothing before it to follow'];
        // A sentence's line is its own (leading-loose), not its wrapper's.
        const style = getComputedStyle(before.querySelector('[data-sentence]') ?? before);
        const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
        const button = el.getBoundingClientRect();
        const below = (button.top + button.bottom) / 2 - before.getBoundingClientRect().top;
        return below < line * 0.75 ? [] : [el.getAttribute('aria-label') + ' centred ' + Math.round(below) + 'px below the top of what it plays (its first line is ' + Math.round(line) + 'px)'];
    })`);
    for (const stray of strays) failures.push(`${width}px ${page}: play button off the first line: ${stray}`);
}

/**
 * A word page on a small phone shows, without scrolling, what a learner looks it up for: the
 * headword, its reading, the summary gloss and the status line (Learn this word, or the status).
 */
async function checkWordFirstScreen(tab: Tab, page: string, width: number, restoreHeight: number): Promise<void> {
    const height = FIRST_SCREEN[width];
    if (height === undefined) return;
    await tab.resize(width, height);
    const bottoms = await tab.evaluate<(number | null)[]>(`(() => {
        window.scrollTo(0, 0);
        return ${JSON.stringify(FIRST_SCREEN_PARTS.map(([, selector]) => selector))}.map(selector => {
            const el = document.querySelector(selector);
            const rect = el?.getBoundingClientRect();
            return rect && rect.height > 0 ? rect.bottom : null;
        });
    })()`);
    FIRST_SCREEN_PARTS.forEach(([name], i) => {
        const bottom = bottoms[i];
        if (bottom === null || bottom === undefined) failures.push(`${width}x${height} ${page}: no ${name} to measure`);
        else if (bottom > height) failures.push(`${width}x${height} ${page}: the ${name} ends ${Math.round(bottom)}px down, below the first screen (${height}px)`);
    });
    await tab.resize(width, restoreHeight);
}

/**
 * A tab row wider than the phone (its tablist's scrollWidth over its clientWidth) is the cue that
 * it scrolls only when it runs to the screen's edge and a tab is cut there: a row stopping at the
 * page's padding hides whole tabs behind a clean edge, or cuts one where it reads as a glitch.
 * Checked with the row scrolled to each end, then after choosing each tab in turn from each end
 * (the row keeps the chosen tab in view): on every side that then has tabs past the screen's edge,
 * one must be cut by it (a gap between two tabs landing on the edge hides the next one as surely as
 * the padding). The tab open before is chosen again after, as the tab last chosen carries over.
 */
async function checkTabRowBleed(tab: Tab, page: string, width: number): Promise<void> {
    const problems = await tab.evaluate<string[] | null>(`(async () => {
        const list = document.querySelector('[data-detail-tabs] [role=tablist]');
        if (!list) return null;
        if (list.scrollWidth <= list.clientWidth) return [];
        const edge = document.documentElement.clientWidth;
        const row = list.getBoundingClientRect();
        const buttons = [...list.querySelectorAll('[role=tab]')];
        const was = list.scrollLeft;
        const opened = buttons.find(el => el.getAttribute('aria-selected') === 'true');
        const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))));
        const problems = [];
        // Cut means a slice of at least 6px on each side of the edge: a 1px sliver is no cue. The 6
        // mirrors NEIGHBOUR_SLICE (utils/tabScroll.utils.ts), which this in-page script cannot import.
        const slice = 6;
        const sides = [
            ['right', t => t.right > edge + 0.5, row.right >= edge - 0.5, t => t.left <= edge - slice && t.right >= edge + slice, Math.round(edge - row.right)],
            ['left', t => t.left < -0.5, row.left <= 0.5, t => t.left <= -slice && t.right >= slice, Math.round(row.left)],
        ];
        // Every side with tabs past the screen's edge must show one cut by it.
        const assess = (when) => {
            const tabs = buttons.map(el => el.getBoundingClientRect());
            for (const [side, past, reaches, cut, gap] of sides) {
                if (!tabs.some(past)) continue;
                if (!reaches) problems.push("the tab row stops " + gap + "px short of the screen's " + side + " edge, hiding its tabs at the padding");
                else if (!tabs.some(cut)) problems.push(when + ", the tab row has tabs past the screen's " + side + " edge but none cut by it by 6px or more, so nothing shows it scrolls");
            }
        };
        const ends = [['start', 0], ['end', list.scrollWidth]];
        for (const [end, scrollTo] of ends) {
            list.scrollLeft = scrollTo;
            assess('scrolled to its ' + end);
        }
        for (const [end, scrollTo] of ends) {
            for (const button of buttons) {
                list.scrollLeft = scrollTo;
                await settle();
                button.click();
                await settle();
                assess('with ' + button.textContent.trim() + ' chosen from the row\\'s ' + end);
            }
        }
        opened?.click();
        await settle();
        list.scrollLeft = was;
        return [...new Set(problems)];
    })()`);
    if (problems === null) failures.push(`${width}px ${page}: no tab row`);
    else for (const problem of problems) failures.push(`${width}px ${page}: ${problem}`);
}

/**
 * Scrolled past the header, the tab row sticks at the viewport's top, the page does not scroll
 * sideways (measured as scrolled), and the open tab sits inside the row's visible part. Tapping
 * the open tab again, then choosing another, each bring the panel's top just under the row.
 */
async function checkStickyTabs(tab: Tab, page: string, width: number, next: string): Promise<void> {
    const ROW = `document.querySelector('[data-detail-tabs]')`;
    const stuck = await tab.evaluate<number | null>(`(() => {
        const row = ${ROW};
        if (!row) return null;
        window.scrollTo(0, row.getBoundingClientRect().top + window.scrollY + 600);
        return row.getBoundingClientRect().top;
    })()`);
    await new Promise(resolve => setTimeout(resolve, 200));
    if (stuck === null) {
        failures.push(`${width}px ${page}: no tab row`);
        return;
    }
    if (Math.abs(stuck) > 1) failures.push(`${width}px ${page}: scrolled past the header, the tab row's top is at ${Math.round(stuck)}px, not stuck at 0`);
    await measure(tab, `${page}, scrolled, tab row stuck`, width);
    const hidden = await tab.evaluate<boolean | null>(`(() => {
        const list = ${ROW}?.querySelector('[role=tablist]');
        const open = list?.querySelector('[aria-selected="true"]');
        if (!list || !open) return null;
        // The row's view stops at its inline padding: a row bled to the screen's edges pads its tabs back in line.
        const style = getComputedStyle(list);
        const row = list.getBoundingClientRect(), tab = open.getBoundingClientRect();
        return tab.left < row.left + parseFloat(style.paddingLeft) - 0.5 || tab.right > row.right - parseFloat(style.paddingRight) + 0.5;
    })()`);
    if (hidden === null) failures.push(`${width}px ${page}: no open tab in the tab row`);
    else if (hidden) failures.push(`${width}px ${page}: the open tab is scrolled out of the tab row's view`);
    const PANEL_GAP = `(() => {
        const row = ${ROW};
        const panel = [...document.querySelectorAll('[role=tabpanel]')].find(el => !el.hidden);
        return row && panel ? panel.getBoundingClientRect().top - row.getBoundingClientRect().bottom : null;
    })()`;
    // Scrolled down into the open panel, its tab tapped again brings back the panel's top.
    const open = await tab.evaluate<string | null>(`document.querySelector('[data-detail-tabs] [aria-selected="true"]')?.textContent.trim() ?? null`);
    if (open !== null && await openWordTab(tab, page, width, open)) {
        const again = await tab.evaluate<number | null>(PANEL_GAP);
        if (again === null) failures.push(`${width}px ${page}: no open panel after tapping ${open} again`);
        else if (Math.abs(again) > 2) failures.push(`${width}px ${page}: tapping the open ${open} tab again with the tab row stuck leaves its panel's top ${Math.round(again)}px from the row's bottom, not under it`);
    }
    if (!(await openWordTab(tab, page, width, next))) return;
    const gap = await tab.evaluate<number | null>(PANEL_GAP);
    if (gap === null) failures.push(`${width}px ${page}: no open panel after choosing ${next}`);
    else if (Math.abs(gap) > 2) failures.push(`${width}px ${page}: choosing ${next} with the tab row stuck leaves its panel's top ${Math.round(gap)}px from the row's bottom, not under it`);
}

/**
 * Makes a studied word's reading due an hour ago (the reading's due date, and its introduction,
 * readable or compact), so its page offers Review now. Read on the next page load.
 */
const makeReadingDue = (vocabId: string) => `(async () => {
    const key = 'GOKAN_SRS_PROGRESS';
    const done = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const db = await done(indexedDB.open('gokan-srs'));
    const progress = JSON.parse(await done(db.transaction('progress').objectStore('progress').get(key)));
    const queue = progress.q ?? progress.learningQueue;
    const item = queue.find(entry => (entry.i ?? entry.vocabId) === ${JSON.stringify(vocabId)});
    const hourAgo = Date.now() - 3600000;
    const asStored = value => typeof value === 'number' ? hourAgo : new Date(hourAgo).toISOString();
    for (const [at, reading, due] of [['ia', 'r', 'dd'], ['introductionAt', 'reading', 'dueDate']]) {
        if (item[at] !== undefined) item[at] = asStored(item[at]);
        if (item[reading]?.[due] !== undefined) item[reading][due] = asStored(item[reading][due]);
    }
    await done(db.transaction('progress', 'readwrite').objectStore('progress').put(JSON.stringify(progress), key));
    db.close();
})()`;
const REVIEW_NOW_SHOWN = `[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Review now')`;

/**
 * Opens a studied word's page from /vocab inside the app (no page load), its reading due, at its
 * Review now. The record is edited after a fresh load, once the app has settled: a save still
 * queued from the page before would write over it.
 */
async function openDueWord(tab: Tab, app: string, vocabId: string): Promise<boolean> {
    await tab.goto(`${app}/vocab`, 'Vocabulary');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await tab.evaluate<void>(makeReadingDue(vocabId));
    await tab.goto(`${app}/vocab`, 'Vocabulary');
    await tab.evaluate(`(() => {
        history.pushState({}, '', '/vocab/${vocabId}');
        dispatchEvent(new PopStateEvent('popstate'));
    })()`);
    try {
        await tab.until(REVIEW_NOW_SHOWN, 'Review now', 10000);
        return true;
    } catch {
        return false;
    }
}

const RESUME_LABEL = 'Back to your vocabulary session';
const at = (path: string) => `location.pathname === ${JSON.stringify(path)}`;
const buttonShown = (label: string) => `[...document.querySelectorAll('button')].some(el => el.textContent.trim() === ${JSON.stringify(label)})`;

/**
 * Answers a word's review on /quiz (its one card, the reading) and waits for the word's page it
 * returns to. Fails, through `until`, when history's length changes on the way: the end must go
 * back to the entry behind the session, not add the word's page again.
 */
async function finishReview(tab: Tab, vocabId: string, reading: string): Promise<void> {
    await tab.until(`${at('/quiz')} && document.querySelector('input') !== null`, 'the review card', 10000);
    const during = await tab.evaluate<number>('history.length');
    await tab.evaluate(`(() => {
        const input = document.querySelector('input');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(reading)});
        input.dispatchEvent(new Event('input', { bubbles: true }));
    })()`);
    await tab.click('Submit');
    await tab.until(`${at(`/vocab/${vocabId}`)} || ${buttonShown('Continue')}`, 'Continue or the end of the review', 5000);
    if (await tab.evaluate<boolean>(at('/quiz'))) await tab.click('Continue');
    await tab.until(at(`/vocab/${vocabId}`), "the word's page once the review is done", 10000);
    const after = await tab.evaluate<number>('history.length');
    if (after !== during) throw new Error(`history's length changed from ${during} to ${after}`);
}

/**
 * Review now leaves the word page once in history, whether the session runs to its end or is left
 * with Back: finished, it goes back to the word's page, the same entry, and the next Back reaches
 * the page before the word; left mid-session with Back, it lands on the word's page, and resumed
 * from there through its bar and finished, it goes back to that page again. Run on a word
 * just learned (its reading, `reading`, the one card due).
 */
async function checkReviewNow(tab: Tab, app: string, width: number, vocabId: string, reading: string): Promise<void> {
    const page = `srs /vocab/${vocabId}, Review now`;
    if (!(await openDueWord(tab, app, vocabId))) {
        failures.push(`${width}px ${page}: no Review now on the word's page with its reading made due`);
        return;
    }
    await tab.click('Review now');
    try {
        await finishReview(tab, vocabId, reading);
        await tab.evaluate('history.back()');
        await tab.until(at('/vocab'), 'the page before the word', 5000);
    } catch (error) {
        failures.push(`${width}px ${page}: a finished review did not leave the word's page once in history (${error instanceof Error ? error.message : String(error)}, at ${await tab.evaluate<string>('location.pathname')})`);
    }
    if (!(await openDueWord(tab, app, vocabId))) {
        failures.push(`${width}px ${page}: no Review now on the word's page with its reading made due again`);
        return;
    }
    await tab.click('Review now');
    try {
        await tab.until(at('/quiz'), 'the review', 10000);
        await tab.evaluate('history.back()');
        await tab.until(at(`/vocab/${vocabId}`), "the word's page", 5000);
    } catch {
        failures.push(`${width}px ${page}: Back in the middle of the review does not land on the word's page (at ${await tab.evaluate<string>('location.pathname')})`);
    }
    // The review left with Back is paused on the word's page; resumed from its bar there and
    // finished, it goes back to that page again, so history still holds the word once.
    try {
        await tab.click(RESUME_LABEL);
        await finishReview(tab, vocabId, reading);
        await tab.evaluate('history.back()');
        await tab.until(at('/vocab'), 'the page before the word', 5000);
    } catch (error) {
        failures.push(`${width}px ${page}: a review resumed from the word's page and finished did not leave the word's page once in history (${error instanceof Error ? error.message : String(error)}, at ${await tab.evaluate<string>('location.pathname')})`);
        // Ended here when the check failed part-way, so no later page shows its resume bar. A
        // failure after the review finished (its history length, the Back to /vocab) leaves no
        // paused session: neither the bar nor /quiz, so there is nothing to end.
        try {
            const onQuiz = await tab.evaluate<boolean>(at('/quiz'));
            const barShown = await tab.evaluate<boolean>(`[...document.querySelectorAll('a')].some(el => el.textContent.includes(${JSON.stringify(RESUME_LABEL)}))`);
            if (!onQuiz && !barShown) return;
            if (!onQuiz) await tab.click(RESUME_LABEL);
            await tab.until(`${at('/quiz')} && ${buttonShown('End session')}`, 'the paused review', 5000);
            await tab.click('End session');
        } catch {
            failures.push(`${width}px ${page}: could not end the review left with Back`);
        }
    }
}

/**
 * Learns the word on the open page, through its "Learn this word", and opens its Study tab. A
 * page without the button is a failure: the steps after it must measure a studied word.
 */
async function learnOpenWord(tab: Tab, page: string, width: number): Promise<boolean> {
    const learnable = await tab.evaluate<boolean>(`[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Learn this word')`);
    if (!learnable) {
        failures.push(`${width}px ${page}: no "Learn this word": the word is already studied, so its Your study is not measured as it first appears`);
        return false;
    }
    await tab.click('Learn this word');
    try {
        await tab.until(`[...document.querySelectorAll('[role=tab]')].some(el => el.textContent.trim() === 'Study')`, 'the Study tab', 5000);
        await openWordTab(tab, page, width, 'Study');
        await tab.until(`[...document.querySelectorAll('h2, h3')].some(el => el.textContent.trim() === 'Your study')`, 'Your study', 5000);
    } catch {
        failures.push(`${width}px ${page}: "Learn this word" did not bring up the Study tab and Your study`);
        return false;
    }
    return true;
}

/**
 * A studied word's header status is one line ("● Learning · Next review in 1 min"): the parts of
 * the status line all start on the same line, never the review phrase wrapped under the dot.
 */
async function checkHeaderStatus(tab: Tab, page: string, width: number): Promise<void> {
    const wrapped = await tab.evaluate<boolean | null>(`(() => {
        const status = document.querySelector('[data-word-status] p.type-support');
        if (!status || status.children.length < 2) return null;
        const rects = [...status.children].map(el => el.getBoundingClientRect());
        const firstBottom = Math.min(...rects.map(rect => rect.bottom));
        return rects.some(rect => rect.top >= firstBottom - 1);
    })()`);
    if (wrapped === null) failures.push(`${width}px ${page}: no status line with a review phrase in the header`);
    else if (wrapped) failures.push(`${width}px ${page}: the header status wraps onto a second line`);
}

/**
 * How far down setup's last decisions may sit, in px from the top of the page, by width: the
 * vocabulary order heading's top and the Start learning button's bottom. Under the open grid they
 * were 14,000px (desktop) to 20,000px (phone) down. Set from the measured layout (button at 1112px
 * on desktop, 1444px at 375px, 1528px at 320px, where the method and vocabulary cards stack one
 * per row) plus about 100px for copy that wraps one more line.
 */
const SETUP_REACH_MAX: Record<number, number> = { 320: 1650, 375: 1550, 1280: 1200 };
const SETUP_REACH = `(() => {
    const top = el => el ? el.getBoundingClientRect().top + window.scrollY : null;
    const heading = [...document.querySelectorAll('h3')].find(el => el.textContent.trim() === 'Vocabulary order');
    const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Start learning');
    return { heading: top(heading), button: button ? top(button) + button.getBoundingClientRect().height : null };
})()`;
async function checkSetupReach(tab: Tab, width: number, height: number): Promise<void> {
    const reach = await tab.evaluate<{ heading: number | null; button: number | null }>(SETUP_REACH);
    const max = SETUP_REACH_MAX[width] ?? height;
    for (const [what, at] of [['the "Vocabulary order" heading', reach.heading], ['the "Start learning" button', reach.button]] as const) {
        if (at === null) failures.push(`${width}px srs /setup: no ${what}`);
        else if (at > max) failures.push(`${width}px srs /setup: ${what} reaches ${Math.round(at)}px down the page (at most ${max}, screen ${height}px)`);
    }
}

/**
 * With setup's grid open, Start learning is the whole grid above: "Done marking" must sit at the
 * grid's end (within one screen of the page's bottom), and clicking it from there must put the
 * button back on screen.
 */
const START_LEARNING_IN_VIEW = `(() => {
    const button = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Start learning');
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return rect.top >= 0 && rect.bottom <= window.innerHeight;
})()`;
async function checkDoneMarking(tab: Tab, width: number, height: number): Promise<void> {
    const fromEnd = await tab.evaluate<number | null>(`(() => {
        const done = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Done marking');
        if (!done) return null;
        return document.documentElement.scrollHeight - (done.getBoundingClientRect().bottom + window.scrollY);
    })()`);
    if (fromEnd === null) {
        failures.push(`${width}px srs /setup, individual kanji: no "Done marking" at the grid's end`);
        return;
    }
    if (fromEnd > height) failures.push(`${width}px srs /setup, individual kanji: "Done marking" sits ${Math.round(fromEnd)}px above the page's end (at most one screen, ${height}px)`);
    // Focused first, as a keyboard user reaches it: `click` alone moves no focus.
    await tab.evaluate(`(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Done marking')?.focus();
    })()`);
    await tab.click('Done marking');
    try {
        await tab.until(START_LEARNING_IN_VIEW, 'Start learning in view', 3000);
    } catch {
        failures.push(`${width}px srs /setup: after "Done marking", the "Start learning" button is not on screen`);
    }
    // Closing the grid unmounts the focused button: focus must land on the toggle (Shift+Tab then
    // reaches Start learning), not drop to the top of the document.
    const focused = await tab.evaluate<string | null>(`document.activeElement instanceof HTMLButtonElement ? document.activeElement.textContent.trim() : document.activeElement?.tagName ?? null`);
    if (focused !== 'Mark individual kanji') failures.push(`${width}px srs /setup: after "Done marking", focus is on ${focused ?? 'nothing'}, not the "Mark individual kanji" toggle`);
}

/**
 * A sentence word tapped on a phone opens its lookup card as a bottom sheet (issue #174). The tap
 * is a touch pointerdown then a click, which is what the trigger reads to choose the sheet over
 * the pinned popover; Chrome here is a desktop pointer, so the touch is dispatched by hand.
 */
const TAP_SENTENCE_WORD = `(() => {
    const word = document.querySelector('[data-sentence] [data-lookup-trigger]');
    if (!word) return false;
    word.scrollIntoView({ block: 'center' });
    word.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', isPrimary: true }));
    word.click();
    return true;
})()`;
const SHEET_FIT = `(() => {
    const sheet = document.querySelector('[data-bottom-sheet] > div');
    const close = document.querySelector('[data-bottom-sheet] [data-sheet-close]');
    if (!sheet || !close) return 'no sheet or no Close';
    const r = sheet.getBoundingClientRect();
    const c = close.getBoundingClientRect();
    const problems = [];
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) problems.push('the sheet does not fit the viewport (' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(', ') + ' in ' + innerWidth + 'x' + innerHeight + ')');
    if (c.width < 43.5 || c.height < 43.5) problems.push('its Close is ' + Math.round(c.width) + 'x' + Math.round(c.height) + 'px, under 44px');
    return problems.join('; ');
})()`;

async function checkLookupSheet(tab: Tab, page: string, width: number): Promise<void> {
    const where = `${width}px ${page}, a sentence word's lookup sheet`;
    if (!await tab.evaluate<boolean>(TAP_SENTENCE_WORD)) {
        failures.push(`${where}: no sentence word to tap`);
        return;
    }
    try {
        await tab.until(`document.querySelector('[data-bottom-sheet] [data-lookup-word]') !== null`, 'the word card in a bottom sheet', 10000);
    } catch {
        failures.push(`${where}: tapping a sentence word opened no bottom sheet with its word card`);
        return;
    }
    const fit = await tab.evaluate<string>(SHEET_FIT);
    if (fit) failures.push(`${where}: ${fit}`);
    await measure(tab, `${page}, a sentence word's lookup sheet`, width, '[data-sheet-close], [data-bottom-sheet] a');
    await tab.evaluate<void>(`document.querySelector('[data-bottom-sheet] [data-sheet-close]').click()`);
    try {
        await tab.until(`document.querySelector('[data-bottom-sheet]') === null`, 'the sheet closed', 5000);
    } catch {
        failures.push(`${where}: Close did not close the sheet`);
    }
}

/** Measures the fixture word's page, after checking it still shows a reading to measure. */
async function measureFuriganaFixture(tab: Tab, url: string, ready: string, page: string, width: number, tapTargets = ''): Promise<void> {
    try {
        await tab.goto(url, ready);
        await tab.until(`[...document.querySelectorAll('ruby')].some(el => el.getBoundingClientRect().width > 0)`, 'a visible ruby', 5000);
    } catch (error) {
        failures.push(`${width}px ${page}: ${FIXTURE_MOVED} (${error instanceof Error ? error.message : String(error)})`);
        return;
    }
    await measure(tab, page, width, tapTargets);
}

try {
    // Desktop, for setup only: the one page whose check here is about height, not width.
    const desktop = await chrome.openTab(DESKTOP.width, DESKTOP.height);
    await desktop.goto(`http://127.0.0.1:${srs.port}/`, 'I already know some kanji');
    await desktop.click('I already know some kanji');
    await desktop.until(`document.body.innerText.includes('Kanji learning method')`, 'the setup screen');
    await checkSetupReach(desktop, DESKTOP.width, DESKTOP.height);
    await desktop.click('Mark individual kanji');
    await checkDoneMarking(desktop, DESKTOP.width, DESKTOP.height);
    // A studied word's header at 1280px, where the narrow page leaves the header its one column.
    await desktop.click('Start learning');
    await desktop.goto(`http://127.0.0.1:${srs.port}/vocab/${MIXUP_WORD}`, 'Dict');
    if (await learnOpenWord(desktop, `srs /vocab/${MIXUP_WORD}`, DESKTOP.width)) await checkHeaderStatus(desktop, `srs /vocab/${MIXUP_WORD}, studied`, DESKTOP.width);
    // The same tabs at every width.
    await openWordTab(desktop, `srs /vocab/${MIXUP_WORD}`, DESKTOP.width, 'Synonyms');
    await desktop.close();
    for (const { width, height } of VIEWPORTS) {
        const tab = await chrome.openTab(width, height);
        const app = `http://127.0.0.1:${srs.port}`;
        // About is the one route shown before setup (and the one a crawler indexes), in its own frame.
        await tab.goto(`${app}/about`, 'Why I Built This');
        await measure(tab, 'srs /about before setup', width);
        // A visitor from search lands here on a phone with no tab bar: the footer is the way on.
        const dictionaryLinkShown = await tab.evaluate<boolean>(`[...document.querySelectorAll('a[href="/dictionary/"]')].some(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; })`);
        if (!dictionaryLinkShown) failures.push(`${width}px srs /about before setup: no visible link to /dictionary/`);
        // The footer shows at phone widths here only, so its edge must match the header's.
        const footerOffset = await tab.evaluate<number | null>(`(() => { const logo = document.querySelector('header a'); const link = document.querySelector('footer a'); return logo && link ? link.getBoundingClientRect().left - logo.getBoundingClientRect().left : null; })()`);
        if (footerOffset === null) failures.push(`${width}px srs /about before setup: no header logo or footer link to align`);
        else if (Math.abs(footerOffset) > 1) failures.push(`${width}px srs /about before setup: footer links start ${footerOffset}px from the header logo's edge`);
        // The version the build baked in, visible, so a learner can say which one they are on.
        const versionShown = await tab.evaluate<boolean>(`[...document.querySelectorAll('[data-app-version]')].some(el => el.textContent.includes(${JSON.stringify(`version ${SRS_VERSION}`)}) && el.getBoundingClientRect().width > 0)`);
        if (!versionShown) failures.push(`${width}px srs /about before setup: version ${SRS_VERSION} is not shown`);
        await tab.click("See what's new");
        await tab.until(`document.body.innerText.includes('Your version')`, "What's new before setup");
        await measure(tab, 'srs /whats-new before setup', width);
        // Another origin, so its storage is fresh: About before setup, with the banner up.
        await tab.goto(`http://127.0.0.1:${updated.port}/about`, 'Why I Built This');
        await tab.until(`document.querySelector('[data-update-banner]') !== null`, 'the update banner', 10000);
        await measure(tab, 'srs /about, update banner', width, '[data-update-banner] button');
        await tab.goto(`${app}/`, 'I already know some kanji');
        await measure(tab, 'srs /welcome', width);
        await tab.click('I already know some kanji');
        await tab.until(`document.body.innerText.includes('Kanji learning method')`, 'the setup screen');
        await measure(tab, 'srs /setup', width);
        await checkSetupReach(tab, width, height);
        await tab.click('More methods');
        await measure(tab, 'srs /setup, every method', width);
        await tab.click('Mark individual kanji');
        await measure(tab, 'srs /setup, individual kanji', width);
        await checkDoneMarking(tab, width, height);
        await tab.click('Start learning');
        for (const route of SRS_ROUTES) {
            await tab.goto(`${app}${route.path}`, route.ready);
            if (route.settled) await tab.until(`document.querySelector(${JSON.stringify(route.settled)}) !== null`, `${route.settled} on ${route.path}`, 10000);
            await measure(tab, `srs ${route.path}`, width);
        }
        // The library's rows with a status line, the tightest rows on a phone. Before any word is
        // learned: the library ranks by known words, which would page the marked titles out of view.
        await tab.goto(`${app}/listening/${COMPLETED_TITLE}`, 'Mark all watched');
        await tab.click('Mark all watched');
        await tab.goto(`${app}/listening/${WATCHING_TITLE}`, 'Mark all watched');
        await tab.click('Mark watched');
        await tab.goto(`${app}/listening`, 'Watching ·');
        await tab.until(`document.body.innerText.includes('Completed')`, 'a completed title in the library');
        await measure(tab, 'srs /listening, watching and completed titles', width);
        await measureFuriganaFixture(tab, `${app}/vocab/${FURIGANA_VOCAB}`, 'Examples', `srs /vocab/${FURIGANA_VOCAB}`, width, `${PLAY_BUTTONS}, ${PAGE_TABS}`);
        await checkSentencePlayButtons(tab, `srs /vocab/${FURIGANA_VOCAB}`, width);
        await checkExamplesUnruled(tab, `srs /vocab/${FURIGANA_VOCAB}`, width);
        await checkWordFirstScreen(tab, `srs /vocab/${FURIGANA_VOCAB}`, width, height);
        await checkLookupSheet(tab, `srs /vocab/${FURIGANA_VOCAB}`, width);
        await checkTabRowBleed(tab, `srs /vocab/${FURIGANA_VOCAB}`, width);
        await openWordTab(tab, `srs /vocab/${FURIGANA_VOCAB}`, width, 'Sentences');
        await tab.until(`document.body.innerText.includes('Shortest first')`, 'the Sentences panel');
        await measure(tab, `srs /vocab/${FURIGANA_VOCAB}, sentences panel`, width, PLAY_BUTTONS);
        await checkSentencePlayButtons(tab, `srs /vocab/${FURIGANA_VOCAB}, sentences panel`, width);
        // 登's On readings (トウ、ト、ドウ、ショウ、チョウ) wrap at both widths.
        await openWordTab(tab, `srs /vocab/${FURIGANA_VOCAB}`, width, 'Kanji');
        await tab.until(`document.querySelector('[data-kanji-reading]') !== null`, "the Kanji tab's readings", 10000);
        await checkKanjiReadingsUnbroken(tab, `srs /vocab/${FURIGANA_VOCAB}, kanji tab`, width);
        await tab.goto(`${app}/grammar/${GRAMMAR_POINT}`, 'Example sentences');
        await measure(tab, `srs /grammar/${GRAMMAR_POINT}`, width, PLAY_BUTTONS);
        await checkSentencePlayButtons(tab, `srs /grammar/${GRAMMAR_POINT}`, width);
        await checkExamplesUnruled(tab, `srs /grammar/${GRAMMAR_POINT}`, width);
        await tab.goto(`${app}/vocab/${KANA_WORD}`, 'Usually written in kana');
        await checkPlayButtonsOnFirstLine(tab, `srs /vocab/${KANA_WORD}`, width);
        await tab.evaluate<void>(SEED_MIXUPS);
        await tab.goto(`${app}/vocab/${MIXUP_WORD}`, 'Dict');
        // Learned here, so Your study's phone grid and the mix-ups under it are measured on a word that has them.
        const learned = await learnOpenWord(tab, `srs /vocab/${MIXUP_WORD}`, width);
        if (learned) {
            await tab.until(`document.body.innerText.includes('Show all mix-ups')`, 'Your mix-ups in the Study tab');
            await tab.click('Show all mix-ups');
            await measure(tab, `srs /vocab/${MIXUP_WORD}, Study tab with mix-ups`, width);
            await checkWordFirstScreen(tab, `srs /vocab/${MIXUP_WORD}, studied`, width, height);
            await checkTabRowBleed(tab, `srs /vocab/${MIXUP_WORD}, studied`, width);
        }
        await openWordTab(tab, `srs /vocab/${MIXUP_WORD}`, width, 'Synonyms');
        await tab.until(`document.body.innerText.includes('Mixed up 2 times')`, 'the Synonyms tab counting the seeded mix-ups');
        await measure(tab, `srs /vocab/${MIXUP_WORD}, synonyms tab`, width);
        await openWordTab(tab, `srs /vocab/${MIXUP_WORD}`, width, 'Kanji');
        await tab.until(`document.body.innerText.includes('Not known') || document.body.innerText.includes('Known')`, 'the Kanji tab');
        await measure(tab, `srs /vocab/${MIXUP_WORD}, kanji tab`, width);
        // The tab last chosen opens on the next word: Dict first here, for the page as it first shows.
        await openWordTab(tab, `srs /vocab/${MIXUP_WORD}`, width, 'Dict');
        if (learned) await checkReviewNow(tab, app, width, MIXUP_WORD, MIXUP_WORD_READING);
        await tab.goto(`${app}/vocab/${LONG_SYNONYMS_WORD}`, 'Meanings');
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, Dict tab`, width);
        await checkWordFirstScreen(tab, `srs /vocab/${LONG_SYNONYMS_WORD}`, width, height);
        await checkTabRowBleed(tab, `srs /vocab/${LONG_SYNONYMS_WORD}`, width);
        await openWordTab(tab, `srs /vocab/${LONG_SYNONYMS_WORD}`, width, 'Synonyms');
        await tab.until(SYNONYMS_OPEN, 'the Synonyms tab');
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms tab`, width);
        await checkSynonymDescriptions(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms tab`, width);
        const unopened = await tab.evaluate<number>(EXPAND_SYNONYMS);
        if (unopened > 0) failures.push(`${width}px srs /vocab/${LONG_SYNONYMS_WORD}: ${unopened} "Show ..." buttons left in the Synonyms tab after opening everything`);
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms tab, every meaning`, width);
        await checkSynonymDescriptions(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms tab, every meaning`, width);
        // The longest panel, so the row can stick: choosing Related from there scrolls to its top.
        await checkStickyTabs(tab, `srs /vocab/${LONG_SYNONYMS_WORD}`, width, 'Related');
        await tab.until(`document.body.innerText.includes('Used in')`, 'the Related tab');
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, related tab`, width);
        await checkSynonymsLink(tab, app, width);
        // The removed Mix-ups page's path lands on Vocabulary.
        await tab.goto(`${app}/vocab/mixups`, 'Vocabulary');
        await tab.until(`location.pathname.endsWith('/vocab')`, '/vocab/mixups redirecting to /vocab');
        for (const page of DICTIONARY_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${page.path}`, page.ready);
            await measure(tab, `dictionary ${page.path}`, width, DICTIONARY_TAP_TARGETS);
        }
        await measureFuriganaFixture(tab, `http://127.0.0.1:${dictionary.port}/dictionary/vocab/${FURIGANA_VOCAB}/`, 'Meanings', `dictionary /vocab/${FURIGANA_VOCAB}/`, width, DICTIONARY_TAP_TARGETS);
        await tab.close();
    }
} catch (error) {
    failures.push(`could not finish: ${error instanceof Error ? error.message : String(error)}`);
} finally {
    await chrome.kill();
    srs.server.close();
    updated.server.close();
    dictionary.server.close();
    rmSync(NEWER_DIR, { recursive: true, force: true });
}

if (failures.length) {
    for (const failure of failures) console.error(`[check-layout] ${failure}`);
    fail(`${failures.length} layout problem(s) in ${checked} pages. See docs/DESIGN_SYSTEM.md; fix the page, never the check.`);
}
console.log(`[check-layout] ${checked} pages at ${VIEWPORTS.map(v => `${v.width}px`).join(' and ')}: no sideways scroll, nothing under 12px, inputs 16px, tap targets 44px, sentence words not underlined or spaced apart (margin or padding), example sentences not ruled, a word page's tabs 44px, furigana over kanji, on one line and apart, Japanese in list rows unbroken, a kanji's readings each on one line, the update banner's controls 44px, setup's decisions above the kanji grid and a way back to them from its end, a word page's essentials on a small phone's first screen, play buttons at the first line of what they play, its tab row running to the screen's edge with a tab cut there when it scrolls (at either end and after choosing any tab), stuck once scrolled to and the open tab in its view, a tab chosen there (or the open one tapped again) opening at its top, Your study's phone grid on a studied word, its header status on one line at 1280px, Review now leaving the word page once in history, a #synonyms link opening the Synonyms tab, its rows' shared senses wrapped, not cut off, a sentence word's lookup sheet in the viewport with a 44px Close and 44px links.`);
