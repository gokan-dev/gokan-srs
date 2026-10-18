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
 * - About before setup shows a visible dictionary link, in a footer aligned with the header;
 * - furigana sits over kanji only, never over kana, no ruby (a run of kanji with its reading)
 *   breaks across lines, and no two readings on a line touch (word pages' example sentences, in each app).
 *
 * Usage: build both apps (`bun run --cwd apps/gokan-srs build`, `bun run --cwd
 * apps/gokan-dictionary build`), then `bun run check:layout`. Needs Chrome or Chromium: found at
 * the usual paths, or named by CHROME_PATH. Run by CI (.github/workflows/ci-layout.yml).
 *
 * Chrome is driven over the DevTools protocol with Bun's own WebSocket: Playwright's transports
 * do not work under Bun on Windows, and this needs nothing installed.
 */
import { KANJI_CHARS } from '@gokan/dataset-schema';
import { buildMissing, dictionaryFile, dictionaryPages, listeningTitlesToMark, serve, srsFile, srsRoutes } from './lib/builtSite';
import { launchChrome, type Tab } from './lib/chrome';

const VIEWPORTS = [{ width: 320, height: 720 }, { width: 375, height: 812 }];

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
const [COMPLETED_TITLE, WATCHING_TITLE] = listeningTitlesToMark();
// 登場人物: its sentences hold long readings that wrap at the end of a line at 320 and 375px, the
// case where a ruby broken across lines puts the wrong syllables over each kanji. A dataset
// fixture, not discovered from the build: when a dataset bump drops the word or its sentences,
// measureFuriganaFixture names it as the thing to update.
const FURIGANA_VOCAB = '1638880';
const FIXTURE_MOVED = `FURIGANA_VOCAB ${FURIGANA_VOCAB} has no example sentence with furigana: pick another word whose sentences wrap at 320px`;

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
        await tab.goto(`${app}/`, 'I already know some kanji');
        await measure(tab, 'srs /welcome', width);
        await tab.click('I already know some kanji');
        await tab.until(`document.body.innerText.includes('Kanji learning method')`, 'the setup screen');
        await measure(tab, 'srs /setup', width);
        await tab.click('More methods');
        await measure(tab, 'srs /setup, every method', width);
        await tab.click('Start learning');
        for (const route of SRS_ROUTES) {
            await tab.goto(`${app}${route.path}`, route.ready);
            await measure(tab, `srs ${route.path}`, width);
        }
        await measureFuriganaFixture(tab, `${app}/vocab/${FURIGANA_VOCAB}`, 'Example sentences', `srs /vocab/${FURIGANA_VOCAB}`, width);
        // The library's rows with a status line, the tightest rows on a phone.
        await tab.goto(`${app}/listening/${COMPLETED_TITLE}`, 'Mark all watched');
        await tab.click('Mark all watched');
        await tab.goto(`${app}/listening/${WATCHING_TITLE}`, 'Mark all watched');
        await tab.click('Mark watched');
        await tab.goto(`${app}/listening`, 'Watching ·');
        await tab.until(`document.body.innerText.includes('Completed')`, 'a completed title in the library');
        await measure(tab, 'srs /listening, watching and completed titles', width);
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
console.log(`[check-layout] ${checked} pages at ${VIEWPORTS.map(v => `${v.width}px`).join(' and ')}: no sideways scroll, nothing under 12px, inputs 16px, tap targets 44px, sentence words not underlined or spaced apart, furigana over kanji, on one line and apart.`);
