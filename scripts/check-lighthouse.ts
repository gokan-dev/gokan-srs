/**
 * Lighthouse over both production builds, served locally the way CloudFront serves them
 * (scripts/lib/builtSite.ts): the SRS at `/`, the dictionary under `/dictionary/`. One
 * representative page per dictionary type and the SRS welcome page (cold, as a crawler first meets
 * them), plus the SRS hub and anime list reached with onboarding seeded into localStorage, on
 * mobile and desktop.
 *
 * The gate the dictionary exists for: SEO at 100 on every dictionary page and the SRS welcome,
 * failing the job below it. The dictionary also holds accessibility and best practices at a floor
 * taken from the first baseline and only ever raised (DICTIONARY_FLOORS). Every SRS page holds
 * accessibility at 1.00 (SRS_FLOORS, SRS_ONBOARDED_FLOORS); the hub and anime list are otherwise
 * recorded: they are image-heavy (cover art from AniList's CDN) and measured to track that cost.
 * Files are brotli-compressed as CloudFront serves them (scripts/lib/builtSite.ts).
 * Performance is recorded everywhere, never floored: it still moves between runs.
 *
 * Every SRS run is also read for its network list (`network-requests`): no dataset file is
 * downloaded twice in one page load (the loaders share one in-flight request, `RequestCache` in
 * services/http.ts), and the anime list asks for its own files before the study flow's background
 * loads (`PageRenderedSignal`, inside the routes' Suspense boundary). Both fail the job on any run. Each category is
 * the median of a page's runs (SRS_RUNS, DICTIONARY_RUNS), and the report kept is the run with the
 * median performance.
 *
 * Usage: build both apps (`bun run build`, `bun run dictionary:build`), then
 * `bun run check:lighthouse`. Needs Chrome (found like scripts/lib/chrome.ts) and runs Lighthouse
 * (the pinned devDependency) under `node`, so Node must be on PATH. LH_RUNS (runs for every page),
 * LH_FORM_FACTORS and LH_ONLY (a label substring) tune a local run. Run by CI
 * (.github/workflows/ci-lighthouse.yml), which keeps the reports.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildMissing, dictionaryPages, serveBoth } from './lib/builtSite';
import { launchChrome, type Chrome } from './lib/chrome';

/** The pinned Lighthouse CLI (a devDependency), run under Node so its audit weights never shift under a PR. */
const LIGHTHOUSE_CLI = join('node_modules', 'lighthouse', 'cli', 'index.js');
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
type Category = (typeof CATEGORIES)[number];
const FORM_FACTORS = ['mobile', 'desktop'] as const;
type FormFactor = (typeof FORM_FACTORS)[number];

/**
 * Runs per page. The SRS pages' performance moved by up to 20 points between single runs of the
 * same code (the welcome page scored 64, then 83), so they take the median of three; the
 * dictionary's static pages hold within a point or two and take one (#134).
 */
const SRS_RUNS = 3;
const DICTIONARY_RUNS = 1;
const RUNS_OVERRIDE = process.env.LH_RUNS === undefined ? null : Number(process.env.LH_RUNS);
const ACTIVE_FORM_FACTORS: readonly FormFactor[] = (process.env.LH_FORM_FACTORS?.split(',') ?? FORM_FACTORS)
    .map(value => value.trim())
    .filter((value): value is FormFactor => (FORM_FACTORS as readonly string[]).includes(value));
/** A local knob: measure only the targets whose label contains this (e.g. LH_ONLY=dictionary). */
const ONLY = process.env.LH_ONLY?.trim();

const SEO_FLOOR = 1;
/**
 * Floors per page, read off the first green baseline and only ever raised. A category absent here
 * is recorded but not gated (performance, everywhere; best practices on the SRS pages). The
 * dictionary holds accessibility at 1.00 on every page type since links in running text gained an
 * underline (gokan-dev/gokan-srs#128, "links distinguishable by colour alone"); the SRS pages since
 * the app's did too, and the welcome page's headings and watermark were fixed (#134).
 */
