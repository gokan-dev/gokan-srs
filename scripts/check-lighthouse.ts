/**
 * Lighthouse over both production builds, served locally the way CloudFront serves them
 * (scripts/lib/builtSite.ts): the SRS at `/`, the dictionary under `/dictionary/`. One
 * representative page per dictionary type, plus the SRS landing, on mobile and desktop.
 *
 * The gate the dictionary exists for: SEO at 100 on every page (crawlable, titled, described),
 * failing the job below it. The dictionary also holds accessibility and best practices at a floor
 * taken from the first baseline and only ever raised (DICTIONARY_FLOORS below); the SRS landing is
 * held to SEO alone, since it is a single-page app whose accessibility is tracked where that app
 * is. Performance is recorded, never floored: a local build has none of production's CDN
 * compression or caching, so its number is a trend, not a verdict. Each category is the median of
 * several runs, so one noisy run cannot fail the job.
 *
 * Usage: build both apps (`bun run build`, `bun run dictionary:build`), then
 * `bun run check:lighthouse`. Needs Chrome (Lighthouse finds it; CHROME_PATH overrides) and runs
 * Lighthouse through `npx`, so Node must be on PATH. LH_RUNS, LH_FORM_FACTORS and LH_ONLY (a label
 * substring) tune a local run.
 * Run by CI (.github/workflows/ci-lighthouse.yml), which keeps the reports as an artifact.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { buildMissing, dictionaryPages, serveBoth } from './lib/builtSite';

const LIGHTHOUSE_VERSION = '12';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
type Category = (typeof CATEGORIES)[number];
const FORM_FACTORS = ['mobile', 'desktop'] as const;
type FormFactor = (typeof FORM_FACTORS)[number];

const RUNS = Number(process.env.LH_RUNS ?? '3');
const ACTIVE_FORM_FACTORS: readonly FormFactor[] = (process.env.LH_FORM_FACTORS?.split(',') ?? FORM_FACTORS)
    .map(value => value.trim())
    .filter((value): value is FormFactor => (FORM_FACTORS as readonly string[]).includes(value));
/** A local knob: measure only the targets whose label contains this (e.g. LH_ONLY=dictionary). */
const ONLY = process.env.LH_ONLY?.trim();

const SEO_FLOOR = 1;
/**
 * Floors per page, read off the first green baseline and only ever raised. A category absent here
 * is recorded but not gated (performance, everywhere; accessibility and best practices on the SRS
 * landing). The dictionary's accessibility sits at 0.96 today, one audit ("links rely on colour",
 * docs/MODIFICATION_LOG.md); raise it once that is fixed.
 */
const DICTIONARY_FLOORS: Partial<Record<Category, number>> = { seo: SEO_FLOOR, accessibility: 0.96, 'best-practices': 1 };
const SRS_FLOORS: Partial<Record<Category, number>> = { seo: SEO_FLOOR };

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
 * event loop and starve Lighthouse of the page it is trying to load. `npx` runs Lighthouse on
 * Node, so Bun's loop stays free to serve.
 */
function runLighthouse(url: string, formFactor: FormFactor, outPath: string): Promise<Record<string, unknown>> {
    const args = [
        '--yes', `lighthouse@${LIGHTHOUSE_VERSION}`, url,
        `--only-categories=${CATEGORIES.join(',')}`,
        '--output=json', `--output-path=${outPath}`,
        '--chrome-flags="--headless=new --no-sandbox --disable-gpu --hide-scrollbars"',
        '--quiet', '--max-wait-for-load=60000',
        ...(formFactor === 'desktop' ? ['--preset=desktop'] : []),
    ];
    return new Promise(resolve => {
        const child = spawn('npx', args, { stdio: ['ignore', 'ignore', 'inherit'], shell: true });
        child.on('error', error => fail(`Could not run Lighthouse (${error.message}). Is Node on PATH?`));
        child.on('close', code => {
            if (code !== 0) fail(`Lighthouse exited ${code ?? 'with a signal'} on ${formFactor} ${url}.`);
            resolve(asRecord(JSON.parse(readFileSync(outPath, 'utf8')) as unknown));
        });
    });
}

const slug = (label: string) => label.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();

interface Target { url: string; label: string; floors: Partial<Record<Category, number>> }
interface Result { target: Target; formFactor: FormFactor; scores: Record<Category, number | null>; lastReport: Record<string, unknown> }

async function main(): Promise<void> {
    const { server, port } = await serveBoth();
    const origin = `http://127.0.0.1:${port}`;
    const allTargets: Target[] = [
        { url: `${origin}/`, label: 'srs home', floors: SRS_FLOORS },
        ...dictionaryPages().map(page => ({ url: `${origin}/dictionary${page.path}`, label: `dictionary ${page.path}`, floors: DICTIONARY_FLOORS })),
    ];
    const targets = ONLY ? allTargets.filter(target => target.label.includes(ONLY)) : allTargets;
    if (targets.length === 0) fail(`LH_ONLY="${ONLY}" matched no target.`);

    rmSync(REPORT_DIR, { recursive: true, force: true });
    mkdirSync(REPORT_DIR, { recursive: true });

    const results: Result[] = [];
    try {
        for (const formFactor of ACTIVE_FORM_FACTORS) {
            for (const target of targets) {
                const outPath = join(REPORT_DIR, `${slug(target.label)}.${formFactor}.json`);
                const runs: Record<string, unknown>[] = [];
                for (let run = 0; run < RUNS; run++) runs.push(await runLighthouse(target.url, formFactor, outPath));
                const scores = Object.fromEntries(CATEGORIES.map(category => {
                    const values = runs.map(report => categoryScore(report, category)).filter((v): v is number => v !== null);
                    return [category, values.length ? median(values) : null];
                })) as Record<Category, number | null>;
                results.push({ target, formFactor, scores, lastReport: runs[runs.length - 1] });
            }
        }
    } finally {
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

    for (const { target, formFactor, scores, lastReport } of results) {
        for (const category of CATEGORIES) {
            const floor = target.floors[category];
            const score = scores[category];
            if (floor === undefined || score === null || score >= floor) continue;
            const named = failedAudits(lastReport, category);
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
