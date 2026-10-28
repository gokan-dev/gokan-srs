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
 * - setup's "Vocabulary order" heading and "Start learning" button sit within about two screens of
 *   the top at 320px, 375px and 1280px, not under the kanji grid (issue #158); with the grid
 *   opened, "Done marking" sits within a screen of the page's end and brings Start learning back
 *   into view;
 * - furigana sits over kanji only, never over kana, no ruby (a run of kanji with its reading)
 *   breaks across lines, and no two readings on a line touch (word pages' example sentences, in each app);
 * - a `#synonyms` link followed inside the app opens a word page's Explore on its Synonyms panel
 *   and leaves Explore at the top of the screen once the sections above it have loaded.
 *
 * Usage: build both apps (`bun run --cwd apps/gokan-srs build`, `bun run --cwd
 * apps/gokan-dictionary build`), then `bun run check:layout`. Needs Chrome or Chromium: found at
 * the usual paths, or named by CHROME_PATH. Run by CI (.github/workflows/ci-layout.yml).
 *
 * Chrome is driven over the DevTools protocol with Bun's own WebSocket: Playwright's transports
 * do not work under Bun on Windows, and this needs nothing installed.
 */
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
    const spaced = [...document.querySelectorAll('[data-sentence] > *')].filter(el => visible(el) && parseFloat(getComputedStyle(el).marginLeft) + parseFloat(getComputedStyle(el).marginRight) > 0);
    if (spaced.length) problems.push('sentence word has a side margin (reads as a space in Japanese): ' + spaced.slice(0, 3).map(describe).join(', '));
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
const [COMPLETED_TITLE, WATCHING_TITLE] = listeningTitlesToMark();
// 登場人物: its sentences hold long readings that wrap at the end of a line at 320 and 375px, the
// case where a ruby broken across lines puts the wrong syllables over each kanji. A dataset
// fixture, not discovered from the build: when a dataset bump drops the word or its sentences,
// measureFuriganaFixture names it as the thing to update.
const FURIGANA_VOCAB = '1638880';
const FIXTURE_MOVED = `FURIGANA_VOCAB ${FURIGANA_VOCAB} has no example sentence with furigana: pick another word whose sentences wrap at 320px`;

// A word page with mix-ups (輝く: more than the five shown, a long English sentence, an answer
// naming a word, raw ones and an unconverted Latin token with no break point), its Explore opened
// on Mix-ups, then on Synonyms, which hold a mixed-up word. Then 取る, whose pairs make the longest
// Synonyms panel, as it opens and with every meaning and row shown. Readable records under a
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

// 差す: Explore under example sentences that load after the word, so a `#synonyms` link that
// scrolls before they arrive leaves Explore pushed down the screen.
const SYNONYMS_LINK_WORD = '1291330';
/**
 * Explore's top after the link, in px: its `scroll-mt-6` (24px, the page's own top padding on a
 * phone; the header is not sticky), give or take a pixel's rounding.
 */
const SYNONYMS_LINK_TOP = 24;
/** Explore's Synonyms panel is open: its element shown, its rows in it. */
const SYNONYMS_OPEN = `(() => { const panel = document.getElementById('synonyms'); return !!panel && !panel.hidden && panel.querySelector('a') !== null; })()`;
/**
 * Follows a `#synonyms` link inside the app, as the quiz's "Compare synonyms" does (no page
 * load), and checks Explore opened on Synonyms, at the top of the screen once the page has settled.
 */
async function checkSynonymsLink(tab: Tab, app: string, width: number): Promise<void> {
    await tab.goto(`${app}/vocab`, 'Vocabulary');
    await tab.evaluate(`(() => {
        history.pushState({}, '', '/vocab/${SYNONYMS_LINK_WORD}#synonyms');
        dispatchEvent(new PopStateEvent('popstate'));
    })()`);
    try {
        await tab.until(`${SYNONYMS_OPEN} && document.body.innerText.includes('Examples')`, 'Explore open on Synonyms under the examples', 10000);
    } catch {
        failures.push(`${width}px srs /vocab/${SYNONYMS_LINK_WORD}#synonyms: Explore did not open on Synonyms`);
        return;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    const top = await tab.evaluate<number | null>(`document.getElementById('explore')?.getBoundingClientRect().top ?? null`);
    if (top === null) failures.push(`${width}px srs /vocab/${SYNONYMS_LINK_WORD}#synonyms: no Explore section`);
    else if (Math.abs(top - SYNONYMS_LINK_TOP) > 2) failures.push(`${width}px srs /vocab/${SYNONYMS_LINK_WORD}#synonyms, followed inside the app: Explore's top is at ${Math.round(top)}px, not ${SYNONYMS_LINK_TOP}px`);
}

/** Opens every meaning and every row of the open Synonyms panel: its longest state. */
const EXPAND_SYNONYMS = `(async () => {
    const more = () => [...document.querySelectorAll('#synonyms button')].filter(b => /^Show (all .* for this meaning|\\d+ more meanings?)$/.test(b.textContent.trim()));
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
        const descriptions = [...document.querySelectorAll('#synonyms a .type-support')];
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

/**
 * Explore's segment labels are short so four fit at 320px: one cut off with an ellipsis is a
 * failure naming it. Measured closed and with Synonyms open (its label then semibold). Finding
 * fewer than four labels is a failure too: the page measured must show every segment.
 */
async function checkExploreLabels(tab: Tab, page: string, width: number): Promise<void> {
    const { found, clipped, crowded } = await tab.evaluate<{ found: number; clipped: string[]; crowded: string[] }>(`(() => {
        const labels = [...document.querySelectorAll('[role=group][aria-label="Explore this word"] [data-segment-label]')];
        const inset = el => {
            const label = el.getBoundingClientRect();
            const segment = el.closest('button').getBoundingClientRect();
            return Math.min(label.left - segment.left, segment.right - label.right);
        };
        return {
            found: labels.length,
            clipped: labels.filter(el => el.scrollWidth > el.clientWidth).map(el => el.textContent),
            crowded: labels.filter(el => inset(el) < ${EXPLORE_LABEL_INSET}).map(el => el.textContent + ' (' + inset(el).toFixed(1) + 'px)'),
        };
    })()`);
    if (found < 4) failures.push(`${width}px ${page}: ${found} Explore segment labels found, not 4: the check measured too little`);
    for (const label of clipped) failures.push(`${width}px ${page}: the Explore segment label "${label}" is cut off`);
    for (const label of crowded) failures.push(`${width}px ${page}: the Explore segment label ${label} sits under ${EXPLORE_LABEL_INSET}px from its segment's edge`);
}

/**
 * Explore's segments are sized by their labels, so a long one ("Sentences") is never pressed
 * against its dividers while a short one has room to spare: each label sits at least
 * EXPLORE_LABEL_INSET px inside its segment, on both sides.
 */
const EXPLORE_LABEL_INSET = 4;

/** Each Explore segment's left edge and width, in order, to compare across a press. */
const EXPLORE_SEGMENT_RECTS = `[...document.querySelectorAll('[role=group][aria-label="Explore this word"] > button')].map(el => { const r = el.getBoundingClientRect(); return { left: r.left, width: r.width }; })`;

/**
 * Presses an Explore segment and fails when any segment moved or changed width by more than
 * half a pixel: a segment is sized by its semibold label in every state, so pressing one (its
 * label turning semibold) never shifts the dividers.
 */
async function pressExploreSegmentStill(tab: Tab, page: string, width: number, segment: string): Promise<void> {
    type Rect = { left: number; width: number };
    const before = await tab.evaluate<Rect[]>(EXPLORE_SEGMENT_RECTS);
    await tab.click(segment);
    const after = await tab.evaluate<Rect[]>(EXPLORE_SEGMENT_RECTS);
    if (before.length === 0) failures.push(`${width}px ${page}: no Explore segments found: the check measured nothing`);
    else if (before.length !== after.length) failures.push(`${width}px ${page}: ${before.length} Explore segments before pressing ${segment}, ${after.length} after`);
    before.forEach((rect, i) => {
        const moved = Math.max(Math.abs(rect.left - (after[i]?.left ?? rect.left)), Math.abs(rect.width - (after[i]?.width ?? rect.width)));
        if (moved > 0.5) failures.push(`${width}px ${page}: Explore segment ${i + 1} moved ${moved.toFixed(1)}px when ${segment} was pressed`);
    });
}

/**
 * Learns the word on the open page, through its "Learn this word", and waits for Your study. A
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
        await tab.until(`[...document.querySelectorAll('h2, h3')].some(el => el.textContent.trim() === 'Your study')`, 'Your study', 5000);
    } catch {
        failures.push(`${width}px ${page}: "Learn this word" did not bring up Your study`);
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
        const status = document.querySelector('h1')?.closest('header')?.querySelector('p.type-support');
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
    await desktop.goto(`http://127.0.0.1:${srs.port}/vocab/${MIXUP_WORD}`, 'Explore');
    if (await learnOpenWord(desktop, `srs /vocab/${MIXUP_WORD}`, DESKTOP.width)) await checkHeaderStatus(desktop, `srs /vocab/${MIXUP_WORD}, studied`, DESKTOP.width);
    await pressExploreSegmentStill(desktop, `srs /vocab/${MIXUP_WORD}`, DESKTOP.width, 'Synonyms');
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
        await measureFuriganaFixture(tab, `${app}/vocab/${FURIGANA_VOCAB}`, 'Examples', `srs /vocab/${FURIGANA_VOCAB}`, width);
        await tab.click('Sentences');
        await tab.until(`document.body.innerText.includes('Shortest first')`, 'the Sentences panel');
        await measure(tab, `srs /vocab/${FURIGANA_VOCAB}, sentences panel`, width);
        await tab.evaluate<void>(SEED_MIXUPS);
        await tab.goto(`${app}/vocab/${MIXUP_WORD}`, 'Explore');
        // Learned here, so Your study's phone grid is measured on a word that has it.
        if (await learnOpenWord(tab, `srs /vocab/${MIXUP_WORD}`, width)) await measure(tab, `srs /vocab/${MIXUP_WORD}, studied, Explore closed`, width);
        await checkExploreLabels(tab, `srs /vocab/${MIXUP_WORD}, Explore closed`, width);
        await tab.click('Mix-ups');
        await tab.until(`document.body.innerText.includes('Show all mix-ups')`, 'the Mix-ups panel');
        await tab.click('Show all mix-ups');
        await measure(tab, `srs /vocab/${MIXUP_WORD}, mix-ups panel`, width);
        await pressExploreSegmentStill(tab, `srs /vocab/${MIXUP_WORD}`, width, 'Synonyms');
        await tab.until(`document.body.innerText.includes('Mixed up 2 times')`, 'the Synonyms panel counting the seeded mix-ups');
        await measure(tab, `srs /vocab/${MIXUP_WORD}, synonyms panel`, width);
        await checkExploreLabels(tab, `srs /vocab/${MIXUP_WORD}, synonyms panel`, width);
        await tab.goto(`${app}/vocab/${LONG_SYNONYMS_WORD}`, 'Explore');
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, Explore closed`, width);
        await tab.click('Synonyms');
        await tab.until(SYNONYMS_OPEN, 'the Synonyms panel');
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms panel`, width);
        await checkSynonymDescriptions(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms panel`, width);
        const unopened = await tab.evaluate<number>(EXPAND_SYNONYMS);
        if (unopened > 0) failures.push(`${width}px srs /vocab/${LONG_SYNONYMS_WORD}: ${unopened} "Show ..." buttons left in the Synonyms panel after opening everything`);
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms panel, every meaning`, width);
        await checkSynonymDescriptions(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, synonyms panel, every meaning`, width);
        await tab.click('Related');
        await tab.until(`document.body.innerText.includes('Used in')`, 'the Related panel');
        await measure(tab, `srs /vocab/${LONG_SYNONYMS_WORD}, related panel`, width);
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
    dictionary.server.close();
}

if (failures.length) {
    for (const failure of failures) console.error(`[check-layout] ${failure}`);
    fail(`${failures.length} layout problem(s) in ${checked} pages. See docs/DESIGN_SYSTEM.md; fix the page, never the check.`);
}
console.log(`[check-layout] ${checked} pages at ${VIEWPORTS.map(v => `${v.width}px`).join(' and ')}: no sideways scroll, nothing under 12px, inputs 16px, tap targets 44px, sentence words not underlined or spaced apart, furigana over kanji, on one line and apart, Japanese in list rows unbroken, setup's decisions above the kanji grid and a way back to them from its end, the four Explore labels whole and clear of their dividers, the segments still when one is pressed, Your study's phone grid on a studied word, its header status on one line at 1280px, a #synonyms link opening Explore on Synonyms at the top of the screen, its rows' shared senses wrapped, not cut off.`);
