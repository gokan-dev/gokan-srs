/**
 * Project conventions that ESLint and the type checker cannot express. Run by `bun run check`
 * (and so by the pre-commit hook, the agent hook and CI). Each rule names the convention in
 * AGENTS.md it protects; fix the code rather than adding an exemption here.
 *
 * Usage: bun scripts/check-conventions.ts [files...]
 * With no arguments every tracked file is checked; with arguments, only those.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

interface Violation {
    file: string;
    line?: number;
    rule: string;
    message: string;
}

const EM_DASH = String.fromCharCode(0x2014);

/** Files exempt from the text rules: generated, vendored or binary content. */
const TEXT_EXEMPT = [/^bun\.lock$/, /^ressources\//, /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|pdf|zip)$/i];

/** The one JavaScript file: Svelte's tooling only reads a JS config. */
const JS_ALLOWED = new Set(['apps/gokan-dictionary/svelte.config.js']);

/** The only files that write colours as values; everything else uses their tokens. */
const COLOUR_TOKEN_FILES = new Set(['apps/gokan-srs/src/index.css', 'apps/gokan-dictionary/src/styles/app.scss']);
const STYLED_SOURCE = /^apps\/(gokan-srs|gokan-dictionary)\/src\/.*\.(tsx?|svelte|s?css)$/;

const PALETTE = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const TOKENS = 'primary|secondary|tertiary|accent|error|surface|background|divider|muted|subtle|feedback-correct|feedback-incorrect';
const UTILITY = 'text|bg|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|shadow|accent|caret|decoration';
const PALETTE_CLASS = new RegExp(`\\b(?:${UTILITY})-(?:${PALETTE})-\\d{2,3}\\b`);
const TOKEN_SHADE_CLASS = new RegExp(`\\b(?:${UTILITY})-(?:${TOKENS})-\\d{2,3}\\b`);
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b(?![-\w])|\b(?:rgba?|hsla?)\(/;

/** Pure-logic directories: every module has a colocated test. */
const TESTED_DIRS = ['apps/gokan-srs/src/utils', 'apps/gokan-dictionary/src/lib', 'packages/deploy/src'];
/** Modules with no logic to test: constants and type declarations only. */
const TEST_EXEMPT = new Set(['apps/gokan-dictionary/src/lib/site.ts', 'apps/gokan-dictionary/src/lib/types.ts']);

const AGENT_STUBS = ['CLAUDE.md', 'GEMINI.md'];
const AGENT_STUB_CONTENT = '@AGENTS.md';

/**
 * Dataset files keep their names across dataset releases and are cached by browsers, so every
 * request carries the dataset version. One helper builds those URLs; nothing else names the path.
 */
const DATASET_URL_SOURCE = /^apps\/gokan-srs\/src\/.*\.tsx?$/;
const DATASET_URL_HELPER = 'apps/gokan-srs/src/services/http.ts';

/**
 * A word learned in kana (ここ) has a rare kanji spelling (此処) in writtenForm.kanji, so the UI
 * names words through headwordOf/secondaryForm (@gokan/dataset-schema). Rendering
 * writtenForm.kanji in a JSX or Svelte expression is how the rare spelling would come back.
 * The one exemption is the note whose job is to show that spelling.
 */
const UI_SOURCE = /^apps\/(gokan-srs|gokan-dictionary)\/src\/.*\.(tsx|svelte)$/;
const RENDERED_KANJI_SPELLING = /\{[^{}]*\bwrittenForm\.kanji\b[^{}]*\}/;
const KANJI_SPELLING_NOTE = 'apps/gokan-srs/src/components/KanjiSpellingNote.tsx';

const SCHEMA_DIR = 'packages/dataset-schema/src';
const APP_SOURCE = /^apps\/(gokan-srs|gokan-dictionary)\/(src|scripts)\/.*\.(tsx?|svelte)$/;

function trackedFiles(): string[] {
    return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
        .split('\n')
        .filter(f => f && existsSync(f) && statSync(f).isFile());
}

function read(file: string): string | null {
    const buffer = readFileSync(file);
    return buffer.includes(0) ? null : buffer.toString('utf8');
}

function eachLine(text: string, test: (line: string) => boolean, onMatch: (line: number) => void): void {
    text.split('\n').forEach((line, i) => {
        if (test(line)) onMatch(i + 1);
    });
}

/** Type names the shared dataset schema exports; an app must import them, never redeclare them. */
function schemaTypeNames(): Set<string> {
    const names = new Set<string>();
    if (!existsSync(SCHEMA_DIR)) return names;
    for (const entry of readdirSync(SCHEMA_DIR)) {
        if (!entry.endsWith('.ts')) continue;
        const text = readFileSync(join(SCHEMA_DIR, entry), 'utf8');
        for (const m of text.matchAll(/export\s+(?:interface|type)\s+([A-Z]\w*)/g)) names.add(m[1]);
    }
    return names;
}

function check(files: string[]): Violation[] {
    const violations: Violation[] = [];
    const add = (v: Violation) => violations.push(v);
    const schemaNames = schemaTypeNames();
    const redeclaration = schemaNames.size
        ? new RegExp(`^\\s*(?:export\\s+)?(?:interface|type)\\s+(${[...schemaNames].join('|')})\\b`)
        : null;

    for (const file of files) {
        if (/\.(js|jsx|mjs|cjs)$/.test(file) && !JS_ALLOWED.has(file)) {
            add({ file, rule: 'typescript-only', message: 'Write TypeScript (.ts/.tsx/.svelte with lang="ts"), never JavaScript.' });
        }
        if (TEXT_EXEMPT.some(re => re.test(file))) continue;
        const text = read(file);
        if (text === null) continue;

        if (AGENT_STUBS.includes(file)) {
            if (text.trim() !== AGENT_STUB_CONTENT) {
                add({ file, rule: 'one-conventions-file', message: `Must contain only "${AGENT_STUB_CONTENT}". Write conventions in AGENTS.md.` });
            }
            continue;
        }

        eachLine(text, l => l.includes(EM_DASH), line =>
            add({ file, line, rule: 'no-em-dash', message: 'Em dash. Use a colon, parentheses, a comma or reword.' }));

        if (STYLED_SOURCE.test(file) && !COLOUR_TOKEN_FILES.has(file) && !file.endsWith('.test.ts')) {
            eachLine(text, l => PALETTE_CLASS.test(l), line =>
                add({ file, line, rule: 'design-tokens', message: 'Default Tailwind palette colour. Use a theme token (text-error, bg-divider...).' }));
            eachLine(text, l => TOKEN_SHADE_CLASS.test(l), line =>
                add({ file, line, rule: 'design-tokens', message: 'Theme tokens have no numeric shades; this class resolves to nothing. Use the token, with /opacity if needed.' }));
            eachLine(text, l => RAW_COLOUR.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'design-tokens', message: 'Raw colour value. Define it once in the token file and use the token.' }));
        }

        if (/\.(tsx?|svelte)$/.test(file)) {
            eachLine(text, l => /(\/\/|\/\*)\s*eslint-disable/.test(l) && !/eslint-disable\S*(\s+[\w@/-]+,?)*\s+--\s+\S/.test(l), line =>
                add({ file, line, rule: 'justified-disable', message: 'eslint-disable needs a reason: "// eslint-disable-next-line rule -- why".' }));
        }

        if (DATASET_URL_SOURCE.test(file) && file !== DATASET_URL_HELPER && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => l.includes('/data/compiled/') && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'dataset-url', message: 'Build dataset URLs with datasetUrl() (services/http.ts); it adds the dataset version browsers cache by.' }));
        }

        if (UI_SOURCE.test(file) && file !== KANJI_SPELLING_NOTE) {
            eachLine(text, l => RENDERED_KANJI_SPELLING.test(l), line =>
                add({ file, line, rule: 'headword', message: 'Renders writtenForm.kanji. Name the word with headwordOf/secondaryForm (@gokan/dataset-schema): a word learned in kana is shown in kana.' }));
        }

        if (redeclaration && APP_SOURCE.test(file)) {
            eachLine(text, l => redeclaration.test(l), line =>
                add({ file, line, rule: 'one-schema', message: 'Redeclares a type from @gokan/dataset-schema. Import it instead.' }));
        }

        const dir = dirname(file);
        if (TESTED_DIRS.includes(dir) && /\.ts$/.test(file) && !/\.test\.ts$/.test(file) && !TEST_EXEMPT.has(file)) {
            const test = join(dir, basename(file, '.ts') + '.test.ts').replaceAll('\\', '/');
            if (!existsSync(test)) {
                add({ file, rule: 'colocated-tests', message: `Pure logic needs a colocated test: ${test}.` });
            }
        }
    }

    for (const stub of AGENT_STUBS) {
        if (!existsSync(stub)) add({ file: stub, rule: 'one-conventions-file', message: `Missing; it must contain "${AGENT_STUB_CONTENT}".` });
    }
    if (!existsSync('AGENTS.md')) add({ file: 'AGENTS.md', rule: 'one-conventions-file', message: 'Missing.' });

    return violations;
}

const args = process.argv.slice(2).map(f => f.replaceAll('\\', '/'));
const files = args.length ? args.filter(f => existsSync(f) && statSync(f).isFile()) : trackedFiles();
const violations = check(files);

for (const v of violations) {
    console.error(`${v.file}${v.line ? `:${v.line}` : ''}  [${v.rule}]  ${v.message}`);
}
if (violations.length) {
    console.error(`\n${violations.length} convention violation(s). See AGENTS.md.`);
    process.exit(1);
}
console.log(`Conventions: ${files.length} files clean.`);
