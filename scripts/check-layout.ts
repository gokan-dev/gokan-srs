/**
 * The layout rules no static check can see (AGENTS.md, Design rules; docs/DESIGN_SYSTEM.md),
 * measured in a real browser on both production builds at phone widths (320 and 375px):
 *
 * - no page scrolls sideways;
 * - no text below the 12px floor (furigana, in `rt`, and SVG chart labels excepted);
 * - every text input is at least 16px, or iOS zooms into it on focus;
 * - the dictionary's nav links, pager links, toggles, tiles and disclosure summaries are at
 *   least 44px tall;
 * - a word in a dictionary sentence (`.sentence-jp a`) has no text underline: the running-text
 *   underline on `p a` must not stack on its dotted border.
 *
 * Usage: build both apps (`bun run --cwd apps/gokan-srs build`, `bun run --cwd
 * apps/gokan-dictionary build`), then `bun run check:layout`. Needs Chrome or Chromium: found at
 * the usual paths, or named by CHROME_PATH. Run by CI (.github/workflows/ci-layout.yml).
 *
 * Chrome is driven over the DevTools protocol with Bun's own WebSocket: Playwright's transports
 * do not work under Bun on Windows, and this needs nothing installed.
 */
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
    const spaced = [...document.querySelectorAll('[data-sentence] > *')].filter(el => visible(el) && parseFloat(getComputedStyle(el).marginLeft) + parseFloat(getComputedStyle(el).marginRight) > 0);
    if (spaced.length) problems.push('sentence word has a side margin (reads as a space in Japanese): ' + spaced.slice(0, 3).map(describe).join(', '));
    return problems;
})()`;

const DICTIONARY_TAP_TARGETS = '.site-nav a, .pager a, summary, .kanji-tiles a, button.button';

const failures: string[] = [];
let checked = 0;
async function measure(tab: Tab, page: string, width: number, tapTargets = ''): Promise<void> {
    checked++;
    for (const problem of await tab.evaluate<string[]>(MEASURE(width, tapTargets))) failures.push(`${width}px ${page}: ${problem}`);
}

const DICTIONARY_PAGES = dictionaryPages();
const SRS_ROUTES = srsRoutes();
const [COMPLETED_TITLE, WATCHING_TITLE] = listeningTitlesToMark();

try {
    for (const { width, height } of VIEWPORTS) {
        const tab = await chrome.openTab(width, height);
        const app = `http://127.0.0.1:${srs.port}`;
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
console.log(`[check-layout] ${checked} pages at ${VIEWPORTS.map(v => `${v.width}px`).join(' and ')}: no sideways scroll, nothing under 12px, inputs 16px, tap targets 44px, sentence words not underlined or spaced apart.`);
