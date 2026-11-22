/**
 * The layout rules no static check can see (AGENTS.md, Design rules; docs/DESIGN_SYSTEM.md),
 * measured in a real browser on both production builds at phone widths (320 and 375px):
 *
 * - no page scrolls sideways;
 * - no text below the 12px floor (furigana, in `rt`, and SVG chart labels excepted);
 * - every text input is at least 16px, or iOS zooms into it on focus;
 * - the header search's grouped results (Words, Kanji, Grammar) in each app, with the panel open,
 *   hold the same rules, the dictionary's options 44px tall;
 * - the dictionary's nav links, pager links, toggles, tiles, disclosure summaries and single links
 *   in a row (a kanji's book position, a range step's glyph) are at least 44px tall;
 * - a kanji's course step (`.kanji-courses dd`) is 44px tall even when it is not a link;
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
 * - setup opened from a dictionary link with a count (`?order=kklc&known=103`, `henshall` behind
 *   "More methods") shows the linked count and order with the count stepper inside a 320x568 and
 *   a 375x667 screen;
 * - a kanji page's linked course steps are underlined at rest, not told apart by colour alone;
 * - furigana sits over kanji only, never over kana, no ruby (a run of kanji with its reading)
 *   breaks across lines, and no two readings on a line touch (word pages' example sentences, in each app);
 * - a `#synonyms` link followed inside the app opens a word page on its Synonyms tab;
 * - from 1024px a word page is one full page (issue 256): no tab row, every section in its column
 *   (and Your study once learned), 取る's page within FULL_PAGE_MAX_HEIGHT, a hash (loaded, or
 *   followed inside the app) landing on its section's heading just under the top, Dict's "Compare
 *   all N" pressed with Enter moving focus into Synonyms with the accent ring, no sideways scroll and nothing overflowing the side column
 *   (a studied word with mix-ups, 今回's hyphenated kun readings, at 1024px); at 768px it is
 *   still the tab page; crossing 1024px keeps the section in view as the open tab, and back;
 * - a dictionary word page (取る) as the app's (issue 168): at 320 and 375px a tablist of the app's
 *   sections (Dict, Sentences, Synonyms, Forms, Kanji, Related), 44px tabs, one section shown, a
 *   hash loaded opening its own at the page top with the tab row in view, no sideways scroll, its
 *   Synonyms search finding a synonym's meaning and never its closeness label, a Chinese page's
 *   source credits each measured in its own tab; at 1280px one full page, no tab row, every
 *   section, Kanji in the aside;
 * - the kanji (一, 学, 取) and grammar (a construction, an inflection) pages likewise (issue 169):
 *   at 1280px and 1024px one full page, no tab row, every section, their long lists capped
 *   (KANJI_PAGE, GRAMMAR_PAGE), a hash landing on its section; on a phone a tab row running to the
 *   screen's edge and sticking from their longest tab;
 * - a dictionary list page's first screen (375x812) ends within the rows its size budget counts
 *   (FIRST_SCREEN_ROWS, lib/budgets.ts: the JLPT lists, the kanji order pages, `/grammar/`);
 * - a word page's first screen, on a small phone (375x667 and 320x568), holds its headword,
 *   reading and its play button, summary gloss and status line;
 * - a word page's tab row sticks to the top once scrolled to, with no sideways page scroll at
 *   320px, the open tab inside the row's view, and a tab chosen while it is stuck brings its
 *   panel's top just under the row, as does tapping the open tab again;
 * - a word page's tab row too wide for a phone runs to the screen's edge on each side it has tabs
 *   past, with a tab cut by that edge, so the row shows it scrolls (no tab hidden at the padding),
 *   scrolled to either end and after choosing any tab;
 * - a new word's intro card (a fresh learner's first cards) shows its example sentence, its words
 *   out of the Tab order (a session card, checked on a sentence that links another word), and its
 *   Skip and Learn on the first screen at 320x720 and 375x812 (on a smaller phone, 568 and 667
 *   tall, a card with many senses may run past it, and the card opens at its top instead); its play
 *   buttons (the reading's, the sentence's) are 44px tap targets at the first line of what they play,
 *   never dimmed; its readings break only between readings; its sentence is centred on its
 *   translation;
 * - a long headword's intro card (乗り換える, at 320px, 375px and 1280px) draws the headword on one
 *   line, inside the card, scaled down rather than wrapped (issue 239);
 * - a due word's page has no Review now; a due grammar point's page says Due now once (its header);
 * - a sentence word hovered with a mouse at 1280px keeps its hover as its lookup card opens (the
 *   card, growing as its word arrives, never covers it);
 * - a sentence word tapped on a phone opens its lookup card as a bottom sheet that fits the
 *   viewport, with a 44px Close and 44px links (Open word page), and no sideways scroll;
 * - a word page's tabs are 44px tap targets on a phone;
 * - the dictionary's app panel action is one line, with a four-digit step, in English and Chinese;
 * - a Japanese word in the app panel's sentence is unbroken where it fits a line, and wraps
 *   inside the panel where it does not (学校, 蛇口, a long headword), in English and Chinese;
 * - the app panel stands 40px above what follows it (a word page, a kanji page);
 * - no word in an app sentence has side space (margin or padding): Japanese has no spaces;
 * - example sentences (a word page's Dict tab, a grammar page) are spaced apart, never ruled;
 * - on a contrast drill, every run of kana or kanji is set in a Japanese face (the first family of
 *   its stack), on a card, after a wrong pick and on the summary, and the summary card keeps the
 *   question card's edges (at 320px, 375px and 1280px);
 * - play buttons (a word's reading, a word page's and a grammar page's example sentences) are
 *   44px tap targets on a phone at the first line of what they play (the sentence, the reading, a
 *   kana word's note), and each of those pages has a "Play sentence" button; in the dictionary too
 *   (issue 255): a word's reading (and a kana word's note) and its sentences, a grammar point's
 *   examples, in its tabs on a phone and on the full page, 44px wherever they show;
 * - Settings' review pacing, with a studied word so its forecast shows: the first and last bar's
 *   tooltip stays inside the viewport with no sideways scroll, two arrow presses on the slider
 *   step it twice and keep its focus, and a plain `change` on it (as assistive tech sends) saves.
 *
 * Usage: build both apps (`bun run --cwd apps/gokan-srs build`, `bun run --cwd
 * apps/gokan-dictionary build`), then `bun run check:layout`. Needs Chrome or Chromium: found at
 * the usual paths, or named by CHROME_PATH. Run by CI (.github/workflows/ci-site.yml), on the builds its build job made.
 *
 * Chrome is driven over the DevTools protocol with Bun's own WebSocket: Playwright's transports
 * do not work under Bun on Windows, and this needs nothing installed.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KANJI_CHARS, kanjiOrder, type KanjiOrderId } from '@gokan/dataset-schema';
import { buildMissing, dictionaryListShapes, dictionaryPages, listeningTitlesToMark, serve, serveProduction, srsFile, srsRoutes, srsVersion } from './lib/builtSite';
import { launchChrome, type Chrome, type Tab } from './lib/chrome';
import { FIRST_SCREEN_ROWS, firstScreenBudgetOf } from '../apps/gokan-dictionary/src/lib/budgets';

const VIEWPORTS = [{ width: 320, height: 720 }, { width: 375, height: 812 }];
const DESKTOP = { width: 1280, height: 800 };

function fail(message: string): never {
    console.error(`[check-layout] ${message}`);
    process.exit(1);
}

const missing = buildMissing();
if (missing) fail(missing);

const srs = await serve(srsFile);
// The dictionary as production serves it: its static files, and its server behind them when it renders on request.
const dictionary = await serveProduction();
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
    // A kanji's course step holds a 44px band whether or not it is a link, so a book with no range
    // page (Essential Kanji) keeps the rhythm of the rows around it and its step their line.
    const lowSteps = [...document.querySelectorAll('.kanji-courses dd')].filter(el => visible(el) && el.getBoundingClientRect().height < 43.5);
    if (lowSteps.length) problems.push('kanji course step under 44px (linked or not, a step is one band): ' + lowSteps.slice(0, 3).map(el => describe(el) + ' ' + Math.round(el.getBoundingClientRect().height) + 'px').join(', '));
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
    // an ellipsis or wraps whole, never broken mid-word (しょうじょ / う). So is each reading of a
    // word's reading row (components/WordReading.tsx: アー / ル is no reading). Counted on its text's
    // line boxes, since a flex item's own box is one rectangle however many lines it holds.
    const splitInRow = [...document.querySelectorAll('[data-list-row] span[lang=ja], [data-word-reading] span[lang=ja]')].filter(visible).filter(el => {
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
    if (splitInRow.length) problems.push('Japanese in a list row or a word reading row breaks across lines (a reading is one unit): ' + splitInRow.slice(0, 3).map(describe).join(', '));
    return problems;
})()`;

const DICTIONARY_TAP_TARGETS = '.site-nav a, .pager a, .search-sections a, .detail-tabs a, summary, .kanji-tiles a, .range-list a, .kanji-courses a, .range-step h3 a, button.button, button.play';

const failures: string[] = [];
let checked = 0;
async function measure(tab: Tab, page: string, width: number, tapTargets = ''): Promise<void> {
    checked++;
    for (const problem of await tab.evaluate<string[]>(MEASURE(width, tapTargets))) failures.push(`${width}px ${page}: ${problem}`);
}

const DICTIONARY_PAGES = await dictionaryPages();
/** The list page shapes beyond DICTIONARY_PAGES, measured only for their first screen (checkListFirstScreen). */
const DICTIONARY_LIST_SHAPES = dictionaryListShapes();
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
    // Each word measured here has one (issue 176), and its graph widens the reading line.
    ['pitch accent', '[data-word-reading] [data-pitch-accent]'],
] as const;
/** Play buttons (components/PlayButton.tsx): a 44px tap target on a phone, measured by measure(). */
const PLAY_BUTTONS = '[data-play-button]';
// Its examples all have clips, as every grammar example a clip was made for does.
const GRAMMAR_POINT = 'n5-001';

/** A word learned in kana: its header's play button follows the kanji-spelling note, which wraps at 320px. */
const KANA_WORD = '1000225';
/**
 * 今回: 回's kun readings (まわ(る)、-まわ(る)、-まわ(り)) start with a hyphen, before which a line
 * may not break, so its Kanji readings ran past their column (the Kanji tab at 320px, the full
 * page's side column at 1024px) until each 、 was followed by a break opportunity.
 */
const HYPHEN_KUN_WORD = '1289070';
/**
 * Readings with their pitch accent, whose play button must stay on the reading's line (the fit
 * leaves the button room, and a further pattern wraps after it): 中華人民共和国, the longest reading
 * (14 kana, one pattern), 現在進行形 (10 kana, two patterns, which as one item ran past a 320px phone
 * and pushed the button under it) and 辛うじて (four patterns, wrapping onto two lines at 320px).
 */
const PITCH_WORDS = ['1423580', '2145250', '1365870'];
/** The words of PITCH_WORDS with more than one pattern: a play button between them, a pattern that wraps. */
const MULTI_PITCH_WORDS = PITCH_WORDS.slice(1);

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
 * Every visible run of kana or kanji is set in one of the app's Japanese faces (AGENTS.md: Japanese
 * text uses font-mincho or font-gothic): the first family of its computed stack is Noto Sans JP or
 * Noto Serif JP. A fallback further down does not count: font-sans is Inter first, so its kana come
 * from Noto Sans JP only by fallback, with Inter's metrics around them. A page title is Source Serif
 * 4, which has no CJK glyphs: Japanese in it rendered as missing-glyph boxes (PR 280).
 */
const JAPANESE_OUTSIDE_JAPANESE_FACES = `(() => {
    const japanese = /[\\u3040-\\u30ff\\u3400-\\u9fff]/;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const strays = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const el = node.parentElement;
        if (!el || !japanese.test(node.textContent) || el.closest('svg, script, style')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const family = getComputedStyle(el).fontFamily;
        const first = family.split(',')[0].trim().replace(/^["']|["']$/g, '');
        if (first !== 'Noto Sans JP' && first !== 'Noto Serif JP') strays.push(el.tagName.toLowerCase() + ' "' + node.textContent.trim().slice(0, 20) + '" in ' + family.split(',')[0]);
    }
    return strays;
})()`;

async function checkJapaneseFaces(tab: Tab, page: string, width: number): Promise<void> {
    const strays = await tab.evaluate<string[]>(JAPANESE_OUTSIDE_JAPANESE_FACES);
    for (const stray of strays.slice(0, 4)) {
        // Once per page: a drill measures every wrong pick, and the same note shows on several.
        const failure = `${width}px ${page}: Japanese text outside a Japanese face (font-gothic or font-mincho): ${stray}`;
        if (!failures.includes(failure)) failures.push(failure);
    }
}

/**
 * A contrast drill whose wrong picks show their contrast note (dataset English with Japanese in it:
 * reason-core, the route list's drill, has none, since its one case is a pair that may both fit).
 */
const DRILL_PATH = '/grammar/drill/lesson/time-window/during-window';
/**
 * The run's order, pinned (DrillScreen reads `?seed=`): the walk picks each card's first option, so
 * an order drawn from the clock could meet no wrong pick with a note. drillSelectors.test.ts holds
 * that this seed's drill has a card whose first option carries its contrast case.
 */
const DRILL_SEED = 'layout';
/** More cards than a drill holds (drillMaxCards), so a drill that never ends fails rather than hangs. */
const DRILL_CARD_LIMIT = 20;

/** The left and right edges of the card holding `selector` (the quiz card frame's, or the summary's). */
const cardEdges = (selector: string) => `(() => {
    const card = document.querySelector(${JSON.stringify(selector)})?.closest('.bg-surface');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(r.right) };
})()`;

/**
 * A contrast drill answered through to its summary, by picking each card's first option: every
 * Japanese run in a Japanese face after a wrong pick (the options' notes, the contrast note) and on
 * the summary, not only on the unanswered card; and the summary card on the question card's edges,
 * so the column keeps its width when the drill ends (docs/DESIGN_SYSTEM.md section 5, PR 280).
 */
async function checkDrillWalk(tab: Tab, app: string, width: number): Promise<void> {
    const page = `srs ${DRILL_PATH}`;
    await tab.goto(`${app}${DRILL_PATH}?seed=${DRILL_SEED}`, 'Card 1 of');
    const question = await tab.evaluate<{ left: number; right: number } | null>(cardEdges('[aria-label="Choices"]'));
    let wrongPicks = 0;
    let contrastNotes = 0;
    for (let card = 0; card < DRILL_CARD_LIMIT; card++) {
        if (await tab.evaluate<boolean>(`document.querySelector('[data-drill-summary]') !== null`)) break;
        await tab.evaluate<null>(`(document.querySelector('[aria-label="Choices"] button')?.click(), null)`);
        await tab.click('Submit');
        await tab.until(`[...document.querySelectorAll('button')].some(b => b.textContent.trim().startsWith('Continue'))`, `feedback on drill card ${card + 1}`);
        if (await tab.evaluate<boolean>(`document.querySelector('[aria-label="Choices"] .text-feedback-incorrect') !== null`)) {
            wrongPicks++;
            if (await tab.evaluate<boolean>(`document.body.innerText.includes('Which one, and when')`)) contrastNotes++;
            await checkJapaneseFaces(tab, `${page}, after a wrong pick`, width);
        }
        await tab.click('Continue');
        await tab.until(`document.querySelector('[data-drill-summary]') !== null || document.body.innerText.includes('Card ${card + 2} of')`, `drill card ${card + 2} or the summary`);
    }
    if (wrongPicks === 0) failures.push(`${width}px ${page}: no first option was a wrong pick, so the feedback after one went unmeasured`);
    else if (contrastNotes === 0) failures.push(`${width}px ${page}: no wrong pick showed its contrast note ("Which one, and when"), so the note went unmeasured`);
    const summary = await tab.evaluate<{ left: number; right: number } | null>(cardEdges('[data-drill-summary]'));
    if (!summary) {
        failures.push(`${width}px ${page}: no summary ([data-drill-summary]) after ${DRILL_CARD_LIMIT} cards`);
        return;
    }
    // measure() holds phone rules (the 16px input among them), which the desktop header's search field does not keep.
    if (width < DESKTOP.width) await measure(tab, `${page}, summary`, width);
    await checkJapaneseFaces(tab, `${page}, summary`, width);
    if (!question) failures.push(`${width}px ${page}: no question card to measure`);
    else if (Math.abs(question.left - summary.left) > 1 || Math.abs(question.right - summary.right) > 1) {
        failures.push(`${width}px ${page}: the summary card (x ${summary.left} to ${summary.right}) is not on the question card's edges (x ${question.left} to ${question.right})`);
    }
}

/** The chapter browser on a chapter whose related points have a drill ("Giving a reason"), expanded. */
const DRILL_CHAPTER_PATH = '/grammar/chapters?chapter=n5-c16';
/** docs/DESIGN_SYSTEM.md section 4: inside a group, 8 or 12px. */
const CHAPTER_DRILL_GAP = 8;

/**
 * The chapter browser's "Drill the related points" stands apart from the expanded chapter's header
 * (the toggle's shaded block) by the group's spacing: flush against it, in dark its border touches
 * the header's tint and reads as part of it (PR 280, rc.16).
 */