const DICTIONARY_FLOORS: Partial<Record<Category, number>> = { seo: SEO_FLOOR, accessibility: 1, 'best-practices': 1 };
const SRS_FLOORS: Partial<Record<Category, number>> = { seo: SEO_FLOOR, accessibility: 1 };
/** The onboarded SRS pages (hub, anime list): accessibility only, see the header. */
const SRS_ONBOARDED_FLOORS: Partial<Record<Category, number>> = { accessibility: 1 };

const REPORT_DIR = join(process.cwd(), 'lighthouse-report');

function fail(message: string): never {
    console.error(`[check-lighthouse] ${message}`);
    process.exit(1);
}

const missing = buildMissing();
if (missing) fail(missing);
if (RUNS_OVERRIDE !== null && (!Number.isInteger(RUNS_OVERRIDE) || RUNS_OVERRIDE < 1)) fail(`LH_RUNS must be a positive integer, got "${process.env.LH_RUNS}".`);
if (ACTIVE_FORM_FACTORS.length === 0) fail(`LH_FORM_FACTORS named no known form factor (${FORM_FACTORS.join(', ')}).`);

// -- Reading a Lighthouse report without trusting its shape --------------------------------------

const asRecord = (value: unknown): Record<string, unknown> =>
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

function categoryScore(report: Record<string, unknown>, category: Category): number | null {
    const found = asRecord(asRecord(report.categories)[category]).score;
    return typeof found === 'number' ? found : null;
}

/** The audits a category failed, by title: what a reader opens the report to see named. */
function failedAudits(report: Record<string, unknown>, category: Category): string[] {
    const refs = asRecord(asRecord(report.categories)[category]).auditRefs;
    const audits = asRecord(report.audits);
    const names: string[] = [];
    for (const refValue of Array.isArray(refs) ? refs : []) {
        const id = asRecord(refValue).id;
        if (typeof id !== 'string') continue;
        const audit = asRecord(audits[id]);
        if (typeof audit.score === 'number' && audit.score < 1) {
            names.push(typeof audit.title === 'string' ? audit.title : id);
        }
    }
    return names;
}

/** A request's path and when the page issued it (ms), from the `network-requests` audit. */
interface NetworkRequest { path: string; startTime: number }

