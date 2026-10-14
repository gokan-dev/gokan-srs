/**
 * Lighthouse over both production builds, served locally the way CloudFront serves them
 * (scripts/lib/builtSite.ts): the SRS at `/`, the dictionary under `/dictionary/`. One
 * representative page per dictionary type and the SRS welcome page (cold, as a crawler first meets
 * them), plus the SRS hub and anime list reached with onboarding seeded into localStorage, on
 * mobile and desktop.
 *
 * The gate the dictionary exists for: SEO at 100 on every dictionary page and the SRS welcome,
 * failing the job below it. The dictionary also holds accessibility and best practices at a floor
 * taken from the first baseline and only ever raised (DICTIONARY_FLOORS). The hub and anime list
 * are recorded, not gated: they are image-heavy (cover art from AniList's CDN) and measured to
 * track that cost. Performance is recorded everywhere, never floored, since a local build has none
 * of production's CDN compression or caching. Each category is the median of LH_RUNS runs (one by
 * default); raise LH_RUNS to smooth performance's run-to-run noise.
 *
 * Usage: build both apps (`bun run build`, `bun run dictionary:build`), then
 * `bun run check:lighthouse`. Needs Chrome (found like scripts/lib/chrome.ts) and runs Lighthouse
 * (the pinned devDependency) under `node`, so Node must be on PATH. LH_RUNS, LH_FORM_FACTORS and LH_ONLY (a label substring)
 * tune a local run. Run by CI (.github/workflows/ci-lighthouse.yml), which keeps the reports.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildMissing, dictionaryPages, serveBoth } from './lib/builtSite';
import { launchChrome, type Chrome } from './lib/chrome';

/** The pinned Lighthouse CLI (a devDependency), run under Node so its audit weights never shift under a PR. */
const LIGHTHOUSE_CLI = join('node_modules', 'lighthouse', 'cli', 'index.js');
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
type Category = (typeof CATEGORIES)[number];
const FORM_FACTORS = ['mobile', 'desktop'] as const;
type FormFactor = (typeof FORM_FACTORS)[number];

const RUNS = Number(process.env.LH_RUNS ?? '1');
const ACTIVE_FORM_FACTORS: readonly FormFactor[] = (process.env.LH_FORM_FACTORS?.split(',') ?? FORM_FACTORS)
    .map(value => value.trim())
    .filter((value): value is FormFactor => (FORM_FACTORS as readonly string[]).includes(value));
/** A local knob: measure only the targets whose label contains this (e.g. LH_ONLY=dictionary). */
const ONLY = process.env.LH_ONLY?.trim();

const SEO_FLOOR = 1;
/**
 * Floors per page, read off the first green baseline and only ever raised. A category absent here
 * is recorded but not gated (performance, everywhere; accessibility and best practices on the SRS
 * pages). The dictionary holds accessibility at 1.00 on every page type since links in running
 * text gained an underline (gokan-dev/gokan-srs#128, "links distinguishable by colour alone").
 */
const DICTIONARY_FLOORS: Partial<Record<Category, number>> = { seo: SEO_FLOOR, accessibility: 1, 'best-practices': 1 };
const SRS_FLOORS: Partial<Record<Category, number>> = { seo: SEO_FLOOR };
/** The onboarded SRS pages (hub, anime list) are recorded, not gated: see the header. */
const RECORDED_ONLY: Partial<Record<Category, number>> = {};

const REPORT_DIR = join(process.cwd(), 'lighthouse-report');

function fail(message: string): never {
    console.error(`[check-lighthouse] ${message}`);
    process.exit(1);
}

const missing = buildMissing();
if (missing) fail(missing);
if (!Number.isInteger(RUNS) || RUNS < 1) fail(`LH_RUNS must be a positive integer, got "${process.env.LH_RUNS}".`);
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

interface Target { url: string; label: string; floors: Partial<Record<Category, number>>; mode: 'cold' | 'onboarded' }
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
    const allTargets: Target[] = [
        { url: `${origin}/`, label: 'srs welcome', floors: SRS_FLOORS, mode: 'cold' },
        ...dictionaryPages().map(page => ({ url: `${origin}/dictionary${page.path}`, label: `dictionary ${page.path}`, floors: DICTIONARY_FLOORS, mode: 'cold' as const })),
        { url: `${origin}/`, label: 'srs hub', floors: RECORDED_ONLY, mode: 'onboarded' },
        { url: `${origin}/listening`, label: 'srs anime list', floors: RECORDED_ONLY, mode: 'onboarded' },
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
                const outPath = join(REPORT_DIR, `${slug(target.label)}.${formFactor}.json`);
                const runs: Record<string, unknown>[] = [];
                for (let run = 0; run < RUNS; run++) runs.push(await runLighthouse(target.url, formFactor, outPath, onboardedPort));
                const scores = Object.fromEntries(CATEGORIES.map(category => {
                    const values = runs.map(report => categoryScore(report, category)).filter((v): v is number => v !== null);
                    return [category, values.length ? median(values) : null];
                })) as Record<Category, number | null>;
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

const asPercent = (score: number | null) => (score === null ? '  -' : `${Math.round(score * 100)}`.padStart(3));

function report(results: Result[]): void {
    const failures: string[] = [];
    for (const formFactor of ACTIVE_FORM_FACTORS) {
        console.log(`\n[check-lighthouse] ${formFactor}, median of ${RUNS} run(s)   perf  a11y   bp  seo`);
        for (const { target, formFactor: ff, scores } of results) {
            if (ff !== formFactor) continue;
            const row = CATEGORIES.map(category => asPercent(scores[category])).join('  ');
            console.log(`  ${target.label.padEnd(34)} ${row}`);
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

    if (failures.length) {
        for (const failure of failures) console.error(`[check-lighthouse] ${failure}`);
        fail(`${failures.length} audit(s) below floor. Reports in ${REPORT_DIR}. Fix the page, never the check (SEO stays at 100).`);
    }
    console.log(`\n[check-lighthouse] ${results.length} page-runs clean: SEO 100, accessibility and best practices at or above baseline. Reports in ${REPORT_DIR}.`);
}

await main();
