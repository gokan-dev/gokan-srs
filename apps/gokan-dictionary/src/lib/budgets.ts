// The dictionary's size budgets (docs/DESIGN_SYSTEM.md, Dictionary, Budgets): what each page type
// and asset may weigh, in every locale (a Chinese word page is a word page, a Chinese JLPT list a
// JLPT list), checked after every build by scripts/check-build.ts, which fails the build when one
// is exceeded. A budget is a decision about what the site costs a reader on a phone; raise one
// deliberately, in the docs, never to make a build pass.
//
// Sizes are what a reader downloads: brotli, as CloudFront compresses (#268). The page budgets are
// the 14 KB rule: a new TCP connection sends about 14.6 KB before it waits for an acknowledgement
// (RFC 6928's initial window), so a page's HTML within about 13 KB (less headers and margin)
// arrives in one round trip. A long list page is held to it up to the end of its first screen
// (FIRST_SCREEN_ROWS), not split. The blocking stylesheets come in the next window (about 14 KB).
// The scripts and the search index load past the first screen: their budgets are regression
// guards, about 25% over what they measured, not design limits.

const KB = 1024;

/** How a budget counts: brotli (what CloudFront sends), or raw for a file already compressed (woff2). */
type Encoding = 'brotli' | 'raw';

interface Budget {
    bytes: number;
    encoding: Encoding;
}

/** The 14 KB rule's HTML budget: 14,600 bytes of initial window, less about 0.5 KB of headers and a margin. */
const FIRST_ROUND_TRIP = 13 * KB;

const brotli = (bytes: number): Budget => ({ bytes, encoding: 'brotli' });

export const BUDGETS = {
    /** A word page, 90th percentile. */
    wordPageP90: brotli(FIRST_ROUND_TRIP),
    /**
     * The heaviest kanji page: the tightest budget, 人 at 12.9 KB on 2026-11-22 (一 lists the most
     * words, 660, but compresses better). A kanji's Words section is what to trim first.
     */
    kanjiPageMax: brotli(FIRST_ROUND_TRIP),
    /** The heaviest grammar point page: its curated examples, up to 25 from the corpus, its related points. */
    grammarPageMax: brotli(FIRST_ROUND_TRIP),
    /** The home page. */
    homePage: brotli(FIRST_ROUND_TRIP),
    /** `/grammar/`, to the end of its first screen. */
    grammarIndex: brotli(FIRST_ROUND_TRIP),
    /** Each page of a JLPT word list, to the end of its first screen. */
    jlptPage: brotli(FIRST_ROUND_TRIP),
    /**
     * Each kanji order page, to the end of its first screen: the orders hub, an order, and a range
     * of 100 steps with the words they unlock (the heaviest, held by WORDS_PER_KANJI in lib/kanjiOrders.ts).
     */
    kanjiOrderPage: brotli(FIRST_ROUND_TRIP),
    /** The stylesheets a page links (app.scss, its page sheet, its locale's), together: the second window. */
    blockingStylesheets: brotli(14 * KB),
    /** The search script every page loads (#228: it carries every locale's words and links). */
    searchScript: brotli(7 * KB),
    /** A detail page's tabs and section search (client/detailTabs.ts), on the pages that link it. */
    detailScript: brotli(5 * KB),
    /** The clip player (client/player.ts), on the pages with a play button. */
    playerScript: brotli(1 * KB),
    /** The query engine it loads on first focus, with the index: the matcher both apps share (#264). */
    searchEngine: brotli(7 * KB),
    /** search-core.json. */
    searchCore: brotli(415 * KB),
    /** The one web font, a woff2: compressed already, so CloudFront sends it as it is. */
    webFont: { bytes: 40 * KB, encoding: 'raw' },
} as const satisfies Record<string, Budget>;

export type BudgetName = keyof typeof BUDGETS;

/**
 * How many list rows (`<li>` inside `<main>`, in document order) a list page's first screen holds
 * at 375x812: the budget counts its HTML up to the end of that row (firstScreen). Measured in a
 * browser by `check:layout`, which fails when the rows no longer reach the screen's end (a page
 * whose first screen then holds more), so the prefix always covers the first screen. A page with
 * fewer rows is counted whole.
 */
export const FIRST_SCREEN_ROWS = {
    // Measured 2026-11-22 (#268): 3 grammar points, 6 to 7 words of a JLPT list, 1 to 7 rows or
    // tiles of an order page. Counts above them only make the budget stricter.
    grammarIndex: 5,
    jlptPage: 10,
    kanjiOrderPage: 10,
} as const satisfies Partial<Record<BudgetName, number>>;

type FirstScreenBudget = keyof typeof FIRST_SCREEN_ROWS;

/** The rows a budget counts a page to, if it is a list page's (FIRST_SCREEN_ROWS); null for a page counted whole. */
export function firstScreenRowsOf(budget: BudgetName): number | null {
    return budget in FIRST_SCREEN_ROWS ? FIRST_SCREEN_ROWS[budget as FirstScreenBudget] : null;
}

/** The list page budget a page path (`/grammar/`, `/zh-hans/vocab/jlpt-n5/2/`) is held to on its first screen, if any. */
export function firstScreenBudgetOf(pagePath: string): FirstScreenBudget | null {
    const path = pagePath.replace(/^\/zh-hans(?=\/)/, '');
    if (path === '/grammar/') return 'grammarIndex';
    if (/^\/vocab\/jlpt-n\d\/(\d+\/)?$/.test(path)) return 'jlptPage';
    if (path.startsWith('/kanji/orders/')) return 'kanjiOrderPage';
    return null;
}

/** A page's HTML up to the end of its `rows`-th list row inside `<main>`: the whole page when it has fewer. */
export function firstScreen(html: string, rows: number): string {
    let at = html.indexOf('<main');
    if (at === -1) return html;
    for (let row = 0; row < rows; row++) {
        const end = html.indexOf('</li>', at);
        if (end === -1) return html;
        at = end + '</li>'.length;
    }
    return html.slice(0, at);
}

export interface Measurement {
    budget: BudgetName;
    /** What was measured, for the report: a file or a page. */
    subject: string;
    raw: number;
    brotli: number;
}

/** What a measurement counts against its budget. */
export const countedBytes = (m: Measurement): number => m[BUDGETS[m.budget].encoding];

/** The value at percentile `p` (0 to 100) of `values`, nearest rank; 0 for none. */
export function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const rank = Math.ceil((p / 100) * sorted.length);
    return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}

export function overBudget(measurements: Measurement[]): Measurement[] {
    return measurements.filter(m => countedBytes(m) > BUDGETS[m.budget].bytes);
}

/** "3.7 KB brotli of 13 KB (16.8 KB raw)": one report line's figures. */
export function describe(measurement: Measurement): string {
    const kb = (bytes: number) => `${(bytes / KB).toFixed(1).replace(/\.0$/, '')} KB`;
    const { bytes, encoding } = BUDGETS[measurement.budget];
    const other = encoding === 'brotli' ? ` (${kb(measurement.raw)} raw)` : '';
    return `${measurement.budget}: ${measurement.subject} ${kb(countedBytes(measurement))} ${encoding} of ${kb(bytes)}${other}`;
}