function networkRequests(report: Record<string, unknown>): NetworkRequest[] {
    const items = asRecord(asRecord(asRecord(report.audits)['network-requests']).details).items;
    const requests: NetworkRequest[] = [];
    for (const itemValue of Array.isArray(items) ? items : []) {
        const item = asRecord(itemValue);
        if (typeof item.url !== 'string' || typeof item.rendererStartTime !== 'number') continue;
        // The path alone: the `?v=` dataset version is the same file.
        requests.push({ path: new URL(item.url).pathname, startTime: item.rendererStartTime });
    }
    return requests;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// -- Running Lighthouse --------------------------------------------------------------------------

/**
 * Async on purpose: the static server runs in this process, so a blocking spawn would freeze the
 * event loop and starve Lighthouse of the page it is trying to load. Lighthouse runs in a
 * child `node` process, so Bun's loop stays free to serve.
 */
function runLighthouse(url: string, formFactor: FormFactor, outPath: string, port?: number): Promise<Record<string, unknown>> {
    const args = [
        LIGHTHOUSE_CLI, url,
        `--only-categories=${CATEGORIES.join(',')}`,
        '--output=json', `--output-path=${outPath}`,
        // With a port Lighthouse drives an already-seeded Chrome, keeping its localStorage; otherwise it launches its own.
        ...(port ? [`--port=${port}`, '--disable-storage-reset'] : ['--chrome-flags=--headless=new --no-sandbox --disable-gpu --hide-scrollbars']),
        '--quiet', '--max-wait-for-load=60000',
        ...(formFactor === 'desktop' ? ['--preset=desktop'] : []),
    ];
    return new Promise(resolve => {
        const child = spawn('node', args, { stdio: ['ignore', 'ignore', 'inherit'] });
        child.on('error', error => fail(`Could not run Lighthouse (${error.message}). Is Node on PATH?`));
        child.on('close', code => {
            if (code !== 0) fail(`Lighthouse exited ${code ?? 'with a signal'} on ${formFactor} ${url}.`);
            resolve(asRecord(JSON.parse(readFileSync(outPath, 'utf8')) as unknown));
        });
    });
}

const slug = (label: string) => label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

/**
 * One report per page and form factor, under its plain name (`<base>.json`): the run whose
 * performance is the median, so the report a reader opens shows the figure the table printed.
 * The other runs' files are removed.
 */
function keepMedianReport(base: string, runs: Record<string, unknown>[], medianPerformance: number | null): void {
    const distance = (report: Record<string, unknown>) => Math.abs((categoryScore(report, 'performance') ?? 0) - (medianPerformance ?? 0));
    const kept = runs.reduce((best, report, index) => (distance(report) < distance(runs[best]) ? index : best), 0);
    for (let index = 0; index < runs.length; index++) {
        const path = `${base}.run${index + 1}.json`;
        if (index === kept) renameSync(path, `${base}.json`);
        else rmSync(path, { force: true });
    }
}

/** Dataset files sit under this path (`datasetUrl()` in apps/gokan-srs/src/services/http.ts). */
const DATASET_PREFIX = '/data/compiled/';

/** Files a page needs (`first`) issued before a file only the study flow's background loads need (`then`). */
interface LoadOrder { first: string[]; then: string }

interface Target {
    url: string; label: string; floors: Partial<Record<Category, number>>; mode: 'cold' | 'onboarded'; runs: number;
    /** SRS pages: each dataset file is requested at most once per page load. */
    singleDownloads?: true;
    loadOrder?: LoadOrder;
}
interface Result { target: Target; formFactor: FormFactor; scores: Record<Category, number | null>; reports: Record<string, unknown>[] }

/**
 * The onboarded SRS pages live behind the setup gate (`isSetupComplete` is `!!progress`), so the
 * hub and anime list only render once localStorage carries a progress object. Seeding an empty one
 * is enough; Lighthouse then audits the same origin with `--disable-storage-reset` and sees it.
 */
async function seedOnboarding(chrome: Chrome, origin: string): Promise<void> {
    const tab = await chrome.openTab(1280, 900, false);
    try {
        await tab.goto(`${origin}/`, 'I already know some kanji');
        await tab.evaluate<void>(`localStorage.setItem('GOKAN_SRS_PROGRESS', '{}')`);
        await tab.goto(`${origin}/`, 'Study'); // the hub; also proves the seed took
    } finally {
        await tab.close();
    }
}

async function main(): Promise<void> {
    const { server, port } = await serveBoth();
    const origin = `http://127.0.0.1:${port}`;
    const srsRuns = RUNS_OVERRIDE ?? SRS_RUNS;
    const dictionaryRuns = RUNS_OVERRIDE ?? DICTIONARY_RUNS;
    const allTargets: Target[] = [
        { url: `${origin}/`, label: 'srs welcome', floors: SRS_FLOORS, mode: 'cold', runs: srsRuns, singleDownloads: true },
        ...dictionaryPages().map(page => ({ url: `${origin}/dictionary${page.path}`, label: `dictionary ${page.path}`, floors: DICTIONARY_FLOORS, mode: 'cold' as const, runs: dictionaryRuns })),
        { url: `${origin}/`, label: 'srs hub', floors: SRS_ONBOARDED_FLOORS, mode: 'onboarded', runs: srsRuns, singleDownloads: true },
        {
            url: `${origin}/listening`, label: 'srs anime list', floors: SRS_ONBOARDED_FLOORS, mode: 'onboarded', runs: srsRuns, singleDownloads: true,
            loadOrder: { first: ['media/index.json', 'media/library.json'], then: 'index/frequency.json' },
        },
    ];
    const targets = ONLY ? allTargets.filter(target => target.label.includes(ONLY)) : allTargets;
    if (targets.length === 0) fail(`LH_ONLY="${ONLY}" matched no target.`);

    rmSync(REPORT_DIR, { recursive: true, force: true });
    mkdirSync(REPORT_DIR, { recursive: true });

    const results: Result[] = [];
    let chrome: Chrome | null = null;
    try {
        if (targets.some(target => target.mode === 'onboarded')) {
            chrome = await launchChrome().catch((error: unknown): never => fail(error instanceof Error ? error.message : String(error)));
            await seedOnboarding(chrome, origin);
        }
        for (const formFactor of ACTIVE_FORM_FACTORS) {
            for (const target of targets) {
                let onboardedPort: number | undefined;
                if (target.mode === 'onboarded') {
                    if (!chrome) fail('onboarded target reached without a seeded browser');
                    onboardedPort = chrome.debugPort;
                }
                const base = join(REPORT_DIR, `${slug(target.label)}.${formFactor}`);
                const runs: Record<string, unknown>[] = [];
                for (let run = 0; run < target.runs; run++) runs.push(await runLighthouse(target.url, formFactor, `${base}.run${run + 1}.json`, onboardedPort));
                const scores = Object.fromEntries(CATEGORIES.map(category => {
                    const values = runs.map(report => categoryScore(report, category)).filter((v): v is number => v !== null);
                    return [category, values.length ? median(values) : null];
                })) as Record<Category, number | null>;
                keepMedianReport(base, runs, scores.performance);
                results.push({ target, formFactor, scores, reports: runs });
            }
        }
    } finally {
        if (chrome) await chrome.kill();
        server.close();
    }

    report(results);
}

// -- The verdict ---------------------------------------------------------------------------------

/** What a run's network list breaks of its target's rules, one line per problem. */
function networkFailures(target: Target, report: Record<string, unknown>): string[] {
    const requests = networkRequests(report);
    const failures: string[] = [];
    if (target.singleDownloads) {
        const counts = new Map<string, number>();
        for (const { path } of requests) {
            if (path.startsWith(DATASET_PREFIX)) counts.set(path, (counts.get(path) ?? 0) + 1);
        }
        for (const [path, count] of counts) {
            if (count > 1) failures.push(`${path} requested ${count} times in one page load`);
        }
    }
    if (target.loadOrder) {
        const startOf = (file: string) => requests.find(request => request.path === `${DATASET_PREFIX}${file}`)?.startTime;
        const then = startOf(target.loadOrder.then);
        for (const file of target.loadOrder.first) {
            const start = startOf(file);
            if (start === undefined) failures.push(`${file} was never requested`);
            else if (then !== undefined && start > then) failures.push(`${file} issued after ${target.loadOrder.then}`);
        }
    }
    return failures;
}

const asPercent = (score: number | null) => (score === null ? '  -' : `${Math.round(score * 100)}`.padStart(3));

function report(results: Result[]): void {
    const failures: string[] = [];
    for (const formFactor of ACTIVE_FORM_FACTORS) {
        console.log(`\n[check-lighthouse] ${formFactor}, median of each page's runs  perf  a11y   bp  seo  runs`);
        for (const { target, formFactor: ff, scores, reports } of results) {
            if (ff !== formFactor) continue;
            const row = CATEGORIES.map(category => asPercent(scores[category])).join('  ');
            console.log(`  ${target.label.padEnd(34)} ${row}  ${String(reports.length).padStart(4)}`);
        }
    }

    for (const { target, formFactor, scores, reports } of results) {
        for (const category of CATEGORIES) {
            const floor = target.floors[category];
            const score = scores[category];
            if (floor === undefined || score === null || score >= floor) continue;
            // Name audits from the run that actually dragged the median down, not whichever ran last.
            const worst = reports.reduce((low, report) => ((categoryScore(report, category) ?? 1) < (categoryScore(low, category) ?? 1) ? report : low));
            const named = failedAudits(worst, category);
            const detail = named.length ? ` (failed: ${named.join('; ')})` : '';
            failures.push(`${formFactor} ${target.label}: ${category} ${asPercent(score).trim()} < ${Math.round(floor * 100)}${detail}`);
        }
    }

    for (const { target, formFactor, reports } of results) {
        reports.forEach((report, run) => {
            for (const problem of networkFailures(target, report)) failures.push(`${formFactor} ${target.label}, run ${run + 1}: ${problem}`);
        });
    }

    if (failures.length) {
        for (const failure of failures) console.error(`[check-lighthouse] ${failure}`);
        fail(`${failures.length} problem(s): audits below floor or dataset requests out of rule. Reports in ${REPORT_DIR}. Fix the page, never the check (SEO stays at 100).`);
    }
    console.log(`\n[check-lighthouse] ${results.length} page-runs clean: SEO 100, accessibility and best practices at or above baseline, each dataset file downloaded once. Reports in ${REPORT_DIR}.`);
}

await main();