async function checkChapterDrillGap(tab: Tab, app: string, width: number): Promise<void> {
    const page = `srs ${DRILL_CHAPTER_PATH}`;
    await tab.goto(`${app}${DRILL_CHAPTER_PATH}`, 'Giving a reason');
    await tab.until(`document.querySelector('[data-chapter-drill] a') !== null`, 'the chapter\'s drill link', 10000);
    const gap = await tab.evaluate<number | null>(`(() => {
        const wrapper = document.querySelector('[data-chapter-drill]');
        const header = wrapper?.previousElementSibling;
        const link = wrapper?.querySelector('a');
        if (!header || !link) return null;
        return Math.round(link.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
    })()`);
    if (gap === null) failures.push(`${width}px ${page}: no chapter header before the drill link to measure`);
    else if (gap < CHAPTER_DRILL_GAP) failures.push(`${width}px ${page}: "Drill the related points" sits ${gap}px under the chapter's header (at least ${CHAPTER_DRILL_GAP}px)`);
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

/**
 * A kanji's readings in names (its Details, in the full page's narrow side column) stay whole as its
 * On and Kun do: each its own unbreakable reading (KanjiReadings' ReadingList), so てん never reads
 * て / ん. Checked on a kanji with names readings (一), where the column is narrowest.
 */
async function checkNameReadingsUnbroken(tab: Tab, page: string, width: number): Promise<void> {
    const result = await tab.evaluate<{ list: boolean; readings: number; whole: number; broken: string[] }>(`(() => {
        const list = [...document.querySelectorAll('dt')].find(el => el.textContent.trim() === 'Readings in names');
        const field = list ? list.parentElement : null;
        const spans = field ? [...field.querySelectorAll('[data-kanji-reading]')] : [];
        const text = field ? (field.querySelector('dd') ?? field).textContent : '';
        const broken = spans.filter(el => { const tops = [...el.getClientRects()].filter(r => r.width > 0).map(r => r.top); return tops.some(top => Math.abs(top - tops[0]) >= 2); });
        return { list: field !== null, readings: text.split('、').filter(Boolean).length, whole: spans.length, broken: broken.slice(0, 3).map(el => el.textContent.trim()) };
    })()`);
    if (!result.list) failures.push(`${width}px ${page}: no "Readings in names" shown to check`);
    else if (result.whole === 0 || result.whole !== result.readings) failures.push(`${width}px ${page}: the readings in names are not each a whole reading (${result.whole} of ${result.readings} in a [data-kanji-reading]), so a line may break inside one`);
    for (const text of result.broken) failures.push(`${width}px ${page}: a reading in names breaks across lines: ${text}`);
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
 * wrapped note's two lines, reads as a control of its own. A reading drawn with its pitch accent
 * is measured from its text (`data-pitch-reading`), not from the dots drawn above it.
 */
async function checkPlayButtonsOnFirstLine(tab: Tab, page: string, width: number, buttons = PLAY_BUTTONS): Promise<void> {
    const strays = await tab.evaluate<string[]>(`[...document.querySelectorAll(${JSON.stringify(buttons)})].filter(el => el.getBoundingClientRect().width > 0).flatMap(el => {
        // Inline after a line's text (the dictionary's reading), the line it ends is its parent.
        const before = el.previousElementSibling ?? (el.parentElement.firstChild !== el ? el.parentElement : null);
        if (!before) return [el.getAttribute('aria-label') + ': nothing before it to follow'];
        // A sentence's line is its own (leading-loose), not its wrapper's; a reading's with its
        // pitch accent starts at its text, under the dots.
        const pitchReading = before.querySelector('[data-pitch-reading]');
        const style = getComputedStyle(before.querySelector('[data-sentence]') ?? pitchReading ?? before);
        const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
        const button = el.getBoundingClientRect();
        const below = (button.top + button.bottom) / 2 - (pitchReading ?? before).getBoundingClientRect().top;
        return below < line * 0.75 ? [] : [el.getAttribute('aria-label') + ' centred ' + Math.round(below) + 'px below the top of what it plays (its first line is ' + Math.round(line) + 'px)'];
    })`);
    for (const stray of strays) failures.push(`${width}px ${page}: play button off the first line: ${stray}`);
}

/**
 * A word's pitch accent shows nothing between its patterns but the readings and the play button:
 * a later pattern that wraps would otherwise open its line with that mark (a 、 there breaks
 * Japanese line-breaking rules). Any visible text outside a reading and a button fails, on 現在進行形
 * (two patterns, the second wrapping at 320px) in both apps. Hidden screen-reader words are skipped.
 */
async function checkPitchAccentUnpunctuated(tab: Tab, page: string, width: number): Promise<void> {
    const strays = await tab.evaluate<string[]>(`[...document.querySelectorAll('[data-pitch-accent], .pa')].flatMap(root => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        const found = [];
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent.trim();
            if (!text || node.parentElement.closest('[data-pitch-reading], button, .sr-only, .visually-hidden')) continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            if ([...range.getClientRects()].some(r => r.width > 1 && r.height > 1)) found.push(text);
        }
        return found;
    })`);
    for (const stray of strays) failures.push(`${width}px ${page}: text between pitch accent patterns ("${stray}"), which can open a wrapped line`);
}

/**
 * A play button between two patterns reads as the first one's (it plays the reading it follows):
 * when the second pattern shares the button's line, it starts clearly further from the button's
 * centre (by 6px or more) than the first pattern's particle ring ends before it. Measured from the
 * centre, so the button's icon size cancels out. On the words with several patterns in both apps,
 * at every width it is checked at; the case with no button between them is held by the apps' unit
 * tests.
 */
async function checkPitchButtonFollowsFirst(tab: Tab, page: string, width: number): Promise<void> {
    const result = await tab.evaluate<{ found: boolean; strays: string[] }>(`(() => {
        const roots = [...document.querySelectorAll('[data-pitch-accent], .pa')].filter(root => root.querySelectorAll('svg').length > 1 && root.querySelector('button'));
        const strays = roots.flatMap(root => {
            const svgs = [...root.querySelectorAll('svg')].filter(svg => svg.closest('button') === null);
            const ring = svgs[0].querySelector('circle').getBoundingClientRect();
            const box = root.querySelector('button').getBoundingClientRect();
            const centre = (box.left + box.right) / 2;
            const next = svgs[1].getBoundingClientRect();
            // Wrapped onto a line of its own: nothing beside the button to be mistaken for.
            if (next.left < centre) return [];
            const before = Math.round(centre - ring.right);
            const after = Math.round(next.left - centre);
            return after - before >= 6 ? [] : ['the button is ' + before + 'px from the first pattern and ' + after + 'px from the second (6px more after it, at least)'];
        });
        return { found: roots.length > 0, strays };
    })()`);
    if (!result.found) failures.push(`${width}px ${page}: no pitch accent with two patterns and a play button to check`);
    for (const stray of result.strays) failures.push(`${width}px ${page}: the play button reads as the second pitch pattern's: ${stray}`);
}

/**
 * A pattern that opens a line below the first starts flush with it, under the reading's left
 * edge: the space before a later pattern is the row's gap, which a wrap drops, never a margin,
 * which a wrap keeps (an 8px indent per wrapped line, on PR 267's rc.6). Graphs inside a play
 * button are skipped. A wrap is told from where a pattern starts, never from its height: the row
 * aligns its patterns' bottoms, so a smaller later pattern on the first's line starts lower, its
 * graph's top within 2px of the first graph's bottom (PR 267's rc.7). At 320px a word
 * with several patterns must wrap, so the check cannot pass by measuring nothing.
 */
async function checkPitchPatternsFlush(tab: Tab, page: string, width: number): Promise<void> {
    const result = await tab.evaluate<{ wrapped: number; strays: string[] }>(`(() => {
        let wrapped = 0;
        const strays = [...document.querySelectorAll('[data-pitch-accent], .pa')].flatMap(root => {
            // Each pattern's box (the graph's parent, the reading's text with the particle's room),
            // not its graph: the graph is laid out at 1em a kana, so it overhangs a narrower font.
            const svgs = [...root.querySelectorAll('svg')].filter(svg => svg.closest('button') === null).map(svg => (svg.parentElement ?? svg).getBoundingClientRect());
            const first = svgs[0];
            if (!first || first.width === 0) return [];
            return svgs.slice(1).flatMap((svg, i) => {
                // Only the pattern that opens a line: one that follows on a line starts past the
                // previous box's right edge (the row's gap after it), one that wraps starts left of it.
                if (svg.left >= svgs[i].right) return [];
                wrapped++;
                const off = Math.round(svg.left - first.left);
                return Math.abs(svg.left - first.left) <= 1 ? [] : ['pattern ' + (i + 2) + ' starts ' + off + 'px from the first'];
            });
        });
        return { wrapped, strays };
    })()`);
    if (width === 320 && result.wrapped === 0) failures.push(`${width}px ${page}: no pitch pattern wrapped onto a line of its own to check`);
    for (const stray of result.strays) failures.push(`${width}px ${page}: a wrapped pitch pattern is not flush with the first: ${stray}`);
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
 * A dictionary list page is held to its size budget up to the end of its first screen at 375x812
 * (FIRST_SCREEN_ROWS in lib/budgets.ts, counted by check-build): its first N rows inside `<main>`
 * must reach that screen's end, or the budget counts less than a reader sees first. A page with
 * fewer rows is counted whole.
 */
const LIST_FIRST_SCREEN = { width: 375, height: 812 };
async function checkListFirstScreen(tab: Tab, page: string, path: string, width: number): Promise<void> {
    const budget = firstScreenBudgetOf(path);
    if (budget === null || width !== LIST_FIRST_SCREEN.width) return;
    const rows = FIRST_SCREEN_ROWS[budget];
    await tab.resize(LIST_FIRST_SCREEN.width, LIST_FIRST_SCREEN.height);
    const bottom = await tab.evaluate<number | null>(`(() => {
        window.scrollTo(0, 0);
        const rows = document.querySelectorAll('main li');
        return rows.length < ${rows} ? null : rows[${rows - 1}].getBoundingClientRect().bottom;
    })()`);
    if (bottom !== null && bottom < LIST_FIRST_SCREEN.height) failures.push(`${LIST_FIRST_SCREEN.width}x${LIST_FIRST_SCREEN.height} ${page}: its first ${rows} rows (FIRST_SCREEN_ROWS.${budget}) end ${Math.round(bottom)}px down, above the first screen's end (${LIST_FIRST_SCREEN.height}px): raise the count, so its budget covers the first screen`);
    await tab.resize(width, VIEWPORTS.find(viewport => viewport.width === width)?.height ?? LIST_FIRST_SCREEN.height);
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

/** Where a studied item's due date is stored, as compact and readable keys (progressCompaction's KEY_CODES). */
interface DueTarget {
    queue: readonly [string, string];
    id: readonly [string, string];
    direction: readonly [string, string];
}
const WORD_READING: DueTarget = { queue: ['q', 'learningQueue'], id: ['i', 'vocabId'], direction: ['r', 'reading'] };
const GRAMMAR_ENTRY: DueTarget = { queue: ['gq', 'grammarQueue'], id: ['gi', 'grammarId'], direction: ['e', 'entry'] };

/**
 * Makes a studied item due an hour ago (a word's reading, a grammar point's entry: its due date,
 * cached next review and introduction, readable or compact), so its page says Due now. Read on the
 * next page load.
 */
const makeDue = (target: DueTarget, id: string) => `(async () => {
    const key = 'GOKAN_SRS_PROGRESS';
    const done = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const db = await done(indexedDB.open('gokan-srs'));
    const progress = JSON.parse(await done(db.transaction('progress').objectStore('progress').get(key)));
    const queue = progress[${JSON.stringify(target.queue[0])}] ?? progress[${JSON.stringify(target.queue[1])}];
    const item = queue.find(entry => (entry[${JSON.stringify(target.id[0])}] ?? entry[${JSON.stringify(target.id[1])}]) === ${JSON.stringify(id)});
    const hourAgo = Date.now() - 3600000;
    const asStored = value => typeof value === 'number' ? hourAgo : new Date(hourAgo).toISOString();
    for (const [at, next, direction, due] of [['ia', 'na', ${JSON.stringify(target.direction[0])}, 'dd'], ['introductionAt', 'nextReviewAt', ${JSON.stringify(target.direction[1])}, 'dueDate']]) {
        if (item[at] !== undefined) item[at] = asStored(item[at]);
        if (item[next] !== undefined && item[next] !== null) item[next] = asStored(item[next]);
        if (item[direction]?.[due] !== undefined) item[direction][due] = asStored(item[direction][due]);
    }
    await done(db.transaction('progress', 'readwrite').objectStore('progress').put(JSON.stringify(progress), key));
    db.close();
})()`;
const DUE_SHOWN = `document.querySelector('[data-word-status]')?.textContent.includes('Due now') === true`;
const REVIEW_NOW_SHOWN = `[...document.querySelectorAll('button, a')].some(el => el.textContent.trim() === 'Review now')`;

/**
 * A due word's page has no Review now: its status says it is due, and the learner reviews it in
 * their next session (the button was dropped in 1.46.0 as not useful). Run on a word just learned,
 * its reading made due. The record is edited after a fresh load, once the app has settled: a save
 * still queued from the page before would write over it.
 */
async function checkNoReviewNow(tab: Tab, app: string, width: number, vocabId: string): Promise<void> {
    const page = `srs /vocab/${vocabId}, due`;
    await tab.goto(`${app}/vocab`, 'Vocabulary');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await tab.evaluate<void>(makeDue(WORD_READING, vocabId));
    await tab.goto(`${app}/vocab/${vocabId}`, 'Dict');
    try {
        await tab.until(DUE_SHOWN, "the word's status saying Due now", 10000);
    } catch {
        failures.push(`${width}px ${page}: the status line does not say Due now with its reading made due`);
        return;
    }
    if (await tab.evaluate<boolean>(REVIEW_NOW_SHOWN)) failures.push(`${width}px ${page}: the page shows Review now`);
}

const DUE_NOW_COUNT = `(document.body.innerText.match(/Due now/g) ?? []).length`;

/**
 * A due grammar point's page says Due now once, in its header's status line: its Your study (the
 * compact one, shared with a word's) says the stage of a due direction instead (DESIGN_SYSTEM
 * section 5). Learned here through "Learn this grammar point", then made due; on a phone its Study
 * tab is opened, on the full page Study is in the side column. Run last on a viewport's tab: the
 * point stays studied.
 */
async function checkGrammarDueOnce(tab: Tab, app: string, width: number): Promise<void> {
    const page = `srs /grammar/${GRAMMAR_POINT}, due`;
    await tab.goto(`${app}/grammar/${GRAMMAR_POINT}`, 'Formation');
    if (await tab.evaluate<boolean>(`[...document.querySelectorAll('button')].some(el => el.textContent.trim() === 'Learn this grammar point')`)) {
        await tab.click('Learn this grammar point');
        try {
            await tab.until(`!document.body.innerText.includes('Not in your study yet')`, 'the grammar point in study', 5000);
        } catch {
            failures.push(`${width}px ${page}: "Learn this grammar point" did not put the point in study`);
            return;
        }
    }
    await tab.goto(`${app}/vocab`, 'Vocabulary');
    await new Promise(resolve => setTimeout(resolve, 1000));
    await tab.evaluate<void>(makeDue(GRAMMAR_ENTRY, GRAMMAR_POINT));
    await tab.goto(`${app}/grammar/${GRAMMAR_POINT}`, 'Formation');
    if (width < FULL_PAGE_WIDTH && !(await openWordTab(tab, page, width, 'Study'))) return;
    try {
        await tab.until(`[...document.querySelectorAll('h2, h3')].some(el => el.textContent.trim() === 'Your study') && document.body.innerText.includes('Due now')`, 'Your study on a due grammar point', 10000);
    } catch {
        failures.push(`${width}px ${page}: no Your study saying the point is due, with the point made due`);
        return;
    }
    const said = await tab.evaluate<number>(DUE_NOW_COUNT);
    if (said !== 1) failures.push(`${width}px ${page}: the page says "Due now" ${said} times; the header's status line is the only place that says it (Your study says the stage)`);
}

const PACING_SLIDER = `[...document.querySelectorAll('input[type=range]')].find(el => (el.getAttribute('aria-valuetext') ?? '').startsWith('Intervals'))`;
/** The pacing setting as stored on this device: its value and history (`StorageService.saveSettings`). */
const STORED_PACING = `(() => { const s = JSON.parse(localStorage.getItem('GOKAN_SRS_SETTINGS') ?? '{}'); return { value: s.intervalModifier ?? null, history: s.intervalModifierHistory ?? [] }; })()`;
const PACING_BARS = `[...document.querySelectorAll('[data-pacing-forecast] button[aria-label]')]`;
/**
 * Focuses bar `which` of the pacing chart and reports where its tooltip lands, or why it cannot.
 * Measured against the device width, as MEASURE does: a phone viewport zooms out to fit a page
 * that overflows, so `innerWidth` grows with the overflow it would report.
 */
const PACING_TOOLTIP = (which: 'first' | 'last', deviceWidth: number) => `(async () => {
    const bars = ${PACING_BARS};
    const bar = bars[${which === 'first' ? '0' : 'bars.length - 1'}];
    if (!bar) return 'no bars in the pacing chart';
    bar.focus();
    await new Promise(resolve => setTimeout(resolve, 300));
    const tip = bar.querySelector('[role="tooltip"]');
    if (!tip) return 'no tooltip on focus';
    const r = tip.getBoundingClientRect();
    const problems = [];
    if (r.left < 0 || r.right > ${deviceWidth}) problems.push('tooltip spans ' + Math.round(r.left) + '-' + Math.round(r.right) + 'px in a ${deviceWidth}px viewport');
    if (document.documentElement.scrollWidth > ${deviceWidth}) problems.push('the page scrolls sideways by ' + (document.documentElement.scrollWidth - ${deviceWidth}) + 'px');
    bar.blur();
    return problems.join('; ');
})()`;

/**
 * Settings' review pacing, on a learner with a studied word (so the forecast and its chart show):
 * the 30 thin bars' end tooltips stay on screen, the keyboard steps the slider more than once (a
 * commit must not remount it and drop its focus), and a value set with no pointer or key (a
 * screen reader's adjust action sends only input and change) is saved.
 */
async function checkReviewPacing(tab: Tab, app: string, width: number): Promise<void> {
    const page = 'srs /settings, review pacing';
    await tab.goto(`${app}/settings`, 'Review pacing');
    try {
        await tab.until(`document.querySelector('[data-pacing-forecast]') !== null`, 'the pacing forecast', 10000);
    } catch {
        failures.push(`${width}px ${page}: no forecast chart with a studied word`);
        return;
    }
    for (const which of ['first', 'last'] as const) {
        const problem = await tab.evaluate<string>(PACING_TOOLTIP(which, width));
        if (problem) failures.push(`${width}px ${page}: the ${which} bar's tooltip: ${problem}`);
    }
    // Stepped toward the middle, so five steps never reach an end of the range.
    const before = await tab.evaluate<number>(`Number(${PACING_SLIDER}.value)`);
    const key = before > 2.5 ? 'ArrowLeft' : 'ArrowRight';
    const step = key === 'ArrowLeft' ? -0.1 : 0.1;
    const since = await tab.evaluate<string>(`new Date().toISOString()`);
    await tab.evaluate<void>(`${PACING_SLIDER}.focus()`);
    await tab.press(key);
    await tab.press(key);
    const after = await tab.evaluate<{ value: number; focused: boolean }>(`(() => { const el = ${PACING_SLIDER}; return { value: Number(el.value), focused: document.activeElement === el }; })()`);
    const expected = Number((before + 2 * step).toFixed(1));
    if (after.value !== expected) failures.push(`${width}px ${page}: two ${key} presses from ${before} gave ${after.value}, not ${expected}`);
    if (!after.focused) failures.push(`${width}px ${page}: the slider loses focus after an arrow press`);
    // Five steps in a row, each 300ms after the last: one burst, so one history entry.
    for (let i = 0; i < 3; i++) await tab.press(key);
    const burst = Number((before + 5 * step).toFixed(1));
    await new Promise(resolve => setTimeout(resolve, 1500));
    const entries = await tab.evaluate<number>(`${STORED_PACING}.history.filter(change => change.from >= '${since}').length`);
    if (entries !== 1) failures.push(`${width}px ${page}: five key steps in a row wrote ${entries} pacing history entries, not one`);
    await tab.goto(`${app}/settings`, 'Review pacing');
    const reloaded = await tab.evaluate<number>(`Number(${PACING_SLIDER}.value)`);
    if (reloaded !== burst) failures.push(`${width}px ${page}: after five key steps to ${burst} and a reload, the slider reads ${reloaded}`);
    // One more step, then straight away Tab: the pending commit is flushed on blur, not lost.
    await tab.evaluate<void>(`${PACING_SLIDER}.focus()`);
    await tab.press(key, 0);
    await tab.press('Tab', 0);
    const tabbed = Number((burst + step).toFixed(1));
    const stored = await tab.evaluate<number | null>(`${STORED_PACING}.value`);
    if (stored !== tabbed) failures.push(`${width}px ${page}: a key step then Tab away saved ${stored}, not ${tabbed}`);
    // One more step, then straight away a reload: no blur and no React cleanup run, so the
    // pending commit is saved on the page going away (pagehide), or not at all.
    await tab.evaluate<void>(`${PACING_SLIDER}.focus()`);
    await tab.press(key, 0);
    const left = Number((tabbed + step).toFixed(1));
    await tab.goto(`${app}/settings`, 'Review pacing');
    const afterLeaving = await tab.evaluate<{ slider: number; stored: number | null }>(`({ slider: Number(${PACING_SLIDER}.value), stored: ${STORED_PACING}.value })`);
    if (afterLeaving.slider !== left || afterLeaving.stored !== left) failures.push(`${width}px ${page}: a key step to ${left} then straight away a reload reads ${afterLeaving.slider} (stored ${afterLeaving.stored})`);
    // React reads its own value tracker: the native setter, then input and change, as assistive tech sends them.
    const target = left === 3 ? 2.5 : 3;
    await tab.evaluate<void>(`(() => {
        const el = ${PACING_SLIDER};
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '${target}');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    await tab.goto(`${app}/settings`, 'Review pacing');
    const saved = await tab.evaluate<number>(`Number(${PACING_SLIDER}.value)`);
    if (saved !== target) failures.push(`${width}px ${page}: a value set by a plain change event (${target}) was not saved (reads ${saved} after a reload)`);
}

/**
 * A fresh learner's first cards, new words' intros (issue #184): each one's example sentence, when
 * it has one, wraps (measured: no sideways scroll), and Skip and Learn sit on the first screen at
 * the `VIEWPORTS` sizes (320x720 and 375x812), under the sentence. On a smaller phone
 * (`FIRST_SCREEN`, 568 and 667 tall) a card with many senses may run past the first screen; there
 * `checkIntroOpensAtTop` holds the card at its top instead. Its words stay out of the Tab
 * order, as on every session card (DESIGN_SYSTEM section 6, Lookup card). Its play buttons (the
 * reading's on every card, the sentence's when it has a clip; issue 196) are 44px tap targets at the
 * first line of what they play, at full opacity; its readings break only between readings; and its
 * sentence is centred on its translation's axis, within 2px, its play button within 16px of its end
 * (`INTRO_BUTTON_GAP`). The first word's sentence
 * may link no other word, so the cards are skipped through until one does, or that part of the check
 * would hold whatever the card does.
 */
const INTRO_CARD = `(() => {
    const bottoms = ['Skip', 'Learn'].map(label => [...document.querySelectorAll('form button')].find(el => el.textContent.trim() === label)?.getBoundingClientRect().bottom ?? null);
    const shown = document.querySelector('[data-example-sentence]');
    const card = document.querySelector('form')?.parentElement ?? null;
    return {
        bottoms,
        sentence: shown?.textContent ?? null,
        linked: shown?.querySelectorAll('[data-lookup-trigger]').length ?? 0,
        tabbable: shown?.querySelectorAll('[tabindex="0"]').length ?? 0,
        readingPlay: document.querySelector('[data-word-reading] [data-play-button]') !== null,
        card: card?.textContent ?? '',
        dimmed: [...document.querySelectorAll('[data-play-button]')].flatMap(el => {
            for (let at = el; at && card && card.contains(at); at = at.parentElement) {
                const opacity = parseFloat(getComputedStyle(at).opacity);
                if (opacity < 1) return [el.getAttribute('aria-label') + ' at opacity ' + opacity + ' (on ' + at.tagName.toLowerCase() + '.' + String(at.className).trim().split(/\\s+/).slice(0, 4).join('.') + ')'];
            }
            return [];
        }),
        sentenceOffset: (() => {
            const text = shown?.querySelector('[data-sentence]');
            const english = [...(shown?.querySelectorAll('p') ?? [])].at(-1);
            if (!text || !english) return null;
            const centre = el => { const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect(); return (r.left + r.right) / 2; };
            return centre(text) - centre(english);
        })(),
        // At 1280px (checkIntroDesktop): the sentence on the headword's axis, its button right after it.
        headwordOffset: (() => {
            const text = shown?.querySelector('[data-sentence]');
            const headword = document.querySelector('[data-intro-headword]');
            if (!text || !headword) return null;
            const centre = el => { const range = document.createRange(); range.selectNodeContents(el); const r = range.getBoundingClientRect(); return (r.left + r.right) / 2; };
            return centre(text) - centre(headword);
        })(),
        buttonGap: (() => {
            const text = shown?.querySelector('[data-sentence]');
            const button = shown?.querySelector('[data-play-button]');
            if (!text || !button) return null;
            const range = document.createRange();
            range.selectNodeContents(text);
            return button.getBoundingClientRect().left - range.getBoundingClientRect().right;
        })(),
    };
})()`;

interface IntroCardMeasure { bottoms: (number | null)[]; sentence: string | null; linked: number; tabbable: number; readingPlay: boolean; card: string; dimmed: string[]; sentenceOffset: number | null; headwordOffset: number | null; buttonGap: number | null }

/** How far the sentence's play button may start after the sentence's text, at every width. */
const INTRO_BUTTON_GAP = 16;
/** How many intro cards to skip through looking for a sentence that links another word. */
const INTRO_CARDS = 8;
/** How many intro cards are measured at least: the first six hold reading lists that wrap at 320px (二, 六). */
const INTRO_CARDS_MEASURED = 6;

async function checkIntroCard(tab: Tab, app: string, width: number, height: number): Promise<void> {
    await tab.goto(`${app}/quiz`, 'Skip');
    let sawSentence = false;
    let sawLinked = false;
    // Cards whose sentence had a play button to measure, so the gap check cannot pass on none.
    let gapsMeasured = 0;
    for (let n = 1; n <= INTRO_CARDS; n++) {
        const page = `srs /quiz, a new word's intro (card ${n})`;
        await measure(tab, page, width, PLAY_BUTTONS);
        await checkPlayButtonsOnFirstLine(tab, page, width);
        const card = await tab.evaluate<IntroCardMeasure>(INTRO_CARD);
        // Every word in the dataset has a clip, so its reading plays on its intro (issue 196).
        if (!card.readingPlay) failures.push(`${width}px ${page}: no play button on the word's reading ([data-word-reading] [data-play-button])`);
        // A play button is an action at full strength, as everywhere else: never inside a dimmed reading.
        for (const dimmed of card.dimmed) failures.push(`${width}px ${page}: play button dimmed: ${dimmed}`);
        // The sentence sits centred over its translation, the two in one column beside its play button.
        if (card.sentenceOffset !== null && Math.abs(card.sentenceOffset) > 2) failures.push(`${width}px ${page}: the sentence's centre is ${Math.round(card.sentenceOffset)}px off its translation's (${card.sentence}): keep the two on one axis (WordSentence centred)`);
        // Its play button right after it, as the reading's, never pinned to the card's edge (rc.3 review).
        if (card.buttonGap !== null) gapsMeasured++;
        if (card.buttonGap !== null && card.buttonGap > INTRO_BUTTON_GAP) failures.push(`${width}px ${page}: the sentence's play button starts ${Math.round(card.buttonGap)}px after the sentence (${card.sentence}), more than ${INTRO_BUTTON_GAP}px: the row is as wide as the sentence (SentenceWithPlay centred)`);
        if (card.sentence !== null) sawSentence = true;
        if (card.linked > 0) sawLinked = true;
        if (card.tabbable > 0) failures.push(`${width}px ${page}: ${card.tabbable} sentence word(s) in the Tab order (${card.sentence}): a session card keeps them out (keyboardLinks off)`);
        for (const [i, label] of ['Skip', 'Learn'].entries()) {
            const bottom = card.bottoms[i];
            if (bottom === null || bottom === undefined) failures.push(`${width}px ${page}: no ${label} button`);
            else if (bottom > height) failures.push(`${width}px ${page}: ${label} ends ${Math.round(bottom)}px down, below the first screen (${height}px)`);
        }
        if ((sawLinked && n >= INTRO_CARDS_MEASURED) || n === INTRO_CARDS) break;
        await tab.click('Skip');
        await tab.until(`(document.querySelector('form')?.parentElement?.textContent ?? '') !== ${JSON.stringify(card.card)} && document.body.innerText.includes('Skip')`, `the intro card after card ${n}`, 10000);
    }
    const page = 'srs /quiz, new words\' intros';
    if (!sawSentence) failures.push(`${width}px ${page}: no example sentence on the first ${INTRO_CARDS} cards: pick a learning order whose first words have one`);
    else if (!sawLinked) failures.push(`${width}px ${page}: no sentence on the first ${INTRO_CARDS} cards links another word, so its Tab order goes unchecked: pick a learning order whose first words have one`);
    if (gapsMeasured === 0) failures.push(`${width}px ${page}: no sentence with a play button on the first ${INTRO_CARDS} cards to measure`);
}

/**
 * A new word's intro at 1280px (issue 196, rc.2 review): where the line can spare a spacer as wide
 * as the play button, the sentence sits on the headword's axis (within 2px) with its button right
 * after it (within 16px), as the reading's does, never at the card's far edge. On a phone the
 * sentence keeps the spacer's width for its words and is held to its translation's axis instead
 * (checkIntroCard). Measured on the first cards with a sentence that plays.
 */
async function checkIntroDesktop(tab: Tab, app: string): Promise<void> {
    const width = DESKTOP.width;
    // The desktop labels: "Skip" is "I already know this" from md up.
    const skip = 'I already know this';
    await tab.goto(`${app}/quiz`, skip);
    let measured = 0;
    for (let n = 1; n <= INTRO_CARDS_MEASURED; n++) {
        const page = `srs /quiz, a new word's intro (card ${n})`;
        // 32px buttons from md up, by design: no 44px tap targets to hold here.
        await measure(tab, page, width);
        await checkPlayButtonsOnFirstLine(tab, page, width);
        const card = await tab.evaluate<IntroCardMeasure>(INTRO_CARD);
        for (const dimmed of card.dimmed) failures.push(`${width}px ${page}: play button dimmed: ${dimmed}`);
        if (card.sentenceOffset !== null && Math.abs(card.sentenceOffset) > 2) failures.push(`${width}px ${page}: the sentence's centre is ${Math.round(card.sentenceOffset)}px off its translation's (${card.sentence})`);
        if (card.buttonGap !== null) {
            measured++;
            if (card.headwordOffset !== null && Math.abs(card.headwordOffset) > 2) failures.push(`${width}px ${page}: the sentence's centre is ${Math.round(card.headwordOffset)}px off the headword's (${card.sentence}): from md up a spacer balances its play button (SentenceWithPlay centred)`);
            if (card.buttonGap > INTRO_BUTTON_GAP) failures.push(`${width}px ${page}: the sentence's play button starts ${Math.round(card.buttonGap)}px after the sentence (${card.sentence}), more than ${INTRO_BUTTON_GAP}px: the row is as wide as the sentence`);
        }
        if (n === INTRO_CARDS_MEASURED) break;
        await tab.click(skip);
        await tab.until(`(document.querySelector('form')?.parentElement?.textContent ?? '') !== ${JSON.stringify(card.card)} && document.body.innerText.includes(${JSON.stringify(skip)})`, `the intro card after card ${n}`, 10000);
    }
    if (measured === 0) failures.push(`${width}px srs /quiz, new words' intros: no sentence with a play button on the first ${INTRO_CARDS_MEASURED} cards to measure`);
}

/** How many intro cards a Frequency learner skips through looking for a word learned in kana. */
const KANA_INTRO_CARDS = 12;

/**
 * A word learned in kana on its intro card (issue 196): its play button follows its kanji
 * spelling note (WordReading), at that line's first line, undimmed, and the spelling unbroken
 * (為 / る is no spelling; MEASURE's word readings). Skip and Learn are not held to the first
 * screen here: the first such word, する, has some twenty senses, which no reading line could
 * make up for. The default order (kanji coverage) never offers one, so a fresh learner in its
 * own storage picks Frequency, whose first words include them, and skips to the first.
 */
async function checkKanaIntro(chrome: Chrome, app: string, width: number, height: number): Promise<void> {
    const tab = await chrome.openTab(width, height);
    const desktop = width >= DESKTOP.width;
    const skip = desktop ? 'I already know this' : 'Skip';
    await tab.goto(`${app}/`, 'I already know some kanji');
    await tab.click('I already know some kanji');
    await tab.until(`document.body.innerText.includes('Kanji learning method')`, 'the setup screen');
    // The vocabulary order's Frequency, not the kanji method's of the same name.
    await tab.click('FrequencyMost common words');
    await tab.click('Start learning');
    await tab.goto(`${app}/quiz`, skip);
    const page = `srs /quiz, a word learned in kana's intro`;
    for (let n = 1; n <= KANA_INTRO_CARDS; n++) {
        const kana = await tab.evaluate<boolean>(`(document.querySelector('[data-word-reading]')?.textContent ?? '').includes('Usually written in kana')`);
        const card = await tab.evaluate<IntroCardMeasure>(INTRO_CARD);
        if (kana) {
            await measure(tab, `${page} (card ${n})`, width, desktop ? '' : PLAY_BUTTONS);
            await checkPlayButtonsOnFirstLine(tab, `${page} (card ${n})`, width);
            if (!card.readingPlay) failures.push(`${width}px ${page} (card ${n}): no play button on its kanji spelling line`);
            for (const dimmed of card.dimmed) failures.push(`${width}px ${page} (card ${n}): play button dimmed: ${dimmed}`);
            await tab.close();
            return;
        }
        await tab.click(skip);
        await tab.until(`(document.querySelector('form')?.parentElement?.textContent ?? '') !== ${JSON.stringify(card.card)} && document.body.innerText.includes(${JSON.stringify(skip)})`, `the intro card after card ${n}`, 10000);
    }
    failures.push(`${width}px ${page}: no word learned in kana in a Frequency learner's first ${KANA_INTRO_CARDS} cards`);
    await tab.close();
}

/** 乗り換える: five characters, kanji and kana runs alternating, the headword issue 239 was seen on. */
const LONG_HEADWORD_VOCAB = '1600470';

/**
 * Puts a word learned from its page back before its introduction (the stored record, readable or
 * compact), so /quiz opens on its intro card: the one way to an intro for a chosen word, since a
 * session's own new words come in learning order. Waits for the word's record to be stored.
 */
const awaitIntroOf = (vocabId: string) => `(async () => {
    const key = 'GOKAN_SRS_PROGRESS';
    const done = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    for (let attempt = 0; attempt < 50; attempt++) {
        const db = await done(indexedDB.open('gokan-srs'));
        const stored = await done(db.transaction('progress').objectStore('progress').get(key));
        const progress = stored ? JSON.parse(stored) : null;
        const item = (progress?.q ?? progress?.learningQueue ?? []).find(entry => (entry.i ?? entry.vocabId) === ${JSON.stringify(vocabId)});
        if (item) {
            delete item.ia;
            delete item.introductionAt;
            await done(db.transaction('progress', 'readwrite').objectStore('progress').put(JSON.stringify(progress), key));
            db.close();
            return true;
        }
        db.close();
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
})()`;

/** The intro's headword: its text, its size, the top of each of its characters, and how far they run past its box. */
const DISPLAY_HEADWORD = `(() => {
    const box = document.querySelector('[data-intro-headword]');
    if (!box) return null;
    const tops = [];
    let left = Infinity, right = -Infinity, fontSize = 0;
    const walker = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        fontSize = parseFloat(getComputedStyle(node.parentElement).fontSize);
        for (let i = 0; i < node.length; i++) {
            const range = document.createRange();
            range.setStart(node, i);
            range.setEnd(node, i + 1);
            const rect = range.getBoundingClientRect();
            tops.push(Math.round(rect.top));
            left = Math.min(left, rect.left);
            right = Math.max(right, rect.right);
        }
    }
    const frame = box.getBoundingClientRect();
    return { text: box.textContent, fontSize, tops, overflow: Math.max(frame.left - left, right - frame.right) };
})()`;

interface DisplayHeadwordMeasure { text: string; fontSize: number; tops: number[]; overflow: number }

/**
 * A long headword on its intro card (issue 239: 乗り換える stacked its trailing kana one per
 * line, over the card's edge): every character on one line, inside the card, the page not
 * scrolling sideways, and still a display size (well over the reading's). A learner in their
 * own storage learns the word from its page, and the record is put back before its introduction.
 */
async function checkLongHeadwordIntro(chrome: Chrome, app: string, width: number, height: number): Promise<void> {
    const tab = await chrome.openTab(width, height);
    const page = `srs /quiz, a long headword's intro (${LONG_HEADWORD_VOCAB})`;
    try {
        await tab.goto(`${app}/`, 'I already know some kanji');
        await tab.click('I already know some kanji');
        await tab.until(`document.body.innerText.includes('Kanji learning method')`, 'the setup screen');
        await tab.click('Start learning');
        await tab.goto(`${app}/vocab/${LONG_HEADWORD_VOCAB}`, 'Learn this word');
        await tab.click('Learn this word');
        if (!(await tab.evaluate<boolean>(awaitIntroOf(LONG_HEADWORD_VOCAB)))) {
            failures.push(`${width}px ${page}: the word was not stored after "Learn this word", so its intro is not measured`);
            return;
        }
        await tab.goto(`${app}/quiz`, width >= DESKTOP.width ? 'I already know this' : 'Skip');
        await tab.until(`document.querySelector('[data-intro-headword]') !== null`, 'the intro headword', 10000);
        await measure(tab, page, width);
        const shown = await tab.evaluate<DisplayHeadwordMeasure | null>(DISPLAY_HEADWORD);
        if (!shown) {
            failures.push(`${width}px ${page}: no headword ([data-intro-headword])`);
            return;
        }
        const lines = new Set(shown.tops).size;
        if ([...shown.text].length < 5) failures.push(`${width}px ${page}: the card shows ${shown.text}, not a headword of five characters or more: pick another word (LONG_HEADWORD_VOCAB)`);
        if (lines !== 1) failures.push(`${width}px ${page}: ${shown.text} is drawn on ${lines} lines (character tops ${shown.tops.join(', ')}): a headword is scaled to its card, never wrapped (DisplayHeadword)`);
        if (shown.overflow > 1) failures.push(`${width}px ${page}: ${shown.text} runs ${Math.round(shown.overflow)}px past its card section`);
        if (shown.fontSize < 32) failures.push(`${width}px ${page}: ${shown.text} is drawn at ${Math.round(shown.fontSize)}px, under a display size (32px)`);
    } catch (error) {
        failures.push(`${width}px ${page}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        await tab.close();
    }
}
/**
 * The word a listening cloze is measured on (issue #165): 登場人物, whose example sentences have
 * clips and whose first reading review the selector serves as a listening cloze (its hash on
 * `listening:1638880:0` falls inside `CONSTANTS.srs.listening.share`). Learned from its page, its
 * reading is due at once, so /quiz opens on it.
 */
const LISTENING_VOCAB = FURIGANA_VOCAB;
const LISTENING_ON = `(() => {
    const settings = JSON.parse(localStorage.getItem('GOKAN_SRS_SETTINGS') ?? '{}');
    localStorage.setItem('GOKAN_SRS_SETTINGS', JSON.stringify({ ...settings, enableListeningCloze: true }));
})()`;
/** The listening card's play control and answer field, as drawn. */
const LISTENING_CARD = `(() => {
    const control = document.querySelector('[data-play-control]');
    const input = document.querySelector('form input');
    const box = el => { const r = el.getBoundingClientRect(); return { height: r.height, left: r.left, right: r.right }; };
    return { control: control && box(control), input: input && box(input), width: document.documentElement.clientWidth };
})()`;
interface ListeningCardMeasure {
    control: { height: number; left: number; right: number } | null;
    input: { height: number; left: number; right: number } | null;
    width: number;
}

/**
 * The listening cloze card at a phone's width: before an answer (the play control and the blank,
 * the translation shown when the clip cannot play, as here, where the build serves no clips, or
 * at the learner's ask), and with its feedback (the sentence with furigana, its translation).
 * The control is a 44px tap target inside the screen; nothing scrolls sideways (measure).
 */
async function checkListeningCloze(chrome: Chrome, app: string, width: number, height: number): Promise<void> {
    const tab = await chrome.openTab(width, height);
    const page = `srs /quiz, a listening cloze (${LISTENING_VOCAB})`;
    try {
        await tab.goto(`${app}/`, 'I already know some kanji');
        await tab.click('I already know some kanji');
        await tab.until(`document.body.innerText.includes('Kanji learning method')`, 'the setup screen');
        await tab.click('Start learning');
        await tab.evaluate<void>(LISTENING_ON);
        await tab.goto(`${app}/vocab/${LISTENING_VOCAB}`, 'Learn this word');
        await tab.click('Learn this word');
        await new Promise(resolve => setTimeout(resolve, 1000));
        await tab.goto(`${app}/quiz`, 'Type the word you hear');
        await tab.until(`document.querySelector('[data-play-control]') !== null`, 'the play control', 10000);
        await measure(tab, page, width);
        const shown = await tab.evaluate<ListeningCardMeasure>(LISTENING_CARD);
        if (!shown.control) failures.push(`${width}px ${page}: no play control ([data-play-control])`);
        else {
            if (shown.control.height < 44) failures.push(`${width}px ${page}: the play control is ${Math.round(shown.control.height)}px tall, under a 44px tap target`);
            if (shown.control.left < 0 || shown.control.right > shown.width) failures.push(`${width}px ${page}: the play control runs off the screen`);
        }
        if (!shown.input) failures.push(`${width}px ${page}: no answer field in the blank`);

        if (await tab.evaluate<boolean>(`document.body.innerText.includes('Show the translation')`)) await tab.click("Can't listen now?");
        await measure(tab, `${page}, its translation shown`, width);

        // React reads its own value tracker: the native setter, then input, as typing sends it.
        await tab.evaluate<void>(`(() => {
            const el = document.querySelector('form input');
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'とうじょうじんぶつ');
            el.dispatchEvent(new Event('input', { bubbles: true }));
        })()`);
        await tab.click('Submit');
        await tab.until(`[...document.querySelectorAll('button')].some(el => el.textContent.trim().startsWith('Continue'))`, 'the answered card', 10000);
        await measure(tab, `${page}, answered`, width);
    } catch (error) {
        failures.push(`${width}px ${page}: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        await tab.close();
    }
}

/**
 * A new word's intro opens at its top on a small phone (DESIGN_SYSTEM section 1: the headword
 * first). The mount focus on Learn must not scroll a card taller than the screen down to its
 * buttons, hiding the word it introduces; they are reached by scrolling. Measured on a fresh
 * learner's first card (一日, eight lines of glosses), which is taller than 568px.
 */
async function checkIntroOpensAtTop(tab: Tab, app: string, width: number, restoreHeight: number): Promise<void> {
    const height = FIRST_SCREEN[width];
    if (height === undefined) return;
    await tab.resize(width, height);
    await tab.goto(`${app}/quiz`, 'Skip');
    const opened = await tab.evaluate<{ scrollY: number; focused: string }>(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve({
        scrollY: window.scrollY,
        focused: document.activeElement?.textContent?.trim() ?? '',
    }))))`);
    const page = `srs /quiz, a new word's intro (card 1)`;
    if (opened.scrollY !== 0) failures.push(`${width}x${height} ${page}: opens scrolled ${Math.round(opened.scrollY)}px down, so the headword is off the top (focus Learn with preventScroll)`);
    if (opened.focused !== 'Learn') failures.push(`${width}x${height} ${page}: Learn does not have focus on mount (has: ${JSON.stringify(opened.focused)})`);
    await tab.resize(width, restoreHeight);
}

/** Where a word page becomes one full page, without tabs (useFullDetailPage, Tailwind's `lg`). */
const FULL_PAGE_WIDTH = 1024;
/**
 * The full page's sections (VocabDetailScreen, `word-section-*`): main column, then side. Every
 * word measured here has all of them but Study, which shows once the word is learned.
 */
const FULL_PAGE_SECTIONS = ['dict', 'sentence', 'synonym', 'kanji', 'related'];
/**
 * 取る at 1280px: the longest synonyms and among the most sentences, every long section capped to
 * its preview. Measured at 2634px (header 430, Dict 720, Sentences 5 of 1,030 in 620, Synonyms 2
 * groups of 3 in 560); the bound leaves about a fifth for a gloss or a sentence that wraps one more
 * line, and fails long before a section shows all its rows (Synonyms' four groups add ~550px).
 */
const FULL_PAGE_MAX_HEIGHT = 3200;
/** How far under the viewport's top a hash lands its section's heading (`scroll-mt-6`, 24px). */
const LANDING_MAX = 48;

/**
 * A tabbed detail page (issue 169: the word's, the kanji's and the grammar point's): its ids'
 * prefix (`kanji-section-words`), what marks it settled (the content before its sections loaded),
 * and how tall its full page may be with every long section capped to its preview.
 */
interface DetailPageKind {
    prefix: string;
    settled: string;
    maxHeight?: number;
    /**
     * Its main column shows each word row and example sentence once (DESIGN_SYSTEM section 5, "never
     * a second copy of any panel"): a tab's preview of another tab is left out of the full page,
     * where that tab is the next section. Not a word page's: its Dict names two examples and its
     * closest synonyms on purpose, as the summary of the sections below.
     */
    onceEach?: boolean;
}
const WORD_PAGE: DetailPageKind = { prefix: 'word', settled: '[data-sentences="settled"]' };
/**
 * 一 at 1280px, the kanji with the most words (660): measured at 1654px (Kanji without its 5 common
 * words, which Words opens with, then Words 10 of 660). Its Words tab's 20 would add ~630px.
 */
const KANJI_PAGE: DetailPageKind = { prefix: 'kanji', settled: '[data-words="settled"]', maxHeight: 2100, onceEach: true };
/**
 * n5-001 (が いちばん) at 1280px, 26 examples: measured at 1616px (Point with its full explanation
 * and no examples, then Examples 5 of 26). Its Examples tab's 10 would add ~470px.
 */
const GRAMMAR_PAGE: DetailPageKind = { prefix: 'grammar', settled: '[data-examples="settled"]', maxHeight: 2000, onceEach: true };
const KANJI_FULL_SECTIONS = ['kanji', 'words'];
const GRAMMAR_FULL_SECTIONS = ['point', 'examples', 'related'];

/**
 * The open word page is one full page: no tab row, each section given present, and nothing wider
 * than its place: the page does not scroll sideways, and no text or input in the side column (about
 * 290px at 1024px) runs past its edge. Text inside a box that clips or scrolls on purpose (`truncate`, a
 * scrolling row) is left out: its overflow is not a sideways scroll.
 */
async function checkFullPage(tab: Tab, page: string, width: number, sections: readonly string[], kind = WORD_PAGE): Promise<void> {
    const found = await tab.evaluate<{ tabs: boolean; missing: string[]; height: number; sideways: number; side: boolean; overflowing: string[]; sameHeadings: string[]; repeated: string[] }>(`(() => {
        const describe = el => el.tagName.toLowerCase() + ' "' + el.textContent.trim().slice(0, 30) + '"';
        const column = document.querySelector('[data-detail-side]');
        const right = column ? column.getBoundingClientRect().right : 0;
        const clips = el => getComputedStyle(el).overflowX !== 'visible';
        // Inside a box that clips or scrolls on purpose: what runs past it is hidden or scrolled, not overflow.
        const clippedAbove = el => { for (let p = el; p && p !== column; p = p.parentElement) if (clips(p)) return true; return false; };
        // What the learner reads or types in, not boxes: a list's rows bleed past the column on
        // purpose (-mx-3, their hover background), which a box's scrollWidth would count.
        const overflowing = [];
        if (column) {
            const walker = document.createTreeWalker(column, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (!node.textContent.trim() || clippedAbove(node.parentElement)) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                if ([...range.getClientRects()].some(r => r.width > 0 && r.right > right + 1)) overflowing.push(node.parentElement);
            }
            for (const el of column.querySelectorAll('input, textarea, select')) {
                const r = el.getBoundingClientRect();
                if (r.width > 0 && r.right > right + 1 && !clippedAbove(el.parentElement)) overflowing.push(el);
            }
        }
        // Each section heading once: two alike ("Examples" twice) are one panel shown twice, and
        // confuse a screen reader's list of headings.
        const headings = [...document.querySelectorAll('main h2')].map(h => h.textContent.trim()).filter(Boolean);
        const sameHeadings = [...new Set(headings.filter((h, i) => headings.indexOf(h) !== i))];
        // A word row (its link) or an example sentence shown twice in the main column.
        const mainColumn = column ? column.previousElementSibling : null;
        const items = ${kind.onceEach === true} && mainColumn ? [
            ...[...mainColumn.querySelectorAll('[data-list-row] > a')].map(a => 'row ' + a.getAttribute('href')),
            ...[...mainColumn.querySelectorAll('[data-example-sentence]')].map(e => 'sentence "' + e.textContent.trim().slice(0, 20) + '"'),
        ] : [];
        const repeated = [...new Set(items.filter((item, i) => items.indexOf(item) !== i))];
        return {
            sameHeadings,
            repeated: repeated.slice(0, 3),
            tabs: document.querySelector('[data-detail-tabs], [role=tablist]') !== null,
            missing: ${JSON.stringify(sections)}.filter(s => !document.getElementById('${kind.prefix}-section-' + s)),
            height: document.documentElement.scrollHeight,
            sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            side: column !== null,
            overflowing: overflowing.slice(0, 3).map(describe),
        };
    })()`);
    if (found.tabs) failures.push(`${width}px ${page}: a tab row on the full page`);
    for (const section of found.missing) failures.push(`${width}px ${page}: no ${section} section on the full page`);
    if (found.sideways > 1) failures.push(`${width}px ${page}: the full page scrolls sideways by ${found.sideways}px`);
    if (!found.side) failures.push(`${width}px ${page}: no side column ([data-detail-side]) on the full page`);
    for (const el of found.overflowing) failures.push(`${width}px ${page}: ${el} overflows the side column`);
    for (const heading of found.sameHeadings) failures.push(`${width}px ${page}: two "${heading}" headings on the full page: a tab's preview of a section shown above that section`);
    for (const item of found.repeated) failures.push(`${width}px ${page}: the ${item} twice in the main column: a tab's preview of a section shown above that section`);
    if (page.includes(LONG_SYNONYMS_WORD) && found.height > FULL_PAGE_MAX_HEIGHT) {
        failures.push(`${width}px ${page}: the full page is ${found.height}px tall, over ${FULL_PAGE_MAX_HEIGHT}px: a long section is not capped to its preview`);
    }
    if (kind.maxHeight !== undefined && found.height > kind.maxHeight) {
        failures.push(`${width}px ${page}: the full page is ${found.height}px tall, over ${kind.maxHeight}px: a long section is not capped to its preview`);
    }
}

/** The section's heading top, from the viewport's top, once it has landed (null: no section). */
const SECTION_TOP = (section: string, prefix: string) => `(() => { const el = document.getElementById('${prefix}-section-${section}'); return el ? el.getBoundingClientRect().top : null; })()`;
/**
 * Landed: the section's heading at the top or, for a short last section (a grammar point's 5
 * examples under 800px of viewport), the page scrolled to its end with the whole section in view,
 * as far up as any scroll can bring it.
 */
const LANDED = (section: string, prefix: string) => `(() => {
    const el = document.getElementById('${prefix}-section-${section}');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.top < 0) return false;
    if (r.top <= ${LANDING_MAX}) return true;
    const atEnd = scrollY + innerHeight >= document.documentElement.scrollHeight - 1;
    return atEnd && r.bottom <= innerHeight + 1;
})()`;
async function checkLanding(tab: Tab, page: string, width: number, section: string, kind = WORD_PAGE): Promise<void> {
    const top = SECTION_TOP(section, kind.prefix);
    const landedCheck = LANDED(section, kind.prefix);
    try {
        await tab.until(`document.querySelector(${JSON.stringify(kind.settled)}) !== null && ${landedCheck}`, `the ${section} section at the top`, 10000);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const landed = await tab.evaluate<number | null>(top);
        if (!await tab.evaluate<boolean>(landedCheck)) failures.push(`${width}px ${page}: the ${section} section moved off the top once settled (${landed}px)`);
    } catch {
        const landed = await tab.evaluate<number | null>(top);
        failures.push(`${width}px ${page}: did not land on its ${section} section (its top at ${landed}px)`);
    }
}

/**
 * The full page's hashes: `#synonyms` loaded, then followed inside the app (as the quiz's "Compare
 * synonyms" does), and `#related` from the side column, each landing on its section's heading.
 */
async function checkFullPageHashes(tab: Tab, app: string, width: number): Promise<void> {
    await tab.goto(`${app}/vocab/${SYNONYMS_LINK_WORD}#synonyms`, 'Meanings');
    await checkLanding(tab, `srs /vocab/${SYNONYMS_LINK_WORD}#synonyms, loaded`, width, 'synonym');
    await tab.goto(`${app}/vocab`, 'Vocabulary');
    await tab.evaluate(`(() => { history.pushState({}, '', '/vocab/${SYNONYMS_LINK_WORD}#synonyms'); dispatchEvent(new PopStateEvent('popstate')); })()`);
    await checkLanding(tab, `srs /vocab/${SYNONYMS_LINK_WORD}#synonyms, followed`, width, 'synonym');
    await tab.goto(`${app}/vocab/${LONG_SYNONYMS_WORD}#related`, 'Meanings');
    await checkLanding(tab, `srs /vocab/${LONG_SYNONYMS_WORD}#related`, width, 'related');
    // Dict's "All N sentences" scrolls to Sentences rather than opening a tab.
    await tab.evaluate(`scrollTo(0, 0)`);
    const clicked = await tab.evaluate<boolean>(`(() => { const b = [...document.querySelectorAll('button')].find(el => /^All [\\d,]+ sentences/.test(el.textContent.trim())); b?.click(); return !!b; })()`);
    if (!clicked) failures.push(`${width}px srs /vocab/${LONG_SYNONYMS_WORD}: no "All N sentences" in Dict`);
    else await checkLanding(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, All N sentences`, width, 'sentence');
}

/**
 * Dict's "Compare all N" on the full page moves keyboard focus with its scroll, to the Synonyms
 * section's heading: with focus left on the link, the next Tab goes back into Dict. It is pressed
 * with Enter, as a keyboard does, so the heading is `:focus-visible` and must draw the app's accent
 * ring (a box-shadow) rather than the browser's default outline.
 */
async function checkDictLinkFocus(tab: Tab, page: string, width: number): Promise<void> {
    await tab.evaluate(`scrollTo(0, 0)`);
    const found = await tab.evaluate<boolean>(`(() => { const b = [...document.querySelectorAll('button')].find(el => /^Compare all [\\d,]+/.test(el.textContent.trim())); b?.focus({ preventScroll: true }); return !!b && document.activeElement === b; })()`);
    if (!found) {
        failures.push(`${width}px ${page}: no "Compare all N" in Dict`);
        return;
    }
    await tab.press('Enter', 0);
    await checkLanding(tab, `${page}, Compare all N`, width, 'synonym');
    const focused = await tab.evaluate<string>(`(() => { const el = document.activeElement; return el && el.closest('#word-section-synonym') ? '' : (el ? el.tagName.toLowerCase() + ' "' + el.textContent.trim().slice(0, 30) + '"' : 'nothing'); })()`);
    if (focused !== '') {
        failures.push(`${width}px ${page}: "Compare all N" left keyboard focus on ${focused}, not in the Synonyms section`);
        return;
    }
    const ring = await tab.evaluate<{ visible: boolean; outline: string; shadow: string }>(`(() => { const el = document.activeElement; const style = getComputedStyle(el); return { visible: el.matches(':focus-visible'), outline: style.outlineStyle, shadow: style.boxShadow }; })()`);
    if (!ring.visible) failures.push(`${width}px ${page}: the Synonyms heading focused from the keyboard is not :focus-visible`);
    if (ring.outline !== 'none') failures.push(`${width}px ${page}: the focused Synonyms heading draws the browser's outline (${ring.outline}), not the app's ring`);
    if (ring.shadow === 'none') failures.push(`${width}px ${page}: the focused Synonyms heading draws no focus ring`);
}

/**
 * Crossing 1024px keeps the learner where they were: 取る's Synonyms section in view at 1280px is
 * the open tab at 768px, and back at 1280px its section is in view again. At 768px the page is
 * the tab page.
 */
async function checkCrossing(tab: Tab, app: string): Promise<void> {
    const page = `srs /vocab/${LONG_SYNONYMS_WORD}`;
    await tab.goto(`${app}/vocab/${LONG_SYNONYMS_WORD}#synonyms`, 'Meanings');
    await checkLanding(tab, `${page}#synonyms`, DESKTOP.width, 'synonym');
    await tab.resize(768, DESKTOP.height);
    try {
        await tab.until(`document.getElementById('word-tab-synonym')?.getAttribute('aria-selected') === 'true'`, 'the Synonyms tab open at 768px', 5000);
    } catch {
        const open = await tab.evaluate<string | null>(`document.querySelector('[role=tab][aria-selected="true"]')?.textContent.trim() ?? null`);
        failures.push(`768px ${page}: crossing below 1024px from the Synonyms section opened ${open === null ? 'no tab row' : `the ${open} tab`}, not Synonyms`);
    }
    await tab.resize(DESKTOP.width, DESKTOP.height);
    await checkLanding(tab, `${page}, back at 1280px`, DESKTOP.width, 'synonym');
}

/** The kanji with the most words (660), a common one and one more (issue 169's pages). */
const DETAIL_KANJI = ['一', '学', '取'];
/** A construction with curated and corpus examples, and an inflection with only a few. */
const DETAIL_GRAMMAR = [GRAMMAR_POINT, 'n5-016'];

/**
 * The kanji and grammar pages from 1024px (issue 169): one full page, no tab row, each section
 * there and its long lists capped (KANJI_PAGE, GRAMMAR_PAGE), at 1280px and 1024px; a hash
 * landing on its section.
 */
async function checkDetailFullPages(tab: Tab, app: string): Promise<void> {
    for (const width of [DESKTOP.width, FULL_PAGE_WIDTH]) {
        await tab.resize(width, DESKTOP.height);
        for (const glyph of DETAIL_KANJI) {
            await tab.goto(`${app}/kanji/${encodeURIComponent(glyph)}`, 'Meanings');
            await tab.until(`document.querySelector(${JSON.stringify(KANJI_PAGE.settled)}) !== null && document.body.innerText.includes('Show 10 more')`, `the Words section on /kanji/${glyph}`, 10000);
            await checkFullPage(tab, `srs /kanji/${glyph}`, width, KANJI_FULL_SECTIONS, KANJI_PAGE);
            if (glyph === '一') await checkNameReadingsUnbroken(tab, `srs /kanji/${glyph}, full page`, width);
        }
        for (const id of DETAIL_GRAMMAR) {
            await tab.goto(`${app}/grammar/${id}`, 'Formation');
            await tab.until(`document.querySelector(${JSON.stringify(GRAMMAR_PAGE.settled)}) !== null`, `the examples on /grammar/${id}`, 10000);
            await checkFullPage(tab, `srs /grammar/${id}`, width, id === GRAMMAR_POINT ? GRAMMAR_FULL_SECTIONS : ['point', 'examples'], GRAMMAR_PAGE);
        }
    }
    await tab.resize(DESKTOP.width, DESKTOP.height);
    await tab.goto(`${app}/kanji/${encodeURIComponent('一')}#words`, 'Meanings');
    await checkLanding(tab, 'srs /kanji/一#words', DESKTOP.width, 'words', KANJI_PAGE);
    await tab.goto(`${app}/grammar/${GRAMMAR_POINT}#examples`, 'Formation');
    await checkLanding(tab, `srs /grammar/${GRAMMAR_POINT}#examples`, DESKTOP.width, 'examples', GRAMMAR_PAGE);
    await tab.resize(FULL_PAGE_WIDTH, DESKTOP.height);
    await checkGrammarDueOnce(tab, app, FULL_PAGE_WIDTH);
    await tab.resize(DESKTOP.width, DESKTOP.height);
}

/**
 * The kanji and grammar pages on a phone (issue 169): a tab row, running to the screen's edge,
 * and sticking once scrolled to, from their longest tab (Words, Examples) back to the first.
 */
async function checkDetailTabPages(tab: Tab, app: string, width: number): Promise<void> {
    for (const glyph of DETAIL_KANJI) {
        const page = `srs /kanji/${glyph}`;
        await tab.goto(`${app}/kanji/${encodeURIComponent(glyph)}`, 'Meanings');
        await measure(tab, page, width, PAGE_TABS);
        await checkTabRowBleed(tab, page, width);
        if (!(await openWordTab(tab, page, width, 'Words'))) continue;
        await tab.until(`document.body.innerText.includes('Show 20 more')`, `the Words tab on ${page}`, 10000);
        await measure(tab, `${page}, words tab`, width);
        await checkStickyTabs(tab, page, width, 'Kanji');
    }
    for (const id of DETAIL_GRAMMAR) {
        const page = `srs /grammar/${id}`;
        await tab.goto(`${app}/grammar/${id}`, 'Formation');
        await measure(tab, page, width, PAGE_TABS);
        await checkTabRowBleed(tab, page, width);
        if (!(await openWordTab(tab, page, width, 'Examples'))) continue;
        await measure(tab, `${page}, examples tab`, width, PLAY_BUTTONS);
        await checkStickyTabs(tab, page, width, 'Point');
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
        // The full page (from 1024px) has no tabs: Your study is a section of it.
        if (width < FULL_PAGE_WIDTH) {
            await tab.until(`[...document.querySelectorAll('[role=tab]')].some(el => el.textContent.trim() === 'Study')`, 'the Study tab', 5000);
            await openWordTab(tab, page, width, 'Study');
        }
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
 * A dictionary link with a count ("Start after step 103") opens setup with that order and count
 * in view (initialOnboardingStep, issue 243): the count sits under the method cards, below every
 * phone's first screen, and some 1,500px down for an order behind "More methods", so setup scrolls
 * it into view once the order's list is in. Each link in a fresh learner's own storage, on the
 * smallest phones the count must fit. The linked order's checked card must be on screen too
 * whenever it fits on one screen with the count (its margin under it included); where it does
 * not (672px from KKLC's card to the count at 320px, on a 568px screen), the count's label
 * ("Count in Henshall order") is what names the order, and that label is asserted.
 */
const SETUP_LINKS: { order: KanjiOrderId; known: number }[] = [{ order: 'kklc', known: 103 }, { order: 'henshall', known: 500 }];
const SETUP_LINK_SCREENS = [{ width: 320, height: 568 }, { width: 375, height: 667 }];
async function checkSetupLinkCount(chrome: Chrome, app: string, width: number, height: number): Promise<void> {
    for (const { order, known } of SETUP_LINKS) {
        const tab = await chrome.openTab(width, height);
        const page = `${width}x${height} srs /?order=${order}&known=${known}`;
        const label = `Count in ${kanjiOrder(order).label} order`;
        await tab.goto(`${app}/?order=${order}&known=${known}&utm_source=dictionary&utm_content=word`, label);
        await tab.until(`document.querySelector('#kanji-count')?.value === ${JSON.stringify(String(known))}`, `the linked count ${known} in setup's count field`, 10000);
        // The scroll runs in the effect after the list's render: let it land.
        await tab.evaluate<void>(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
        const stepper = await tab.evaluate<{ top: number; bottom: number; margin: number; label: string; card: { top: number; bottom: number } | null } | null>(`(() => {
            const section = document.querySelector('#kanji-count')?.closest('section');
            if (!section) return null;
            const r = section.getBoundingClientRect();
            const margin = section.parentElement ? Number.parseFloat(getComputedStyle(section.parentElement).scrollMarginBottom) || 0 : 0;
            const checked = document.querySelector('button[aria-pressed="true"]');
            const c = checked?.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, margin, label: section.querySelector('label')?.textContent.trim() ?? '', card: c ? { top: c.top, bottom: c.bottom } : null };
        })()`);
        if (stepper === null) failures.push(`${page}: no count stepper on the setup screen`);
        else {
            if (stepper.label !== label) failures.push(`${page}: the count stepper reads "${stepper.label}", not the linked order's "${label}"`);
            if (stepper.top < -0.5 || stepper.bottom > height + 0.5) failures.push(`${page}: the count stepper spans ${Math.round(stepper.top)}px to ${Math.round(stepper.bottom)}px, not inside the ${height}px screen (scroll it into view when a link carries a count)`);
            if (stepper.card === null) failures.push(`${page}: no checked order card on the setup screen`);
            else if (stepper.bottom + stepper.margin - stepper.card.top <= height + 0.5 && (stepper.card.top < -0.5 || stepper.card.bottom > height + 0.5)) {
                failures.push(`${page}: the checked ${kanjiOrder(order).label} card spans ${Math.round(stepper.card.top)}px to ${Math.round(stepper.card.bottom)}px, off the ${height}px screen though it fits on one with the count`);
            }
        }
        await tab.close();
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

/**
 * A sentence word keeps its hover while its lookup card opens (with a mouse, at 1280px). The card
 * opens on its loading line and grows when the word arrives; pinned by its top above the word, it
 * grew down over the word for a frame, so the word lost its hover and got it back (a flicker). The
 * page records every frame from the pointer's arrival, so a one-frame loss is seen.
 */
async function checkLookupKeepsHover(tab: Tab, page: string, width: number): Promise<void> {
    const where = `${width}px ${page}, a sentence word's lookup card`;
    const point = await tab.evaluate<{ x: number; y: number } | null>(`(() => {
        const word = document.querySelector('[data-sentence] [data-lookup-trigger]');
        if (!word) return null;
        word.scrollIntoView({ block: 'center' });
        const r = word.getClientRects()[0];
        return { x: r.left + Math.min(8, r.width / 2), y: r.top + r.height / 2 };
    })()`);
    if (!point) {
        failures.push(`${where}: no sentence word to hover`);
        return;
    }
    await tab.mouseMove(point.x - 200, Math.max(1, point.y - 200));
    await new Promise(resolve => setTimeout(resolve, 300));
    await tab.evaluate<void>(`(() => {
        const word = document.querySelector('[data-sentence] [data-lookup-trigger]');
        const log = window.__hoverLog = { carded: false, lost: 0, covered: 0 };
        const end = performance.now() + 1500;
        const frame = () => {
            const card = document.querySelector('[data-lookup-card]');
            if (card && getComputedStyle(card).visibility === 'visible') {
                log.carded = true;
                if (!word.matches(':hover')) log.lost++;
                const c = card.getBoundingClientRect();
                const w = word.getClientRects()[0];
                if (c.left < w.right && c.right > w.left && c.top < w.bottom && c.bottom > w.top) log.covered++;
            }
            if (performance.now() < end) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
    })()`);
    await tab.mouseMove(point.x, point.y);
    await new Promise(resolve => setTimeout(resolve, 1700));
    const log = await tab.evaluate<{ carded: boolean; lost: number; covered: number }>('window.__hoverLog');
    if (!log.carded) failures.push(`${where}: hovering the word opened no card`);
    else if (log.lost > 0 || log.covered > 0) failures.push(`${where}: the word lost its hover for ${log.lost} frame(s) as the card opened, the card over it for ${log.covered}`);
    await tab.mouseMove(1, 1);
}

/**
 * A word list's gloss is in its column (docs/DESIGN_SYSTEM.md section 8, Lists), whatever its
 * language: at 1280px every row's gloss (its last span) starts at the same x, the third column; on
 * a phone, and in a word page's aside at any width, it starts at the row's left edge (inside its
 * padding), on a line of its own under the headword, and spans the whole row: a gloss auto-placed
 * into the first column of the next line (a kanji word's, whose reading fills the first line) is
 * only as wide as that column. A Chinese gloss once fell into the reading's column, onto the
 * headword's line, or under the headword in its column (#227).
 */
const DICTIONARY_LIST_PAGES = ['/vocab/jlpt-n5/', ...(DICTIONARY_PAGES.some(page => page.path === '/zh-hans/vocab/jlpt-n5/') ? ['/zh-hans/vocab/jlpt-n5/'] : [])];
/** する: its aside's lists (Made of, Used in) hold kana and kanji words, in English and in Chinese. */
const ASIDE_LIST_WORD = '1157170';
const ASIDE_LIST_PAGES = [`/vocab/${ASIDE_LIST_WORD}/`, ...(DICTIONARY_PAGES.some(page => page.path.startsWith('/zh-hans/')) ? [`/zh-hans/vocab/${ASIDE_LIST_WORD}/`] : [])];
async function checkEntryGlossColumn(tab: Tab, page: string, width: number, stacked: boolean, lists = '.entry-list:not(.entry-list--brief)'): Promise<void> {
    const rows = await tab.evaluate<{ row: string; rowLeft: number; rowTop: number; rowWidth: number; left: number; top: number; width: number }[]>(`[...document.querySelectorAll(${JSON.stringify(`${lists} > li > a`)})]
        .filter(a => a.getBoundingClientRect().width > 0 && a.lastElementChild)
        .map(a => { const row = a.getBoundingClientRect(); const style = getComputedStyle(a); const gloss = a.lastElementChild.getBoundingClientRect(); return { row: a.textContent.slice(0, 20), rowLeft: row.left + parseFloat(style.paddingLeft), rowTop: row.top + parseFloat(style.paddingTop), rowWidth: row.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth), left: gloss.left, top: gloss.top, width: gloss.width }; })`);
    if (rows.length === 0) {
        failures.push(`${width}px ${page}: no word rows to measure`);
        return;
    }
    const strays = stacked
        ? rows.filter(row => Math.abs(row.left - row.rowLeft) > 1 || row.top - row.rowTop < 2 || Math.abs(row.width - row.rowWidth) > 1)
        : rows.filter(row => Math.abs(row.left - rows[0].left) > 1);
    if (strays.length > 0) failures.push(`${width}px ${page}: a row's gloss is out of its column (${stacked ? "not on its own line across the row, from its left edge" : 'not where the first row\'s starts'}): ${strays.slice(0, 3).map(row => row.row).join(', ')}`);
}

/**
 * A section's source credit (a Chinese word page's 来源：...) is set off from what comes before it,
 * at least 8px (docs/DESIGN_SYSTEM.md section 4), so it reads as a note on the whole section and not
 * as part of its last meaning or disclosure. It once sat flush under them (#227). 食べる credits
 * its meanings, its Examples (Tatoeba's, in Dict) and its sentences. On a phone each tab is
 * measured open, landed on by its hash (Dict has none): a credit in a hidden tab has no box, and
 * the check once counted 1 of 2 there. Every credit is still required, so one lost fails.
 */
const SOURCE_CREDIT_WORD = '1358280';
const SOURCE_CREDIT_PAGES = DICTIONARY_PAGES.some(page => page.path.startsWith('/zh-hans/')) ? [`/zh-hans/vocab/${SOURCE_CREDIT_WORD}/`] : [];
const SOURCE_CREDIT_TABS = [
    { section: 'dict', credits: ["the meanings'", "the examples'"] },
    { section: 'sentences', credits: ["the sentences'"] },
];
async function checkSourceCreditGap(tab: Tab, base: string, path: string, width: number, tabbed: boolean): Promise<void> {
    const landings = tabbed ? SOURCE_CREDIT_TABS : [{ section: 'dict', credits: SOURCE_CREDIT_TABS.flatMap(landing => landing.credits) }];
    for (const { section, credits: expected } of landings) {
        const page = `dictionary ${path}${tabbed && section !== 'dict' ? `#${section}` : ''}`;
        await tab.goto(`${base}${path}?landing=${section}${section === 'dict' ? '' : `#${section}`}`, '来源');
        await tab.until(`document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the tabs script on ${page}`);
        const credits = await tab.evaluate<{ credit: string; gap: number }[]>(`[...document.querySelectorAll('.source-credit')]
            .filter(el => el.getBoundingClientRect().height > 0 && el.previousElementSibling)
            .map(el => ({ credit: el.textContent.slice(0, 20), gap: el.getBoundingClientRect().top - el.previousElementSibling.getBoundingClientRect().bottom }))`);
        if (credits.length < expected.length) {
            failures.push(`${width}px ${page}: ${credits.length} source credits to measure, expected ${expected.join(' and ')}`);
            continue;
        }
        const flush = credits.filter(credit => credit.gap < 8 - 0.5);
        if (flush.length > 0) failures.push(`${width}px ${page}: a source credit sits under 8px below the element before it: ${flush.map(credit => `${credit.credit} (${credit.gap.toFixed(1)}px)`).join(', ')}`);
    }
}

/**
 * The app panel's action is one line at 320px (docs/DESIGN_SYSTEM.md section 8: a label short
 * enough for it), measured where it is longest: a word page whose step has four digits, in English
 * and in Chinese. 蛇口: step 2297 of KKLC. Its Chinese label once carried （英文） and wrapped (#244).
 * Measured on a copy whose full-width characters are each a 1em box, the advance every CJK font
 * gives them (a machine with no CJK font, CI's, draws them as narrow boxes, and every label fits),
 * at its natural width, which must leave one full-width character of the panel's width spare: a
 * real font's digits and spaces run wider than here, and 「从第 288 步之后开始（英文）」, which fits
 * the panel measured so, wrapped on staging.
 */
const PANEL_STEP_WORD = '1323370';
const PANEL_STEP_PAGES = [`/vocab/${PANEL_STEP_WORD}/`, ...(DICTIONARY_PAGES.some(page => page.path.startsWith('/zh-hans/')) ? [`/zh-hans/vocab/${PANEL_STEP_WORD}/`] : [])];
async function checkAppPanelAction(tab: Tab, page: string, width: number): Promise<void> {
    const action = await tab.evaluate<{ text: string; height: number; width: number; room: number } | null>(`(() => {
        const el = document.querySelector('.app-panel-action');
        if (!el) return null;
        const copy = el.cloneNode(false);
        for (const char of el.textContent) {
            if (!/[\\u3000-\\u9fff\\uff00-\\uffef]/.test(char)) { copy.append(char); continue; }
            const box = document.createElement('span');
            box.style.cssText = 'display: inline-block; width: 1em';
            copy.append(box);
        }
        copy.style.width = 'max-content';
        el.after(copy);
        const width = copy.getBoundingClientRect().width;
        copy.remove();
        const panel = getComputedStyle(el.parentElement);
        const room = el.parentElement.clientWidth - parseFloat(panel.paddingLeft) - parseFloat(panel.paddingRight);
        return { text: el.textContent.trim(), height: el.getBoundingClientRect().height, width, room: room - parseFloat(getComputedStyle(el).fontSize) };
    })()`);
    if (action === null) failures.push(`${width}px ${page}: no app panel action (.app-panel-action)`);
    else if (!/\d{4}/.test(action.text)) failures.push(`${width}px ${page}: the app panel action "${action.text}" names no four-digit step: pick another word (PANEL_STEP_WORD)`);
    else if (action.height > 44.5) failures.push(`${width}px ${page}: the app panel action "${action.text}" is ${Math.round(action.height)}px tall, on two lines: its label must fit one line at 320px`);
    else if (action.width > action.room) failures.push(`${width}px ${page}: the app panel action "${action.text}" is ${Math.round(action.width)}px wide with its full-width characters at 1em, over the ${Math.round(action.room)}px that leaves one of them spare: it wraps on a phone with a CJK font`);
}

/**
 * On a word page the app panel comes after the Meanings section, never above it (#244): a reader
 * came for the definition, and on a phone a panel under the header pushed it below the fold.
 */
async function checkAppPanelAfterMeanings(tab: Tab, page: string, width: number): Promise<void> {
    const found = await tab.evaluate<{ panel: number; meanings: number } | null>(`(() => {
        const panel = document.querySelector('.app-panel');
        const meanings = document.querySelector('#dict > .section');
        if (!panel || !meanings) return null;
        return { panel: panel.getBoundingClientRect().top, meanings: meanings.getBoundingClientRect().bottom };
    })()`);
    if (found === null) failures.push(`${width}px ${page}: no app panel, or no Meanings section (#dict > .section)`);
    else if (found.panel < found.meanings) failures.push(`${width}px ${page}: the app panel starts at ${Math.round(found.panel)}px, above the end of Meanings (${Math.round(found.meanings)}px): it goes after the meanings`);
}

/**
 * A Japanese word in the app panel's sentence stays on one line when it fits one (#244): read as
 * two fragments (「就能读 学 / 校。」 at 320px), it is not the word. And one wider than the line
 * wraps inside the panel rather than running out of it: kept on one line at any cost
 * (`white-space: nowrap`), it scrolled the page sideways. Where a line ends depends on the fonts
 * (CI has no CJK font, and its Latin falls back), so each word is laid out in two copies of the
 * sentence, whatever the fonts: one exactly as wide as a letter before the word and the word
 * itself, where it must move to the next line whole, and one half as wide as the word, which it
 * must wrap inside. Its text's own line boxes are read (a Range), so a word that wraps inside an
 * atomic box counts as broken. 学校 broke so on its Chinese page; 蛇口 is the four-digit step;
 * オーストラリア式フットボール (LONG_PANEL_WORD) is the longest headword with a KKLC step.
 */
const LONG_PANEL_WORD = '2097390';
const PANEL_WORD_PAGES = [
    ...['1206730', PANEL_STEP_WORD].flatMap(id => PANEL_STEP_PAGES.map(page => ({ path: page.replace(PANEL_STEP_WORD, id), ready: 'JLPT' }))),
    // Not a JLPT word, and in English only.
    { path: `/vocab/${LONG_PANEL_WORD}/`, ready: 'Meanings' },
];
async function checkAppPanelWords(tab: Tab, page: string, width: number): Promise<void> {
    const found = await tab.evaluate<{ broken: string[]; overflowing: string[] } | null>(`(() => {
        const sentence = document.querySelector('.app-panel p');
        if (!sentence) return null;
        const lineRects = el => { const range = document.createRange(); range.selectNodeContents(el); return [...range.getClientRects()].filter(r => r.width > 0); };
        const oneLine = el => { const tops = lineRects(el).map(r => r.top); return tops.every(top => Math.abs(top - tops[0]) < 2); };
        const layOut = (width, lead, el) => {
            const copy = sentence.cloneNode(false);
            copy.style.width = width;
            copy.style.maxWidth = 'none';
            if (lead) copy.append(lead);
            const word = el.cloneNode(true);
            copy.append(word);
            sentence.after(copy);
            return { copy, word };
        };
        const broken = [], overflowing = [];
        for (const el of sentence.querySelectorAll('[lang="ja"]')) {
            const natural = layOut('max-content', 'M', el);
            const lead = natural.word.getBoundingClientRect().left - natural.copy.getBoundingClientRect().left - parseFloat(getComputedStyle(natural.copy).paddingLeft);
            const wordWidth = natural.word.getBoundingClientRect().width;
            natural.copy.remove();
            const fits = layOut((lead + wordWidth - 1) + 'px', 'M', el);
            if (!oneLine(fits.word)) broken.push(el.textContent);
            fits.copy.remove();
            const narrow = layOut(Math.max(1, wordWidth / 2) + 'px', '', el);
            const right = narrow.copy.getBoundingClientRect().right - parseFloat(getComputedStyle(narrow.copy).paddingRight);
            if (lineRects(narrow.word).some(r => r.right > right + 0.5)) overflowing.push(el.textContent);
            narrow.copy.remove();
        }
        return { broken, overflowing };
    })()`);
    if (found === null) {
        failures.push(`${width}px ${page}: no app panel sentence (.app-panel p)`);
        return;
    }
    for (const word of found.broken) failures.push(`${width}px ${page}: the app panel's Japanese word ${word} breaks across lines where it fits one (keep it whole: an inline-block)`);
    for (const word of found.overflowing) failures.push(`${width}px ${page}: the app panel's Japanese word ${word} runs out of a line narrower than it, scrolling a phone sideways (let it wrap inside: max-width: 100%)`);
}

/**
 * The app panel stands a section's gap (40px, docs/DESIGN_SYSTEM.md section 4) above what follows
 * it on every page type: on a word page it once sat 24px over the Meanings, 40px over a kanji
 * page's next section. On a word page it follows Meanings, a section, and stands 40px under it
 * too (`above`): its top margin was set to collapse into a header's, and left it 24px under.
 * Elsewhere it follows the page's header, whose own margin sets the gap above.
 */
const GRAMMAR_SAMPLE_PAGE = DICTIONARY_PAGES.find(page => /^\/grammar\/n\d-[^/]+\/$/.test(page.path));
const PANEL_GAP_PAGES: { path: string; ready: string; above?: boolean }[] = [
    { path: '/vocab/1206730/', ready: 'Meanings', above: true },
    { path: `/kanji/${encodeURIComponent('学')}/`, ready: 'In kanji courses' },
    { path: '/kanji/orders/kklc/', ready: 'Steps 1 to 100' },
    { path: '/kanji/orders/kklc/1-100/', ready: 'Words by step' },
    ...(GRAMMAR_SAMPLE_PAGE ? [GRAMMAR_SAMPLE_PAGE] : []),
];
async function checkAppPanelGaps(tab: Tab, page: string, width: number, above: boolean): Promise<void> {
    const gaps = await tab.evaluate<{ below: number | null; above: number | null } | null>(`(() => {
        const panel = document.querySelector('.app-panel');
        if (!panel) return null;
        const box = panel.getBoundingClientRect();
        const next = panel.nextElementSibling;
        const previous = panel.previousElementSibling;
        return {
            below: next ? next.getBoundingClientRect().top - box.bottom : null,
            above: previous ? box.top - previous.getBoundingClientRect().bottom : null,
        };
    })()`);
    if (gaps === null) {
        failures.push(`${width}px ${page}: no app panel`);
        return;
    }
    if (gaps.below === null) failures.push(`${width}px ${page}: no content after the app panel`);
    else if (Math.abs(gaps.below - 40) > 0.5) failures.push(`${width}px ${page}: the app panel sits ${gaps.below.toFixed(1)}px above what follows it, not a section's 40px`);
    if (!above) return;
    if (gaps.above === null) failures.push(`${width}px ${page}: nothing before the app panel`);
    else if (Math.abs(gaps.above - 40) > 0.5) failures.push(`${width}px ${page}: the app panel sits ${gaps.above.toFixed(1)}px under what comes before it, not a section's 40px`);
}

/**
 * A dictionary word page as the app's (issue 168): below 1024px a row of tabs named and ordered as
 * the app's, one section shown at a time, the first Dict, a hash (#sentences, #synonyms, ...)
 * opening its own on load, each laid out within the screen with its tabs 44px tall; from 1024px
 * one full page, no tab row, every section shown, Kanji and Related beside the main column.
 * 取る has every section.
 */
const TABBED_WORD = '1326980';
const WORD_SECTIONS = ['dict', 'sentences', 'synonyms', 'forms', 'kanji', 'related'];
const WORD_LAYOUT = `(() => {
    const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const row = document.querySelector('.detail-tabs');
    const tabs = row ? [...row.querySelectorAll('a')] : [];
    const panels = [...document.querySelectorAll('.detail-panel')];
    const box = id => { const el = document.getElementById(id); return el && shown(el) ? el.getBoundingClientRect() : null; };
    return {
        row: !!row && shown(row),
        role: row ? row.getAttribute('role') : null,
        tabs: tabs.map(a => a.dataset.tab),
        selected: tabs.filter(a => a.getAttribute('aria-selected') === 'true').map(a => a.dataset.tab),
        shown: panels.filter(shown).map(el => el.id),
        dictLeft: box('dict')?.left ?? null,
        kanjiLeft: box('kanji')?.left ?? null,
        scrollY: window.scrollY,
        rowTop: row ? row.getBoundingClientRect().top : null,
        viewHeight: window.innerHeight,
    };
})()`;
interface WordLayout { row: boolean; role: string | null; tabs: string[]; selected: string[]; shown: string[]; dictLeft: number | null; kanjiLeft: number | null; scrollY: number; rowTop: number | null; viewHeight: number }

/**
 * The Synonyms section's search reads a synonym's meanings, never its closeness label: "inter" or
 * "close" once matched every row (its "= Interchangeable" sat in the gloss's column) and a meaning
 * none. Typed into 取る#synonyms: the first row's first shared meaning, then "interchangeable".
 */
async function checkSynonymSearch(tab: Tab, page: string, width: number): Promise<void> {
    const shown = (query: string) => tab.evaluate<number | null>(`(() => {
        const section = document.getElementById('synonyms');
        const input = section?.querySelector('[data-section-search] input');
        if (!input) return null;
        input.value = ${JSON.stringify(query)};
        input.dispatchEvent(new Event('input'));
        return [...section.querySelectorAll('.entry-list > li')].filter(li => li.closest('[hidden]') === null).length;
    })()`);
    const meaning = await tab.evaluate<string>(`(document.querySelector('#synonyms .entry-list > li [lang="en"]')?.textContent ?? '').split(', ')[0]`);
    if (meaning === '') {
        failures.push(`${width}px ${page}: no synonym row with a shared meaning to search for`);
        return;
    }
    const forMeaning = await shown(meaning);
    const forLabel = await shown('interchangeable');
    await shown('');
    if (forMeaning === null) failures.push(`${width}px ${page}: no search field in Synonyms`);
    else if (forMeaning === 0) failures.push(`${width}px ${page}: searching Synonyms for "${meaning}", a listed synonym's meaning, shows no row`);
    if (forLabel !== null && forLabel > 0) failures.push(`${width}px ${page}: searching Synonyms for "interchangeable" shows ${forLabel} rows: the search reads the closeness label`);
}
/**
 * Every section search's placeholder shows whole in its field at 320px: it names the languages a
 * section is searched in, and a kanji's Words once put its caveat ("English in the first 30") in a
 * placeholder a phone cut off. Measured in the open tab, the empty field's text against its content box.
 */
async function checkPlaceholdersFit(tab: Tab, page: string, width: number): Promise<void> {
    const cut = await tab.evaluate<string[]>(`(() => {
        const canvas = document.createElement('canvas').getContext('2d');
        return [...document.querySelectorAll('[data-section-search] input')].filter(input => input.getClientRects().length > 0).flatMap(input => {
            input.value = '';
            const style = getComputedStyle(input, '::placeholder');
            canvas.font = style.font || getComputedStyle(input).font;
            const inner = input.clientWidth - parseFloat(getComputedStyle(input).paddingLeft) - parseFloat(getComputedStyle(input).paddingRight);
            const text = canvas.measureText(input.placeholder).width;
            return input.scrollWidth > input.clientWidth || text > inner ? [input.placeholder + ' (' + Math.round(text) + 'px in ' + Math.round(inner) + 'px)'] : [];
        });
    })()`);
    for (const placeholder of cut) failures.push(`${width}px ${page}: a section search's placeholder is cut off in its field: ${placeholder}`);
}
async function checkDictionaryWordTabs(tab: Tab, base: string, width: number): Promise<void> {
    const page = `dictionary /vocab/${TABBED_WORD}/`;
    for (const section of WORD_SECTIONS) {
        // A query of its own each time, so the hash is a fresh page's, as a link from elsewhere lands.
        await tab.goto(`${base}/vocab/${TABBED_WORD}/?landing=${section}${section === 'dict' ? '' : `#${section}`}`, 'How common');
        await tab.until(`document.querySelector('[data-detail-panels][data-tabs-ready]') !== null && document.readyState === 'complete'`, `the tabs script on ${page}`);
        const layout = await tab.evaluate<WordLayout>(WORD_LAYOUT);
        if (!layout.row || layout.role !== 'tablist') failures.push(`${width}px ${page}#${section}: no tab row shown as a tablist below 1024px`);
        // A hash landing opens at the page top, as the app's: the word, then the tabs, never scrolled past both.
        if (layout.scrollY !== 0 || layout.rowTop === null || layout.rowTop < 0 || layout.rowTop >= layout.viewHeight) failures.push(`${width}px ${page}#${section}: lands scrolled to ${Math.round(layout.scrollY)}px, the tab row's top at ${layout.rowTop === null ? 'none' : Math.round(layout.rowTop)}px: not the page top with the tab row in view`);
        if (section === 'synonyms') await checkSynonymSearch(tab, `${page}#synonyms`, width);
        if (width === 320) await checkPlaceholdersFit(tab, `${page}#${section}`, width);
        if (layout.tabs.join() !== WORD_SECTIONS.join()) failures.push(`${width}px ${page}: tabs ${layout.tabs.join(', ')}, not the app's ${WORD_SECTIONS.join(', ')}`);
        if (layout.shown.join() !== section || layout.selected.join() !== section) failures.push(`${width}px ${page}#${section}: shows ${layout.shown.join(', ') || 'nothing'} with ${layout.selected.join(', ') || 'no tab'} selected, not ${section} alone`);
        await measure(tab, `${page}#${section}`, width, DICTIONARY_TAP_TARGETS);
    }
    if (width === 320) await checkTabReloadKeepsScroll(tab, base, width);
}

/**
 * A reload keeps where the reader was: choosing a tab writes its hash, so a reload halfway down
 * #sentences is a hash in the URL as a landing is, and the landing's lock to the page top once
 * undid the browser's restored scroll. The lock is for a fresh navigation only.
 */
async function checkTabReloadKeepsScroll(tab: Tab, base: string, width: number): Promise<void> {
    const page = `dictionary /vocab/${TABBED_WORD}/#sentences`;
    await tab.goto(`${base}/vocab/${TABBED_WORD}/?landing=reload#sentences`, 'How common');
    await tab.until(`document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the tabs script on ${page}`);
    // Past the landing's lock (a second after load), then down the open section.
    await new Promise(resolve => setTimeout(resolve, 1300));
    const before = await tab.evaluate<number>('(window.scrollTo(0, 400), window.scrollY)');
    if (before <= 0) {
        failures.push(`${width}px ${page}: the page does not scroll, so a reload's restored scroll cannot be checked`);
        return;
    }
    await tab.reload('How common');
    await new Promise(resolve => setTimeout(resolve, 700));
    const after = await tab.evaluate<number>('window.scrollY');
    if (after <= 0) failures.push(`${width}px ${page}: scrolled ${before}px down then reloaded, it opens at the page top: the landing's lock undid the browser's restored scroll`);
}
async function checkDictionaryWordFullPage(tab: Tab, base: string, width: number): Promise<void> {
    const page = `dictionary /vocab/${TABBED_WORD}/`;
    await tab.goto(`${base}/vocab/${TABBED_WORD}/`, 'Meanings');
    await tab.until(`document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the tabs script on ${page}`);
    const layout = await tab.evaluate<WordLayout>(WORD_LAYOUT);
    if (layout.row) failures.push(`${width}px ${page}: a tab row on the full page`);
    if (layout.shown.join() !== WORD_SECTIONS.join()) failures.push(`${width}px ${page}: the full page shows ${layout.shown.join(', ')}, not every section (${WORD_SECTIONS.join(', ')})`);
    if (layout.dictLeft === null || layout.kanjiLeft === null || layout.kanjiLeft <= layout.dictLeft) failures.push(`${width}px ${page}: Kanji is not in the aside, beside the main column`);
    // One furigana toggle for the page (they flip one setting), and each sentence once: Dict's
    // Examples are Sentences' first rows, which the full page does not draw twice.
    const once = await tab.evaluate<{ toggles: number; repeated: string[] }>(`(() => {
        const drawn = el => el.getClientRects().length > 0;
        const textOf = el => { const copy = el.cloneNode(true); copy.querySelectorAll('rt').forEach(rt => rt.remove()); return copy.textContent.trim(); };
        const sentencesIn = id => [...document.querySelectorAll('#' + id + ' .sentence-list > li')].filter(drawn).map(li => textOf(li.querySelector('.sentence-jp') ?? li));
        const sentences = new Set(sentencesIn('sentences'));
        return {
            toggles: [...document.querySelectorAll('[data-furigana-toggle]')].filter(drawn).length,
            repeated: sentencesIn('dict').filter(text => sentences.has(text)).slice(0, 3),
        };
    })()`);
    if (once.toggles !== 1) failures.push(`${width}px ${page}: the full page shows ${once.toggles} furigana toggles, not one`);
    for (const text of once.repeated) failures.push(`${width}px ${page}: the full page shows a sentence in both Examples and Sentences: ${text}`);
    await measure(tab, page, width, DICTIONARY_TAP_TARGETS);
}

/**
 * A Sentences query typed on the full page still holds once the page drops into tabs (a tablet
 * turned to portrait): the full page leaves out Sentences' tab-only rows (Dict's Examples), which
 * tabs draw, so the search re-runs as the arrangement changes. Typed at 1280px, a Japanese query
 * matching neither Examples row; at 768px no row shown fails it, and the count is of every row.
 */
async function checkSearchAcrossDetailWidth(tab: Tab, base: string): Promise<void> {
    const page = `dictionary /vocab/${TABBED_WORD}/#sentences`;
    await tab.resize(DESKTOP.width, DESKTOP.height);
    await tab.goto(`${base}/vocab/${TABBED_WORD}/`, 'Meanings');
    await tab.until(`document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the tabs script on ${page}`);
    const ROWS = `[...document.querySelectorAll('#sentences .sentence-list > li')]`;
    const TEXT = `(li => { const copy = (li.querySelector('.sentence-jp') ?? li).cloneNode(true); copy.querySelectorAll('rt').forEach(rt => rt.remove()); return copy.textContent; })`;
    const query = await tab.evaluate<string | null>(`(() => {
        const text = ${TEXT};
        const rows = ${ROWS};
        const previews = rows.filter(li => li.matches('.detail-preview')).map(text);
        const rest = rows.filter(li => !li.matches('.detail-preview')).map(text);
        const input = document.querySelector('#sentences [data-section-search] input');
        if (!input || previews.length === 0) return null;
        const pick = [...(rest[0] ?? '')].find(ch => /[\u3041-\u3096\u30a1-\u30fa\u4e00-\u9fff]/.test(ch) && previews.every(p => !p.includes(ch)) && rest.some(r => r.includes(ch)));
        if (!pick) return null;
        input.value = pick;
        input.dispatchEvent(new Event('input'));
        return pick;
    })()`);
    if (query === null) {
        failures.push(`${page}: no Sentences search with tab-only rows, or no Japanese query matching none of them`);
        return;
    }
    await tab.resize(768, DESKTOP.height);
    await tab.until(`document.querySelector('.detail-tabs[role="tablist"]') !== null`, `the tabs on ${page} at 768px`);
    const after = await tab.evaluate<{ failing: number; rows: number; count: string }>(`(() => {
        const text = ${TEXT};
        const rows = ${ROWS};
        const shown = rows.filter(li => !li.hidden && li.closest('details[hidden]') === null);
        return {
            failing: shown.filter(li => !text(li).includes(${JSON.stringify(query)})).length,
            rows: rows.length,
            count: document.querySelector('#sentences [data-section-count]')?.textContent ?? '',
        };
    })()`);
    const total = /of ([\d,]+)/.exec(after.count)?.[1]?.replace(/,/g, '');
    if (after.failing > 0) failures.push(`768px ${page}: "${query}" typed at 1280px, then narrowed to tabs: ${after.failing} rows shown that do not match it`);
    if (total !== String(after.rows)) failures.push(`768px ${page}: "${query}" typed at 1280px, then narrowed to tabs: the count line reads "${after.count}", not a total of its ${after.rows} rows`);
    await tab.resize(DESKTOP.width, DESKTOP.height);
}

/**
 * The header search's grouped results (#264): a query finding words, kanji and grammar points
 * (から: words starting with it, the kanji 空 by its kun reading, the point から) shows its three
 * groups, measured like a page (no sideways scroll, the 12px floor, the 16px field) with the panel
 * open. In the dictionary each option is a 44px tap target. Typed as a learner types, through the
 * field's own value setter, so React's controlled input and the dictionary's script both see it.
 */
const SEARCH_QUERY = 'から';
/** A word page in each locale: Chinese's index carries the kanji and points too, linked at English's pages. */
const HEADER_SEARCH_PAGES = [`/vocab/${SOURCE_CREDIT_WORD}/`, ...(DICTIONARY_PAGES.some(page => page.path.startsWith('/zh-hans/')) ? [`/zh-hans/vocab/${SOURCE_CREDIT_WORD}/`] : [])];
const TYPE_SEARCH = (field: string, query = SEARCH_QUERY) => `(() => {
    const input = document.querySelector(${JSON.stringify(field)});
    if (!input) return false;
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(query)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
})()`;
const SEARCH_GROUPS = (listbox: string) => `[...document.querySelectorAll('${listbox} [role="group"]')].filter(el => el.getBoundingClientRect().height > 0).length`;
async function checkHeaderSearch(tab: Tab, page: string, width: number, site: 'srs' | 'dictionary'): Promise<void> {
    const where = `${width}px ${page}, searching ${SEARCH_QUERY}`;
    if (site === 'srs') {
        // On a phone the header shows the search as an icon, which opens the field over the header.
        await tab.evaluate<void>(`document.querySelector('button[aria-label="Search words, kanji and grammar"]')?.click()`);
        await tab.until(`document.querySelector('input[role="combobox"]') !== null`, `the search field on ${page}`, 5000);
    }
    const field = site === 'srs' ? 'input[role="combobox"]' : '[data-search-input]';
    const listbox = site === 'srs' ? '#header-search-results' : '[data-search-results]';
    if (site === 'dictionary') {
        // The index loads on first focus; the query is typed once it has.
        await tab.evaluate<void>(`document.querySelector('[data-search-input]')?.focus()`);
        await tab.until(`document.querySelector('[data-search-message]')?.textContent === ''`, `the search index on ${page}`, 20000);
    }
    if (!await tab.evaluate<boolean>(TYPE_SEARCH(field))) {
        failures.push(`${where}: no search field`);
        return;
    }
    try {
        await tab.until(`${SEARCH_GROUPS(listbox)} === 3`, `three result groups on ${page}`, 20000);
    } catch {
        failures.push(`${where}: the results do not show Words, Kanji and Grammar (${await tab.evaluate<number>(SEARCH_GROUPS(listbox))} groups)`);
        return;
    }
    await measure(tab, `${page}, searching ${SEARCH_QUERY}`, width, site === 'dictionary' ? '.search-option' : '');
    const outside = await tab.evaluate<number>(`[...document.querySelectorAll('${listbox} [role="option"]')].filter(el => { const r = el.getBoundingClientRect(); return r.height > 0 && (r.left < -1 || r.right > ${width} + 1); }).length`);
    if (outside > 0) failures.push(`${where}: ${outside} result rows reach past the screen's edge`);
    if (site === 'dictionary' && page.includes('/zh-hans/')) {
        await checkSearchOptionLang(tab, where, listbox);
        await checkSearchGroupLangMark(tab, where, listbox);
    }
}

/**
 * The app's grammar options (#264): a title is the row's content, so it keeps its width and the
 * romaji beside it truncates first; it wraps only when it is wider than the whole row. It once
 * shrank first and broke inside the pattern (〜から〜にかけ / て, Noun から / Noun まで) while its
 * romaji kept its width. A title whose natural width fits its line must render on one line.
 */
const GRAMMAR_TITLE_QUERIES = [SEARCH_QUERY, 'te kara'];
const GRAMMAR_TITLES = `[...document.querySelectorAll('#header-search-results [aria-labelledby="header-search-group-grammar"] [role="option"] > div:first-child > div:first-child > span:first-child')]`;
async function checkGrammarTitlesOneLine(tab: Tab, page: string, width: number): Promise<void> {
    await tab.evaluate<void>(`document.querySelector('button[aria-label="Search words, kanji and grammar"]')?.click()`);
    await tab.until(`document.querySelector('input[role="combobox"]') !== null`, `the search field on ${page}`, 5000);
    let previous = '';
    for (const query of GRAMMAR_TITLE_QUERIES) {
        const where = `${width}px ${page}, searching ${query}`;
        if (!await tab.evaluate<boolean>(TYPE_SEARCH('input[role="combobox"]', query))) {
            failures.push(`${where}: no search field`);
            return;
        }
        try {
            await tab.until(`${GRAMMAR_TITLES}.some(el => el.getBoundingClientRect().height > 0)`, `grammar results on ${page}`, 20000);
        } catch {
            failures.push(`${where}: no grammar results to measure`);
            continue;
        }
        // The previous query's rows stay shown until the new search lands (keepPrevious).
        try {
            await tab.until(`${GRAMMAR_TITLES}.map(el => el.textContent).join('|') !== ${JSON.stringify(previous)}`, `new grammar results on ${page}`, 3000);
        } catch {
            // The same titles for both queries, or already shown: measure what is there.
        }
        previous = await tab.evaluate<string>(`${GRAMMAR_TITLES}.map(el => el.textContent).join('|')`);
        const wrapped = await tab.evaluate<string[]>(`${GRAMMAR_TITLES}.filter(title => {
            const style = getComputedStyle(title);
            const probe = document.createElement('span');
            probe.textContent = title.textContent;
            probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
            probe.style.font = style.font;
            document.body.appendChild(probe);
            const natural = probe.getBoundingClientRect().width;
            probe.remove();
            const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;
            return natural <= title.parentElement.clientWidth && title.getBoundingClientRect().height > line * 1.5;
        }).map(title => title.textContent)`);
        if (wrapped.length > 0) failures.push(`${where}: a grammar title that fits its row wraps (its romaji should truncate first): ${wrapped.slice(0, 3).join(' | ')}`);
    }
}

/**
 * The app's desktop panel (#264, 1280px), where it is a dropdown with a height cap. At rest the
 * next group's label shows below the first group's rows, so a reader sees that more follow: for
 * sui (Words first, then the kanji 水, 推, 睡...) and から (Grammar first) the cap once held the first
 * group alone. Then, for から, the arrow keys step through every option, down to the last and back
 * up: focus stays in the field, so the panel follows the highlight only because the option is
 * scrolled into view, and its scroll margin keeps it clear of its group's sticky label.
 */
const PANEL_REACH_QUERIES = [{ query: 'sui', first: 'words' }, { query: SEARCH_QUERY, first: 'grammar' }];
const APP_PANEL = `document.getElementById('header-search-results')?.parentElement`;
async function checkSearchPanelReach(tab: Tab, page: string, width: number): Promise<void> {
    for (const { query, first } of PANEL_REACH_QUERIES) {
        const where = `${width}px ${page}, searching ${query}`;
        if (!await tab.evaluate<boolean>(TYPE_SEARCH('input[role="combobox"]', query))) {
            failures.push(`${where}: no search field`);
            return;
        }
        try {
            await tab.until(`(() => { const groups = document.querySelectorAll('#header-search-results [role="group"]'); return groups.length > 1 && groups[0].getAttribute('aria-labelledby') === 'header-search-group-${first}'; })()`, `${first} first, then another group, on ${page}`, 20000);
        } catch {
            failures.push(`${where}: the results do not show ${first} first and another group after it`);
            continue;
        }
        const reach = await tab.evaluate<{ label: string; bottom: number; panelBottom: number }>(`(() => {
            const panel = ${APP_PANEL};
            panel.scrollTop = 0;
            const label = document.getElementById(document.querySelectorAll('#header-search-results [role="group"]')[1].getAttribute('aria-labelledby'));
            return { label: label.textContent, bottom: label.getBoundingClientRect().bottom, panelBottom: panel.getBoundingClientRect().bottom };
        })()`);
        if (reach.bottom > reach.panelBottom + 1) failures.push(`${where}: at rest the panel shows its first group alone; the next one (${reach.label}) starts ${Math.round(reach.bottom - reach.panelBottom)}px below its bottom edge`);
    }

    // The last query is から: walk its options with the arrow keys.
    const where = `${width}px ${page}, searching ${SEARCH_QUERY} with the arrow keys`;
    const count = await tab.evaluate<number>(`document.querySelectorAll('#header-search-results [role="option"]').length`);
    const steps = [...Array.from({ length: count }, () => 'ArrowDown' as const), ...Array.from({ length: Math.max(0, count - 1) }, () => 'ArrowUp' as const)];
    const hidden = new Set<string>();
    for (const key of steps) {
        await tab.press(key, 150);
        const problem = await tab.evaluate<string>(`(() => {
            const option = document.querySelector('#header-search-results [aria-selected="true"]');
            if (!option) return 'no highlighted option';
            const panel = ${APP_PANEL}.getBoundingClientRect();
            const rect = option.getBoundingClientRect();
            const name = option.textContent.slice(0, 20);
            if (rect.top < panel.top - 1 || rect.bottom > panel.bottom + 1) return name + ' is outside the panel';
            const label = document.getElementById(option.closest('[role="group"]').getAttribute('aria-labelledby')).getBoundingClientRect();
            if (rect.top < label.bottom - 1) return name + ' is under the sticky label of its group';
            return '';
        })()`);
        if (problem) hidden.add(problem);
    }
    if (count === 0) failures.push(`${where}: no options to step through`);
    if (hidden.size > 0) failures.push(`${where}: the highlighted option is not kept in view: ${[...hidden].slice(0, 3).join(' | ')}`);
}

/**
 * The app's desktop panel (#264, 1280px): a new result set opens at its top, so the first-ranked
 * row is the first one seen. The panel keeps the previous results while the next search runs and
 * once kept their scroll too: typed on from から (scrolled down) to からだ, it opened on 体つき with
 * the exact match 体 above its top edge.
 */
const SCROLL_RESET_QUERIES = { from: SEARCH_QUERY, to: `${SEARCH_QUERY}だ` };
async function checkSearchPanelScrollReset(tab: Tab, page: string, width: number): Promise<void> {
    const where = `${width}px ${page}, typing on from ${SCROLL_RESET_QUERIES.from} to ${SCROLL_RESET_QUERIES.to}`;
    const firstOption = `(document.querySelector('#header-search-results [role="option"]')?.textContent ?? '')`;
    if (!await tab.evaluate<boolean>(TYPE_SEARCH('input[role="combobox"]', SCROLL_RESET_QUERIES.from))) {
        failures.push(`${where}: no search field`);
        return;
    }
    try {
        await tab.until(`document.querySelectorAll('#header-search-results [role="group"]').length > 1`, `results for ${SCROLL_RESET_QUERIES.from} on ${page}`, 20000);
    } catch {
        failures.push(`${where}: no results for ${SCROLL_RESET_QUERIES.from}`);
        return;
    }
    const before = await tab.evaluate<string>(`(() => { const panel = ${APP_PANEL}; panel.scrollTop = panel.scrollHeight; return ${firstOption}; })()`);
    if (!await tab.evaluate<boolean>(TYPE_SEARCH('input[role="combobox"]', SCROLL_RESET_QUERIES.to))) {
        failures.push(`${where}: no search field`);
        return;
    }
    try {
        await tab.until(`${firstOption} !== '' && ${firstOption} !== ${JSON.stringify(before)}`, `new results for ${SCROLL_RESET_QUERIES.to} on ${page}`, 20000);
    } catch {
        failures.push(`${where}: the results did not change`);
        return;
    }
    const shown = await tab.evaluate<{ scrollTop: number; inView: boolean }>(`(() => {
        const panel = ${APP_PANEL};
        const box = panel.getBoundingClientRect();
        const rect = document.querySelector('#header-search-results [role="option"]').getBoundingClientRect();
        return { scrollTop: panel.scrollTop, inView: rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1 };
    })()`);
    if (shown.scrollTop !== 0 || !shown.inView) failures.push(`${where}: the new results keep the previous scroll (scrollTop ${shown.scrollTop}), so the first-ranked row is not in view`);
}

/**
 * On a Chinese page, the panel's English (a grammar point's explanation, a kanji's meaning) and
 * romaji are marked as such, not left to inherit the page's zh-Hans: a grammar option once wrote
 * both as bare spans. A run of two Latin letters is what is looked for, so a chip's N5 is not; Latin
 * inside Japanese (a grammar title's placeholders, Noun から Noun まで) is the title's own and stays ja.
 */
async function checkSearchOptionLang(tab: Tab, where: string, listbox: string): Promise<void> {
    const unmarked = await tab.evaluate<string[]>(`(() => {
        const found = [];
        for (const option of document.querySelectorAll('${listbox} .search-option')) {
            const walker = document.createTreeWalker(option, NodeFilter.SHOW_TEXT);
            for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (!/[A-Za-z]{2}/.test(node.textContent)) continue;
                const lang = node.parentElement.closest('[lang]')?.getAttribute('lang') ?? '';
                if (lang.toLowerCase().startsWith('zh')) found.push(node.textContent.slice(0, 30));
            }
        }
        return found;
    })()`);
    if (unmarked.length > 0) failures.push(`${where}: Latin text in the results left in the page's zh-Hans (mark it lang="en" or "ja-Latn"): ${unmarked.slice(0, 3).join(' | ')}`);
}

/**
 * On a Chinese page, a group whose options open pages served in English only (kanji, grammar:
 * hreflang="en") says so beside its label, with the site header's small 英文 (.lang-mark,
 * DESIGN_SYSTEM section 8: marked for a reader as well as by hreflang). The groups once carried
 * the hreflang alone.
 */
async function checkSearchGroupLangMark(tab: Tab, where: string, listbox: string): Promise<void> {
    const unmarked = await tab.evaluate<string[]>(`[...document.querySelectorAll('${listbox} [role="group"]')]
        .filter(group => group.querySelector('.search-option[hreflang^="en"]') && !group.querySelector('.search-group-label .lang-mark'))
        .map(group => group.querySelector('.search-group-label')?.textContent ?? '?')`);
    if (unmarked.length > 0) failures.push(`${where}: a group linking to English-only pages does not say so beside its label (.lang-mark): ${unmarked.join(', ')}`);
}

/**
 * The /search/ page's kanji rows (#264): glyph | meaning | level on one line, as in the header
 * panel. They once stacked meaning and level in the word list's gloss column (both are spans with a
 * lang, which .entry-list puts there), leaving the middle column empty. sui finds a page of kanji by
 * their on reading (水, 推, 睡...).
 */
const SEARCH_PAGE_KANJI_QUERY = 'sui';
async function checkSearchPageKanjiRows(tab: Tab, base: string, width: number): Promise<void> {
    const page = `dictionary /search/?q=${SEARCH_PAGE_KANJI_QUERY}`;
    await tab.goto(`${base}/search/?q=${SEARCH_PAGE_KANJI_QUERY}`, 'JLPT N');
    await measure(tab, page, width, DICTIONARY_TAP_TARGETS);
    const rows = await tab.evaluate<{ row: string; meaningTop: number; levelTop: number; meaningRight: number; levelLeft: number }[]>(`[...document.querySelectorAll('[data-search-page] ul > li > a[href*="/kanji/"]')]
        .filter(a => a.getBoundingClientRect().width > 0 && a.querySelectorAll(':scope > span').length >= 2)
        .map(a => { const spans = a.querySelectorAll(':scope > span'); const meaning = spans[0].getBoundingClientRect(); const level = spans[spans.length - 1].getBoundingClientRect(); return { row: a.textContent.slice(0, 20), meaningTop: meaning.top, levelTop: level.top, meaningRight: meaning.right, levelLeft: level.left }; })`);
    if (rows.length === 0) {
        failures.push(`${width}px ${page}: no kanji rows to measure`);
        return;
    }
    const stacked = rows.filter(row => Math.abs(row.meaningTop - row.levelTop) > 2 || row.meaningRight > row.levelLeft + 1);
    if (stacked.length > 0) failures.push(`${width}px ${page}: a kanji row's meaning and level are not side by side on one line: ${stacked.slice(0, 3).map(row => row.row).join(', ')}`);
}

/**
 * The /search/ page's sections for から (#264), which finds Grammar, Words and Kanji. Kanji and
 * grammar are not paged: a short section is listed whole, a longer one shows its first rows and
 * folds the rest into a disclosure (lib/searchFold.ts), as about 30 grammar points once pushed Words
 * some 2000px down; から's Grammar folds, its 7 kanji do not. Every row is listed, so a heading's
 * count is the section's rows (they were once cut to 50 under a larger count). On a Chinese page a
 * section whose links open pages served in English only (kanji, grammar: hreflang="en") says so
 * beside its heading (.lang-mark, DESIGN_SYSTEM section 8), and Words, its own section, does not.
 */
const SEARCH_PAGE_SECTIONS_QUERY = 'から';
const SEARCH_PAGE_SECTION_ROWS = 5;
const SEARCH_PAGE_SECTION_WHOLE = 8;
async function checkSearchPageSections(tab: Tab, base: string, width: number): Promise<void> {
    for (const prefix of ['', '/zh-hans']) {
        const page = `dictionary ${prefix}/search/?q=${SEARCH_PAGE_SECTIONS_QUERY}`;
        await tab.goto(`${base}${prefix}/search/?q=${encodeURIComponent(SEARCH_PAGE_SECTIONS_QUERY)}`, 'N5');
        try {
            await tab.until(`document.querySelectorAll('[data-search-page] section').length === 3`, `three result sections on ${page}`, 20000);
        } catch {
            failures.push(`${width}px ${page}: the results do not show Words, Kanji and Grammar`);
            continue;
        }
        await measure(tab, page, width, DICTIONARY_TAP_TARGETS);
        const sections = await tab.evaluate<{ heading: string; count: number; english: boolean; marked: boolean; shownBeforeDisclosure: number; rows: number; folds: boolean; grammar: boolean; words: boolean }[]>(`[...document.querySelectorAll('[data-search-page] section')].map(section => {
            const heading = section.querySelector('h2');
            const own = heading ? [...heading.childNodes].filter(node => !(node instanceof Element && node.classList.contains('lang-mark'))).map(node => node.textContent).join('') : '';
            return {
                heading: heading?.textContent ?? '?',
                count: Number((own.match(/[\\d,]+/g) ?? ['0']).pop().replace(/,/g, '')),
                english: section.querySelector('a[hreflang^="en"]') !== null,
                marked: section.querySelector('h2 .lang-mark') !== null,
                shownBeforeDisclosure: section.querySelectorAll(':scope > ul > li').length,
                rows: section.querySelectorAll('li').length,
                folds: section.querySelector(':scope > details') !== null,
                grammar: section.querySelector('a[href*="/grammar/"]') !== null,
                words: section.querySelector('a[href*="/vocab/"]') !== null,
            };
        })`);
        const grammar = sections.find(section => section.grammar);
        if (!grammar) failures.push(`${width}px ${page}: no Grammar section`);
        else if (!grammar.folds) failures.push(`${width}px ${page}: the Grammar section (${grammar.rows} rows) does not fold, so the fold is not checked`);
        for (const section of sections.filter(section => !section.words)) {
            if (section.folds && (section.shownBeforeDisclosure !== SEARCH_PAGE_SECTION_ROWS || section.rows <= SEARCH_PAGE_SECTION_WHOLE)) {
                failures.push(`${width}px ${page}: ${section.heading} shows ${section.shownBeforeDisclosure} of ${section.rows} rows before its disclosure (${SEARCH_PAGE_SECTION_ROWS}, and only past ${SEARCH_PAGE_SECTION_WHOLE} rows)`);
            }
            if (!section.folds && section.rows > SEARCH_PAGE_SECTION_WHOLE) failures.push(`${width}px ${page}: ${section.heading} lists ${section.rows} rows with no disclosure (at most ${SEARCH_PAGE_SECTION_WHOLE})`);
            if (section.count !== section.rows) failures.push(`${width}px ${page}: ${section.heading} counts ${section.count} but lists ${section.rows} rows`);
        }
        const unmarked = sections.filter(section => section.english && !section.marked).map(section => section.heading);
        if (unmarked.length > 0) failures.push(`${width}px ${page}: a section linking to English-only pages does not say so beside its heading (.lang-mark): ${unmarked.join(', ')}`);
        const marked = sections.filter(section => !section.english && section.marked).map(section => section.heading);
        if (marked.length > 0) failures.push(`${width}px ${page}: a section in the page's own language is marked as English: ${marked.join(', ')}`);
        if (prefix && !sections.some(section => section.english)) failures.push(`${width}px ${page}: no section links to English-only pages, so the mark is not checked`);
    }
    await checkSearchPageJumps(tab, base, width);
}

/**
 * The /search/ page's line of sections under its title (#264): a page of words once pushed the
 * Kanji for sui (水, 推, 睡...) some 4000px down at 320px. With more than one section, the line
 * links to each, in their order on the page, each to a section that exists.
 */
async function checkSearchPageJumps(tab: Tab, base: string, width: number): Promise<void> {
    const page = `dictionary /search/?q=${SEARCH_PAGE_KANJI_QUERY}`;
    await tab.goto(`${base}/search/?q=${SEARCH_PAGE_KANJI_QUERY}`, 'JLPT N');
    try {
        await tab.until(`document.querySelectorAll('[data-search-page] section').length > 1`, `several result sections on ${page}`, 20000);
    } catch {
        failures.push(`${width}px ${page}: fewer than two result sections, so the line of sections is not checked`);
        return;
    }
    const found = await tab.evaluate<{ sections: string[]; links: string[]; visible: boolean; loose: number; offset: number }>(`(() => {
        const nav = document.querySelector('[data-search-page] nav.search-sections');
        // Where the first link's text starts, against the title's: its tap padding is outdented.
        const text = nav?.querySelector('a')?.firstChild;
        const range = document.createRange();
        if (text) range.selectNodeContents(text);
        const title = document.querySelector('[data-search-title]');
        return {
            sections: [...document.querySelectorAll('[data-search-page] section')].map(section => section.id),
            links: nav ? [...nav.querySelectorAll('a')].map(a => a.getAttribute('href') ?? '') : [],
            visible: nav !== null && nav.getBoundingClientRect().top < window.innerHeight,
            loose: nav ? [...nav.children].filter(child => child.tagName !== 'A').length : 0,
            offset: text && title ? range.getBoundingClientRect().left - title.getBoundingClientRect().left : 0,
        };
    })()`);
    // A separator outside the links once dangled at the end of a wrapped line (Grammar (29) · Words (168) ·).
    if (found.loose > 0) failures.push(`${width}px ${page}: the line of sections has ${found.loose} children besides its links (a separator that can dangle at a wrap)`);
    if (Math.abs(found.offset) > 1) failures.push(`${width}px ${page}: the line of sections starts ${Math.round(found.offset)}px from the title's edge`);
    const expected = found.sections.map(id => `#${id}`);
    if (found.links.join(' ') !== expected.join(' ') || found.sections.some(id => !id)) {
        failures.push(`${width}px ${page}: the line of sections links to ${found.links.join(', ') || 'nothing'}, not to each section in order (${expected.join(', ')})`);
    } else if (!found.visible) failures.push(`${width}px ${page}: the line of sections is not on the first screen`);
}

/** The dictionary's play buttons (pages/PlayButton.svelte), shown once the player's pre-paint class is set. */
const DICTIONARY_PLAY_BUTTONS = 'button.play';
/**
 * The dictionary's play buttons (issue 255), on a word with a clip and sentences with clips (取る),
 * a word learned in kana (its button after the kanji-spelling note) and a grammar point whose
 * examples have clips: each named, 44px (measure), at the first line of what it plays, and on a
 * phone in the open tab. The word's own follows its reading; a sentence's is its right-hand column.
 */
async function checkDictionaryPlayButtons(tab: Tab, base: string, width: number): Promise<void> {
    const pages = [
        { path: `/vocab/${TABBED_WORD}/`, ready: 'How common', reading: 'Play 取る', sentences: true },
        { path: `/vocab/${KANA_WORD}/`, ready: 'How common', reading: 'Play ', sentences: false },
        ...PITCH_WORDS.map(word => ({ path: `/vocab/${word}/`, ready: 'Meanings', reading: 'Play ', sentences: false })),
        { path: `/grammar/${GRAMMAR_POINT}/`, ready: 'Grammar', reading: null, sentences: true },
    ];
    for (const { path, ready, reading, sentences } of pages) {
        const page = `dictionary ${path}`;
        await tab.goto(`${base}${path}`, ready);
        await tab.until(`document.documentElement.classList.contains('playable') && document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the player and the tabs on ${page}`);
        const shown = await tab.evaluate<{ reading: string | null; sentences: number; unnamed: number; script: boolean }>(`(() => {
            const visible = el => el.getBoundingClientRect().width > 0;
            const buttons = [...document.querySelectorAll('button.play')].filter(visible);
            const head = document.querySelector('.entry-sub button.play');
            return {
                reading: head && visible(head) ? head.getAttribute('aria-label') : null,
                sentences: buttons.filter(el => el.closest('.play-row') && el.getAttribute('aria-label') === 'Play sentence').length,
                unnamed: buttons.filter(el => !el.getAttribute('aria-label') || !el.dataset.clip || !el.dataset.clip.startsWith('/audio/')).length,
                script: [...document.scripts].some(script => script.src.includes('/assets/player-')),
            };
        })()`);
        if (!shown.script) failures.push(`${width}px ${page}: a page with play buttons links no player script`);
        if (reading !== null && (shown.reading === null || !shown.reading.startsWith(reading))) failures.push(`${width}px ${page}: no play button after the word's reading named "${reading}..." (${shown.reading ?? 'none'})`);
        if (sentences && shown.sentences === 0) failures.push(`${width}px ${page}: no sentence in the open tab has a "Play sentence" button`);
        if (shown.unnamed > 0) failures.push(`${width}px ${page}: ${shown.unnamed} play buttons without a name or a clip URL under /audio/`);
        await checkPlayButtonsOnFirstLine(tab, page, width, DICTIONARY_PLAY_BUTTONS);
        await checkPitchAccentUnpunctuated(tab, page, width);
        if (MULTI_PITCH_WORDS.some(word => path === `/vocab/${word}/`)) {
            await checkPitchButtonFollowsFirst(tab, page, width);
            await checkPitchPatternsFlush(tab, page, width);
        }
        await measure(tab, page, width, DICTIONARY_TAP_TARGETS);
    }
    // A page that plays nothing links no player and shows no button: the kanji page.
    await tab.goto(`${base}/kanji/${encodeURIComponent('学')}/`, 'In kanji courses');
    const silent = await tab.evaluate<boolean>(`document.querySelector('button.play') === null && ![...document.scripts].some(script => script.src.includes('/assets/player-'))`);
    if (!silent) failures.push(`${width}px dictionary /kanji/学/: a play button or the player script on a page that plays nothing`);
}

/**
 * A clip does not outlive its button (the app's rule): below the detail width, a sentence playing in
 * Sentences stops when the Dict tab is tapped (the tab script writes its hash with replaceState, so
 * no hashchange), and a corpus example playing stops when its disclosure closes. `Audio` is a fake
 * that plays at once, so the check needs no clip served and no sound.
 */
const FAKE_AUDIO = `void (window.Audio = function () { return { play: () => Promise.resolve(), pause() {}, addEventListener() {} }; })`;
const PRESSED_PLAY = `document.querySelectorAll('button.play[aria-pressed="true"]').length`;
const settlePlayer = () => new Promise(resolve => setTimeout(resolve, 200));
/** Presses a button (`press` returns false when there is none), expects it playing, hides it, expects none playing. */
async function pressThenHide(tab: Tab, where: string, press: string, hide: string, hidden: string): Promise<void> {
    await tab.evaluate<void>(FAKE_AUDIO);
    if (!await tab.evaluate<boolean>(press)) {
        failures.push(`${where}: no play button shown to press`);
        return;
    }
    await settlePlayer();
    if (await tab.evaluate<number>(PRESSED_PLAY) === 0) failures.push(`${where}: a pressed play button does not show aria-pressed="true"`);
    await tab.evaluate<void>(hide);
    await settlePlayer();
    if (await tab.evaluate<number>(PRESSED_PLAY) !== 0) failures.push(`${where}: the clip keeps playing after ${hidden}`);
}
async function checkDictionaryPlayStops(tab: Tab, base: string, width: number): Promise<void> {
    const word = `dictionary /vocab/${TABBED_WORD}/`;
    await tab.goto(`${base}/vocab/${TABBED_WORD}/#sentences`, 'How common');
    await tab.until(`document.documentElement.classList.contains('playable') && document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the player and the tabs on ${word}`);
    await pressThenHide(tab, `${width}px ${word}#sentences`, `(() => {
        const button = [...document.querySelectorAll('#sentences button.play')].find(el => el.getClientRects().length > 0);
        if (!button) return false;
        button.click();
        return true;
    })()`, `document.querySelector('[data-detail-tabs] a[data-tab]').click()`, 'the Dict tab is tapped');
    const grammar = `dictionary /grammar/${GRAMMAR_POINT}/`;
    await tab.goto(`${base}/grammar/${GRAMMAR_POINT}/#examples`, 'Grammar');
    await tab.until(`document.documentElement.classList.contains('playable') && document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the player and the tabs on ${grammar}`);
    await pressThenHide(tab, `${width}px ${grammar}#examples (corpus)`, `(() => {
        const details = document.querySelector('#examples details');
        if (!details) return false;
        details.open = true;
        const button = [...details.querySelectorAll('button.play')].find(el => el.getClientRects().length > 0);
        if (!button) return false;
        button.click();
        return true;
    })()`, `void (document.querySelector('#examples details').open = false)`, 'its disclosure closes');
}

/**
 * The dictionary's kanji and grammar pages as the app's (issue 257), through the word page's tab
 * script: below 1024px a row of tabs named and ordered as the app's (Kanji, Words; Point, Examples,
 * Related), each hash landing on its section alone with its tabs 44px tall, the first tab's preview
 * of the next section shown there; from 1024px one full page, no tab row, every section shown and
 * no preview (the section itself follows). A searchable section finds a row by its own English.
 */
const DICTIONARY_DETAIL_PAGES: { path: string; ready: string; sections: string[]; searched?: string }[] = [
    ...DETAIL_KANJI.map(glyph => ({ path: `/kanji/${encodeURIComponent(glyph)}/`, ready: 'Strokes', sections: ['kanji', 'words'], ...(glyph === '一' ? { searched: 'words' } : {}) })),
    ...DETAIL_GRAMMAR.map(id => ({ path: `/grammar/${id}/`, ready: 'JLPT', sections: ['point', 'examples', 'related'], ...(id === GRAMMAR_POINT ? { searched: 'examples' } : {}) })),
];
const DETAIL_PREVIEWS_SHOWN = `[...document.querySelectorAll('.detail-preview')].filter(el => el.getBoundingClientRect().height > 0).length`;
async function checkDictionaryDetailTabs(tab: Tab, base: string, width: number): Promise<void> {
    for (const { path, ready, sections, searched } of DICTIONARY_DETAIL_PAGES) {
        const page = `dictionary ${path}`;
        for (const section of sections) {
            const first = section === sections[0];
            await tab.goto(`${base}${path}?landing=${section}${first ? '' : `#${section}`}`, ready);
            await tab.until(`document.querySelector('[data-detail-panels][data-tabs-ready]') !== null && document.readyState === 'complete'`, `the tabs script on ${page}`);
            const layout = await tab.evaluate<WordLayout>(WORD_LAYOUT);
            if (!layout.row || layout.role !== 'tablist') failures.push(`${width}px ${page}#${section}: no tab row shown as a tablist below 1024px`);
            if (layout.scrollY !== 0 || layout.rowTop === null || layout.rowTop < 0 || layout.rowTop >= layout.viewHeight) failures.push(`${width}px ${page}#${section}: lands scrolled to ${Math.round(layout.scrollY)}px, the tab row's top at ${layout.rowTop === null ? 'none' : Math.round(layout.rowTop)}px: not the page top with the tab row in view`);
            if (layout.tabs.join() !== sections.join()) failures.push(`${width}px ${page}: tabs ${layout.tabs.join(', ')}, not the app's ${sections.join(', ')}`);
            if (layout.shown.join() !== section || layout.selected.join() !== section) failures.push(`${width}px ${page}#${section}: shows ${layout.shown.join(', ') || 'nothing'} with ${layout.selected.join(', ') || 'no tab'} selected, not ${section} alone`);
            if (first && await tab.evaluate<number>(DETAIL_PREVIEWS_SHOWN) === 0) failures.push(`${width}px ${page}: the ${section} tab shows no preview of the next section`);
            // A kanji's readings each whole on one line, as the app's (取's Kun list runs over two lines on a phone).
            if (first && path.startsWith('/kanji/')) await checkKanjiReadingsUnbroken(tab, page, width);
            if (section === searched) await checkSectionSearch(tab, `${page}#${section}`, width, section);
            if (width === 320) await checkPlaceholdersFit(tab, `${page}#${section}`, width);
            await measure(tab, `${page}#${section}`, width, DICTIONARY_TAP_TARGETS);
        }
    }
}

/** A section's search finds a row by its first row's English (a gloss, a translation), and not every row. */
async function checkSectionSearch(tab: Tab, page: string, width: number, section: string): Promise<void> {
    const shown = (query: string) => tab.evaluate<{ shown: number; total: number } | null>(`(() => {
        const section = document.getElementById(${JSON.stringify(section)});
        const input = section?.querySelector('[data-section-search] input');
        if (!input) return null;
        input.value = ${JSON.stringify(query)};
        input.dispatchEvent(new Event('input'));
        const rows = [...section.querySelectorAll('.entry-list > li, .sentence-list > li')];
        return { shown: rows.filter(li => li.closest('[hidden]') === null).length, total: rows.length };
    })()`);
    const english = await tab.evaluate<string>(`(() => {
        const row = document.querySelector(${JSON.stringify(`#${section} .entry-list > li [lang="en"], #${section} .sentence-list > li .sentence-en`)});
        return (row?.textContent ?? '').split(/[^A-Za-z]+/).filter(word => word.length > 3)[0] ?? '';
    })()`);
    if (english === '') {
        failures.push(`${width}px ${page}: no row with English to search for`);
        return;
    }
    const found = await shown(english);
    await shown('');
    if (found === null) failures.push(`${width}px ${page}: no search field in the section`);
    else if (found.shown === 0 || found.shown === found.total) failures.push(`${width}px ${page}: searching for "${english}", its first row's English, shows ${found.shown} of ${found.total} rows`);
}
async function checkDictionaryDetailFullPages(tab: Tab, base: string): Promise<void> {
    for (const width of [DESKTOP.width, FULL_PAGE_WIDTH]) {
        await tab.resize(width, DESKTOP.height);
        for (const { path, ready, sections } of DICTIONARY_DETAIL_PAGES) {
            const page = `dictionary ${path}`;
            await tab.goto(`${base}${path}`, ready);
            await tab.until(`document.querySelector('[data-detail-panels][data-tabs-ready]') !== null`, `the tabs script on ${page}`);
            const layout = await tab.evaluate<WordLayout>(WORD_LAYOUT);
            if (layout.row) failures.push(`${width}px ${page}: a tab row on the full page`);
            if (layout.shown.join() !== sections.join()) failures.push(`${width}px ${page}: the full page shows ${layout.shown.join(', ')}, not every section (${sections.join(', ')})`);
            const previews = await tab.evaluate<number>(DETAIL_PREVIEWS_SHOWN);
            if (previews > 0) failures.push(`${width}px ${page}: the full page shows ${previews} tab preview(s) above the section they preview`);
            await measure(tab, page, width, DICTIONARY_TAP_TARGETS);
        }
    }
    await tab.resize(DESKTOP.width, DESKTOP.height);
}

/**
 * A kanji's linked course step is underlined at rest (docs/DESIGN_SYSTEM.md sections 2 and 8):
 * a plain "Step 66" (a book with no range page) sits among linked ones, and the accent alone was
 * too close to the ink to tell them apart. 学 has both.
 */
async function checkCourseStepLinks(tab: Tab, page: string, width: number): Promise<void> {
    const steps = await tab.evaluate<{ linked: number; plain: string[] }>(`(() => {
        const links = [...document.querySelectorAll('.kanji-courses dd a')];
        return { linked: links.length, plain: links.filter(a => !getComputedStyle(a).textDecorationLine.includes('underline')).map(a => a.textContent.trim()) };
    })()`);
    if (steps.linked === 0) failures.push(`${width}px ${page}: no linked course step (.kanji-courses dd a) to check`);
    for (const step of steps.plain) failures.push(`${width}px ${page}: the linked course step "${step}" is not underlined, so only its colour tells it from a plain step`);
}

/**
 * The home page's app panel sits as close under its heading as every other home section's content
 * does (docs/DESIGN_SYSTEM.md section 4: heading to content 16px). The panel's own top margin once
 * outweighed the heading's, so its section alone stood 24px off (#244). Compared with the Browse
 * section's tiles, the next section with a heading, in each locale's home page.
 */
const PANEL_HOME_PAGES = DICTIONARY_PAGES.filter(page => page.path === '/' || page.path === '/zh-hans/');
async function checkAppPanelHeadingGap(tab: Tab, page: string, width: number): Promise<void> {
    const gaps = await tab.evaluate<{ panel: number; other: number; heading: string } | null>(`(() => {
        const sections = [...document.querySelectorAll('section')].filter(section => section.firstElementChild?.tagName === 'H2');
        const gap = section => { const h2 = section.firstElementChild; return h2.nextElementSibling.getBoundingClientRect().top - h2.getBoundingClientRect().bottom; };
        const panel = sections.find(section => section.firstElementChild.nextElementSibling?.classList.contains('app-panel'));
        const other = sections.find(section => section !== panel && section.firstElementChild.nextElementSibling);
        if (!panel || !other) return null;
        return { panel: gap(panel), other: gap(other), heading: other.firstElementChild.textContent.trim() };
    })()`);
    if (gaps === null) failures.push(`${width}px ${page}: no home section whose heading is followed by the app panel, and another to compare it with`);
    else if (Math.abs(gaps.panel - gaps.other) > 0.5) failures.push(`${width}px ${page}: the app panel sits ${gaps.panel.toFixed(1)}px under its heading, the ${gaps.heading} section's content ${gaps.other.toFixed(1)}px under its own: heading to content is one gap`);
}

/**
 * The language switcher is one small neutral line (docs/DESIGN_SYSTEM.md section 8): its link in
 * `secondary`, no larger than the breadcrumb's, so the page head keeps one primary thing. It once
 * drew in the accent at body size (#227). Both of 食べる's pages have a counterpart, so a switcher.
 */
const SWITCHER_PAGES = DICTIONARY_PAGES.some(page => page.path.startsWith('/zh-hans/')) ? [`/vocab/${SOURCE_CREDIT_WORD}/`, `/zh-hans/vocab/${SOURCE_CREDIT_WORD}/`] : [];
async function checkLocaleSwitch(tab: Tab, page: string, width: number): Promise<void> {
    const found = await tab.evaluate<{ color: string; secondary: string; size: number; crumb: number } | null>(`(() => {
        const link = document.querySelector('.locale-switch a');
        const crumb = document.querySelector('.breadcrumb a');
        if (!link || !crumb || link.getBoundingClientRect().width === 0) return null;
        const probe = document.createElement('span');
        probe.style.color = 'var(--secondary)';
        link.parentElement.appendChild(probe);
        const secondary = getComputedStyle(probe).color;
        probe.remove();
        const style = getComputedStyle(link);
        return { color: style.color, secondary, size: parseFloat(style.fontSize), crumb: parseFloat(getComputedStyle(crumb).fontSize) };
    })()`);
    if (found === null) {
        failures.push(`${width}px ${page}: no visible language switcher (or breadcrumb) to measure`);
        return;
    }
    if (found.color !== found.secondary) failures.push(`${width}px ${page}: the language switcher's link is ${found.color}, not the secondary colour (${found.secondary})`);
    if (found.size > found.crumb + 0.5) failures.push(`${width}px ${page}: the language switcher's link is ${found.size}px, larger than the breadcrumb's ${found.crumb}px`);
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
    await checkIntroDesktop(desktop, `http://127.0.0.1:${srs.port}`);
    await desktop.goto(`http://127.0.0.1:${srs.port}/vocab`, 'Vocabulary');
    await checkGrammarTitlesOneLine(desktop, 'srs /vocab', DESKTOP.width);
    await checkSearchPanelReach(desktop, 'srs /vocab', DESKTOP.width);
    await checkSearchPanelScrollReset(desktop, 'srs /vocab', DESKTOP.width);
    for (const path of DICTIONARY_LIST_PAGES) {
        await desktop.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, 'N5');
        await checkEntryGlossColumn(desktop, `dictionary ${path}`, DESKTOP.width, false);
    }
    for (const path of ASIDE_LIST_PAGES) {
        await desktop.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, 'JLPT');
        await checkEntryGlossColumn(desktop, `dictionary ${path}, its aside`, DESKTOP.width, true, '.entry-list--stacked');
    }
    for (const path of SOURCE_CREDIT_PAGES) await checkSourceCreditGap(desktop, `http://127.0.0.1:${dictionary.port}/dictionary`, path, DESKTOP.width, false);
    for (const width of [DESKTOP.width, FULL_PAGE_WIDTH]) {
        await desktop.resize(width, DESKTOP.height);
        await checkDictionaryWordFullPage(desktop, `http://127.0.0.1:${dictionary.port}/dictionary`, width);
    }
    await checkSearchAcrossDetailWidth(desktop, `http://127.0.0.1:${dictionary.port}/dictionary`);
    await checkSearchPageKanjiRows(desktop, `http://127.0.0.1:${dictionary.port}/dictionary`, DESKTOP.width);
    await checkSearchPageSections(desktop, `http://127.0.0.1:${dictionary.port}/dictionary`, DESKTOP.width);
    await desktop.resize(DESKTOP.width, DESKTOP.height);
    await checkDictionaryDetailFullPages(desktop, `http://127.0.0.1:${dictionary.port}/dictionary`);
    await checkDictionaryPlayButtons(desktop, `http://127.0.0.1:${dictionary.port}/dictionary`, DESKTOP.width);
    for (const path of SWITCHER_PAGES) {
        await desktop.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, 'JLPT');
        await checkLocaleSwitch(desktop, `dictionary ${path}`, DESKTOP.width);
    }
    // At 1280px the patterns share the button's line: the button reads as the first's.
    for (const word of MULTI_PITCH_WORDS) {
        await desktop.goto(`http://127.0.0.1:${srs.port}/vocab/${word}`, 'Dict');
        await checkPitchButtonFollowsFirst(desktop, `srs /vocab/${word}`, DESKTOP.width);
    }
    await checkKanaIntro(chrome, `http://127.0.0.1:${srs.port}`, DESKTOP.width, DESKTOP.height);
    await checkLongHeadwordIntro(chrome, `http://127.0.0.1:${srs.port}`, DESKTOP.width, DESKTOP.height);
    await desktop.goto(`http://127.0.0.1:${srs.port}/vocab/${FURIGANA_VOCAB}`, 'Examples');
    await checkLookupKeepsHover(desktop, `srs /vocab/${FURIGANA_VOCAB}`, DESKTOP.width);
    // With mix-ups, so Your study's search shows in the side column at 1024px, its narrowest.
    await desktop.evaluate<void>(SEED_MIXUPS);
    await desktop.goto(`http://127.0.0.1:${srs.port}/vocab/${MIXUP_WORD}`, 'Dict');
    if (await learnOpenWord(desktop, `srs /vocab/${MIXUP_WORD}`, DESKTOP.width)) {
        await checkHeaderStatus(desktop, `srs /vocab/${MIXUP_WORD}, studied`, DESKTOP.width);
        await checkFullPage(desktop, `srs /vocab/${MIXUP_WORD}, studied`, DESKTOP.width, [...FULL_PAGE_SECTIONS, 'study']);
        await desktop.resize(FULL_PAGE_WIDTH, DESKTOP.height);
        await desktop.until(`document.body.innerText.includes('Show all mix-ups')`, 'Your mix-ups on the full page');
        await desktop.click('Show all mix-ups');
        await checkFullPage(desktop, `srs /vocab/${MIXUP_WORD}, studied, every mix-up`, FULL_PAGE_WIDTH, [...FULL_PAGE_SECTIONS, 'study']);
        await desktop.resize(DESKTOP.width, DESKTOP.height);
    }
    await desktop.goto(`http://127.0.0.1:${srs.port}/vocab/${HYPHEN_KUN_WORD}`, 'Dict');
    await desktop.resize(FULL_PAGE_WIDTH, DESKTOP.height);
    await desktop.until(`document.querySelector('[data-sentences="settled"]') !== null && document.querySelector('[data-kanji-reading]') !== null`, "the sentences and the Kanji section's readings", 10000);
    await checkFullPage(desktop, `srs /vocab/${HYPHEN_KUN_WORD}`, FULL_PAGE_WIDTH, FULL_PAGE_SECTIONS);
    await checkKanjiReadingsUnbroken(desktop, `srs /vocab/${HYPHEN_KUN_WORD}, full page`, FULL_PAGE_WIDTH);
    await desktop.resize(DESKTOP.width, DESKTOP.height);
    await desktop.goto(`http://127.0.0.1:${srs.port}/vocab/${LONG_SYNONYMS_WORD}`, 'Meanings');
    await desktop.until(`document.querySelector('[data-sentences="settled"]') !== null`, 'the sentences');
    await checkFullPage(desktop, `srs /vocab/${LONG_SYNONYMS_WORD}`, DESKTOP.width, FULL_PAGE_SECTIONS);
    await desktop.resize(FULL_PAGE_WIDTH, DESKTOP.height);
    await checkFullPage(desktop, `srs /vocab/${LONG_SYNONYMS_WORD}`, FULL_PAGE_WIDTH, FULL_PAGE_SECTIONS);
    await desktop.resize(DESKTOP.width, DESKTOP.height);
    await checkFullPageHashes(desktop, `http://127.0.0.1:${srs.port}`, DESKTOP.width);
    await checkDictLinkFocus(desktop, `srs /vocab/${LONG_SYNONYMS_WORD}`, DESKTOP.width);
    await checkCrossing(desktop, `http://127.0.0.1:${srs.port}`);
    await checkDetailFullPages(desktop, `http://127.0.0.1:${srs.port}`);
    await checkDrillWalk(desktop, `http://127.0.0.1:${srs.port}`, DESKTOP.width);
    await checkChapterDrillGap(desktop, `http://127.0.0.1:${srs.port}`, DESKTOP.width);
    await desktop.close();
    for (const { width, height } of SETUP_LINK_SCREENS) await checkSetupLinkCount(chrome, `http://127.0.0.1:${srs.port}`, width, height);
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
            if (route.japaneseFaces) await checkJapaneseFaces(tab, `srs ${route.path}`, width);
        }
        await checkDrillWalk(tab, app, width);
        await checkChapterDrillGap(tab, app, width);
        // The library's rows with a status line, the tightest rows on a phone. Before any word is
        // learned: the library ranks by known words, which would page the marked titles out of view.
        await tab.goto(`${app}/listening/${COMPLETED_TITLE}`, 'Mark all watched');
        await tab.click('Mark all watched');
        await tab.goto(`${app}/listening/${WATCHING_TITLE}`, 'Mark all watched');
        await tab.click('Mark watched');
        await tab.goto(`${app}/listening`, 'Watching ·');
        await tab.until(`document.body.innerText.includes('Completed')`, 'a completed title in the library');
        await measure(tab, 'srs /listening, watching and completed titles', width);
        // After the library: skipping intro cards marks words known, which reorders it.
        await checkIntroOpensAtTop(tab, app, width, height);
        await checkIntroCard(tab, app, width, height);
        await checkKanaIntro(chrome, app, width, height);
        await checkLongHeadwordIntro(chrome, app, width, height);
        await checkListeningCloze(chrome, app, width, height);
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
        // 回's kun readings start with a hyphen: they wrap between readings, inside the screen.
        await tab.goto(`${app}/vocab/${HYPHEN_KUN_WORD}`, 'Dict');
        await openWordTab(tab, `srs /vocab/${HYPHEN_KUN_WORD}`, width, 'Kanji');
        await tab.until(`document.querySelector('[data-kanji-reading]') !== null`, "the Kanji tab's readings", 10000);
        await measure(tab, `srs /vocab/${HYPHEN_KUN_WORD}, kanji tab`, width);
        await checkKanjiReadingsUnbroken(tab, `srs /vocab/${HYPHEN_KUN_WORD}, kanji tab`, width);
        await tab.goto(`${app}/grammar/${GRAMMAR_POINT}`, 'Formation');
        await measure(tab, `srs /grammar/${GRAMMAR_POINT}`, width, PLAY_BUTTONS);
        await checkSentencePlayButtons(tab, `srs /grammar/${GRAMMAR_POINT}`, width);
        await checkExamplesUnruled(tab, `srs /grammar/${GRAMMAR_POINT}`, width);
        await tab.goto(`${app}/vocab/${KANA_WORD}`, 'Usually written in kana');
        await checkPlayButtonsOnFirstLine(tab, `srs /vocab/${KANA_WORD}`, width);
        for (const word of PITCH_WORDS) {
            await tab.goto(`${app}/vocab/${word}`, 'Dict');
            await checkPlayButtonsOnFirstLine(tab, `srs /vocab/${word}`, width);
            await checkPitchAccentUnpunctuated(tab, `srs /vocab/${word}`, width);
            if (MULTI_PITCH_WORDS.includes(word)) {
                await checkPitchButtonFollowsFirst(tab, `srs /vocab/${word}`, width);
                await checkPitchPatternsFlush(tab, `srs /vocab/${word}`, width);
            }
            // The longest reading, one pattern: its header still fits a small phone's first screen,
            // measured on its own page. Not the words with several patterns: 現在進行形's second
            // takes a line of its own after the button at 320px (the layout chosen on PR 267),
            // which puts its status line 13px below a 568px screen.
            if (word === PITCH_WORDS[0]) await checkWordFirstScreen(tab, `srs /vocab/${word}`, width, height);
        }
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
        if (learned) await checkNoReviewNow(tab, app, width, MIXUP_WORD);
        if (learned) await checkReviewPacing(tab, app, width);
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
        await checkDetailTabPages(tab, app, width);
        await checkGrammarDueOnce(tab, app, width);
        await tab.goto(`${app}/vocab`, 'Vocabulary');
        await checkHeaderSearch(tab, 'srs /vocab', width, 'srs');
        await checkGrammarTitlesOneLine(tab, 'srs /vocab', width);
        // The removed Mix-ups page's path lands on Vocabulary.
        await tab.goto(`${app}/vocab/mixups`, 'Vocabulary');
        await tab.until(`location.pathname.endsWith('/vocab')`, '/vocab/mixups redirecting to /vocab');
        for (const path of HEADER_SEARCH_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, 'JLPT');
            await checkHeaderSearch(tab, `dictionary ${path}`, width, 'dictionary');
        }
        await checkSearchPageKanjiRows(tab, `http://127.0.0.1:${dictionary.port}/dictionary`, width);
        await checkSearchPageSections(tab, `http://127.0.0.1:${dictionary.port}/dictionary`, width);
        for (const page of DICTIONARY_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${page.path}`, page.ready);
            await measure(tab, `dictionary ${page.path}`, width, DICTIONARY_TAP_TARGETS);
            if (DICTIONARY_LIST_PAGES.includes(page.path)) await checkEntryGlossColumn(tab, `dictionary ${page.path}`, width, true);
            await checkListFirstScreen(tab, `dictionary ${page.path}`, page.path, width);
        }
        if (width === LIST_FIRST_SCREEN.width) {
            for (const page of DICTIONARY_LIST_SHAPES) {
                await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${page.path}`, page.ready);
                await checkListFirstScreen(tab, `dictionary ${page.path}`, page.path, width);
            }
        }
        for (const path of SOURCE_CREDIT_PAGES) await checkSourceCreditGap(tab, `http://127.0.0.1:${dictionary.port}/dictionary`, path, width, true);
        for (const path of SWITCHER_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, 'JLPT');
            await checkLocaleSwitch(tab, `dictionary ${path}`, width);
        }
        for (const path of PANEL_STEP_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, 'JLPT');
            await checkAppPanelAction(tab, `dictionary ${path}`, width);
            await checkAppPanelAfterMeanings(tab, `dictionary ${path}`, width);
        }
        for (const { path, ready } of PANEL_WORD_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, ready);
            await measure(tab, `dictionary ${path}`, width, DICTIONARY_TAP_TARGETS);
            await checkAppPanelWords(tab, `dictionary ${path}`, width);
        }
        for (const { path, ready, above = false } of PANEL_GAP_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${path}`, ready);
            await checkAppPanelGaps(tab, `dictionary ${path}`, width, above);
            if (path.startsWith('/kanji/') && !path.startsWith('/kanji/orders/')) await checkCourseStepLinks(tab, `dictionary ${path}`, width);
        }
        for (const home of PANEL_HOME_PAGES) {
            await tab.goto(`http://127.0.0.1:${dictionary.port}/dictionary${home.path}`, home.ready);
            await checkAppPanelHeadingGap(tab, `dictionary ${home.path}`, width);
        }
        await checkDictionaryWordTabs(tab, `http://127.0.0.1:${dictionary.port}/dictionary`, width);
        await checkDictionaryDetailTabs(tab, `http://127.0.0.1:${dictionary.port}/dictionary`, width);
        await checkDictionaryPlayButtons(tab, `http://127.0.0.1:${dictionary.port}/dictionary`, width);
        await checkDictionaryPlayStops(tab, `http://127.0.0.1:${dictionary.port}/dictionary`, width);
        await measureFuriganaFixture(tab, `http://127.0.0.1:${dictionary.port}/dictionary/vocab/${FURIGANA_VOCAB}/`, 'Meanings', `dictionary /vocab/${FURIGANA_VOCAB}/`, width, DICTIONARY_TAP_TARGETS);
        await tab.close();
    }
} catch (error) {
    failures.push(`could not finish: ${error instanceof Error ? error.message : String(error)}`);
} finally {
    await chrome.kill();
    srs.server.close();
    updated.server.close();
    dictionary.stop();
    rmSync(NEWER_DIR, { recursive: true, force: true });
}

if (failures.length) {
    for (const failure of failures) console.error(`[check-layout] ${failure}`);
    fail(`${failures.length} layout problem(s) in ${checked} pages. See docs/DESIGN_SYSTEM.md; fix the page, never the check.`);
}
console.log(`[check-layout] ${checked} pages at ${VIEWPORTS.map(v => `${v.width}px`).join(' and ')}: no sideways scroll, nothing under 12px, inputs 16px, tap targets 44px, a kanji's course steps 44px linked or not, sentence words not underlined or spaced apart (margin or padding), example sentences not ruled, a word page's tabs 44px, the dictionary's word page tabbed as the app's on a phone (each hash landing on its section alone, at the page top, a reload keeping its scroll, its synonym search reading meanings, not labels) and one full page at 1280px, the kanji and grammar pages tabbed on a phone and one capped full page from 1024px, in the app and in the dictionary (its Words and Examples searched by their English, every section search's placeholder whole at 320px, a Sentences query holding as the page crosses into tabs), furigana over kanji, on one line and apart, Japanese in list rows and word readings unbroken, a word list's gloss in its column (1280px) or on its own line across the row (phones, a word page's aside), a section's source credit set off from what comes before it, the language switcher small and neutral, the app panel's action on one line with a four-digit step, its Japanese words unbroken where they fit and wrapped inside it where they do not, 40px above what follows it on every page type (and under Meanings on a word page) and on the home page 16px under its heading, a kanji's linked course steps underlined, a kanji's readings each on one line, the update banner's controls 44px, setup's decisions above the kanji grid and a way back to them from its end, setup opened from a dictionary link with its order and count on a 568 or 667px phone's screen, a word page's essentials on a small phone's first screen, a list page's first screen within the rows its budget counts, a new word's intro with its example sentence, its words out of the Tab order, its reading's play button undimmed, its sentence centred on its translation with its button right after it (and at 1280px on the headword), a word learned in kana's intro, a long headword's intro on one line inside its card, and Skip and Learn on the first screen at 720 and 812 tall, opening at its top on a smaller phone, play buttons at the first line of what they play (in the dictionary too, named, 44px, with its player, none on a kanji page, a clip stopped when a tab or a closed disclosure hides its button), its tab row running to the screen's edge with a tab cut there when it scrolls (at either end and after choosing any tab), stuck once scrolled to and the open tab in its view, a tab chosen there (or the open one tapped again) opening at its top, Your study's phone grid on a studied word, its header status on one line at 1280px, no Review now on a due word, a due grammar point saying Due now once, a #synonyms link opening the Synonyms tab, its rows' shared senses wrapped, not cut off, a sentence word keeping its hover as its lookup card opens, a sentence word's lookup sheet in the viewport with a 44px Close and 44px links, review pacing's end tooltips on screen, its slider stepped twice by the keyboard, five key steps written as one history entry, a step saved on Tab away and on a reload straight after it, and a plain change saved.`);
