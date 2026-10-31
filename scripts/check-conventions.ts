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
const TOKENS = 'primary|secondary|tertiary|accent|error|surface|background|divider|feedback-correct|feedback-incorrect';
/** Removed in the v2 design system: these must fail as unknown tokens, not resolve to nothing silently. */
const REMOVED_TOKENS = 'error-accent|muted|subtle|label-neutral|meaning-muted|quiz-cloze-soft|quiz-cloze|quiz-conjugation-soft|quiz-conjugation|quiz-lexical-soft|quiz-lexical';
const UTILITY = 'text|bg|border|ring|from|to|via|fill|stroke|outline|divide|placeholder|shadow|accent|caret|decoration';
const PALETTE_CLASS = new RegExp(`\\b(?:${UTILITY})-(?:${PALETTE})-\\d{2,3}\\b`);
const TOKEN_SHADE_CLASS = new RegExp(`\\b(?:${UTILITY})-(?:${TOKENS})-\\d{2,3}\\b`);
const REMOVED_TOKEN_CLASS = new RegExp(`\\b(?:${UTILITY})-(?:${REMOVED_TOKENS})\\b`);
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b(?![-\w])|\b(?:rgba?|hsla?)\(/;

/** The 12px floor: an arbitrary Tailwind size below it, outside the `em` units furigana uses. */
const SUB_FLOOR_PX = /\btext-\[(\d+(?:\.\d+)?)px\]/;
const SUB_FLOOR_REM = /\btext-\[(\d+(?:\.\d+)?)rem\]/;
const SCALE_TRANSFORM = /\b(?:hover|active):scale-/;
const TRACKING_WIDE = /\btracking-wide(?:r|st)?\b/;
const LOCALE_DATE_TIME = /\.toLocaleDateString\(|\.toLocaleTimeString\(|\bdateStyle\s*:|\btimeStyle\s*:/;
const TIME_UTILS_FILE = 'apps/gokan-srs/src/utils/time.utils.ts';
const GOKAN_SRS_SOURCE = /^apps\/gokan-srs\/src\/.*\.tsx?$/;

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
/** A word's reading rendered as text, as the form beside its headword. */
const RENDERED_READING = />\{[\w.?]*\breading\.primary\}</;
/** What makes a rendered reading safe on a line or the two before it: a guard on a word learned in kana. */
const KANA_GUARD = /usuallyKana|!== headwordOf\(/;
/**
 * The form beside a headword is drawn by one component, SecondaryForm: for a word learned in kana
 * it is the kanji spelling (此処), set in mincho, and every list draws it the same way.
 */
const RENDERED_SECONDARY_FORM = /(?<!\$)\{\s*secondaryForm\(/;
const SECONDARY_FORM_COMPONENT = 'apps/gokan-srs/src/components/SecondaryForm.tsx';

// An agent workflow that can push queues on its branch's lock, so two agents never run on one
// branch at once; one without the lock is a workflow running the agent with write access.
const WORKFLOW = /^\.github\/workflows\/.*\.ya?ml$/;
const AGENT_ACTION = 'anthropics/claude-code-action';
const AGENT_BRANCH_LOCK = /^\s+group: agent-branch-\S*\$\{\{.+\}\}\s*\n\s+cancel-in-progress: false\s*\n\s+queue: max\s*$/m;
// The agents get AGENTS.md through CLAUDE.md's import, which Claude Code loads from the `project`
// settings source, so the prompts do not ask for a second copy. A `--setting-sources` without
// `project` would drop every rule from an agent's context without a word.
const SETTING_SOURCES = /--setting-sources[= ]+([\w,]+)/g;
// `bun run check` runs the real-dataset suites, which fail without the compiled dataset (the
// gokan-dataset submodule), so a job that runs it checks out with submodules. A command line, not
// a prompt or a step name that mentions it, and not `check:layout` and its siblings.
const RUNS_CHECK = /^\s*(?:-\s+)?(?:run:\s+)?bun run check\s*(?:$|&&|;|#)/m;
const SUBMODULE_CHECKOUT = /^\s+submodules:\s*['"]?(?:true|recursive)\b/m;
const JOB_HEADER = /^ {2}([\w-]+):\s*$/gm;

/** A workflow's jobs, each with its text and the line its header is on. */
function workflowJobs(text: string): { name: string; line: number; text: string }[] {
    const start = text.search(/^jobs:\s*$/m);
    if (start < 0) return [];
    const headers = [...text.slice(start).matchAll(JOB_HEADER)].map(m => ({ name: m[1], at: start + m.index }));
    return headers.map((h, i) => ({
        name: h.name,
        line: text.slice(0, h.at).split('\n').length,
        text: text.slice(h.at, headers[i + 1]?.at ?? text.length),
    }));
}

/**
 * A kun reading is shown through kunReadingLabel (@gokan/dataset-schema): まな.ぶ as まな(ぶ), the
 * okurigana in parentheses in both apps, never by a colour, which already means something else.
 */
const KUN_READINGS = /\breadings\.kun\b/;
const KUN_READING_LABEL = /\bkunReadingLabel\b/;

/** A glyph size: text-2xl, or an arbitrary 24px or more (text-[28px]). */
const GLYPH_SIZE = String.raw`\btext-(?:2xl\b|\[(?:2[4-9]|[3-9]\d|\d{3,})px\])`;

/**
 * A glyph drawn as a tile is a KanjiTile: a box only when it links somewhere, so a glyph with no
 * page never looks clickable (DESIGN_SYSTEM.md, principle 7). The known-kanji grid's toggles are
 * the one other boxed glyph, and they are buttons.
 */
const BOXED_GLYPH = new RegExp(String.raw`\bfont-mincho\b(?=.*${GLYPH_SIZE})(?=.*\bborder\b)|\bborder\b(?=.*\bfont-mincho\b)(?=.*${GLYPH_SIZE})`);
const BOXED_GLYPH_FILES = new Set(['apps/gokan-srs/src/components/KanjiTile.tsx', 'apps/gokan-srs/src/components/KanjiKnowledgeGrid.tsx',
    // The welcome page's step two boxes, named in docs/DESIGN_SYSTEM.md's Welcome page note.
    'apps/gokan-srs/src/pages/setup/welcome/HowItWorks.tsx']);

/**
 * The dataset's synonym pairs have one reader, services/exercise/wordRelation.ts (relationOf,
 * synonymsOf, listedSynonymsOf): grading, the cards, the ticker and every page that shows a pair go
 * through it, so the tier a page shows is the tier grading uses.
 */
const SYNONYM_DATA = /\bVocabSynonym\b|\.synonyms\b|'synonyms'/;
const SYNONYM_READER = 'apps/gokan-srs/src/services/exercise/wordRelation.ts';

/** Furigana in the app is the Ruby component: readings over the kanji only, half size, kept apart. */
const RUBY_ELEMENT = /<ruby\b/;
/** A sheet's top corners: the panel BottomSheet draws over the bottom of the screen. */
const SHEET_PANEL = /\brounded-t-md\b/;
const BOTTOM_SHEET = 'apps/gokan-srs/src/components/ui/BottomSheet.tsx';
/** The layers drawn over the page, through a portal: the sheet, the lookup card, the quiz settings dialog. */
const PORTAL_CALL = /\bcreatePortal\(/;
const PORTAL_FILES = new Set([BOTTOM_SHEET, 'apps/gokan-srs/src/components/lookup/useLookup.tsx', 'apps/gokan-srs/src/components/QuizSettingsMenu.tsx']);
const RUBY_COMPONENT = 'apps/gokan-srs/src/components/Ruby.tsx';

/**
 * Detail pages (vocab, kanji, grammar) share one frame: DetailHeader, then DetailBody, the 8/4
 * grid from `lg` and one column below it. The grid itself lives only in those two components.
 */
const DETAIL_SCREEN = /^apps\/gokan-srs\/src\/pages\/.*DetailScreen\.tsx$/;
const DETAIL_GRID_FILES = new Set(['apps/gokan-srs/src/components/detail/DetailHeader.tsx', 'apps/gokan-srs/src/components/detail/DetailBody.tsx']);

/**
 * `p a` underlines a link in running text (index.css). A link alone in a paragraph is not running
 * text, and would be underlined for good: its wrapper is a `<div>` (DESIGN_SYSTEM.md section 2).
 */
const PARAGRAPH_THEN_LINK = /<p\b[^>]*>\s*<(Link|NavLink|a)\b/g;

function linksAloneInParagraphs(text: string): number[] {
    const lines: number[] = [];
    for (const m of text.matchAll(PARAGRAPH_THEN_LINK)) {
        const closing = `</${m[1]}>`;
        const end = text.indexOf(closing, m.index);
        if (end >= 0 && /^\s*<\/p>/.test(text.slice(end + closing.length))) lines.push(text.slice(0, m.index).split('\n').length);
    }
    return lines;
}

/**
 * Learning orders are named, and their per-order data kept, in @gokan/dataset-schema (`ORDER_INFO`):
 * a table over every order in an app is a second place that names them, and drifts.
 */
const ORDER_TABLE = /\bRecord<\s*KanjiOrderId\b/;

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
            eachLine(text, l => REMOVED_TOKEN_CLASS.test(l), line =>
                add({ file, line, rule: 'design-tokens', message: 'Removed token (muted/subtle/label-neutral/meaning-muted/quiz-*/error-accent). Use primary, secondary, tertiary or feedback-incorrect.' }));
            eachLine(text, l => RAW_COLOUR.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'design-tokens', message: 'Raw colour value. Define it once in the token file and use the token.' }));
        }

        if (/\.(tsx?|svelte)$/.test(file)) {
            eachLine(text, l => /(\/\/|\/\*)\s*eslint-disable/.test(l) && !/eslint-disable\S*(\s+[\w@/-]+,?)*\s+--\s+\S/.test(l), line =>
                add({ file, line, rule: 'justified-disable', message: 'eslint-disable needs a reason: "// eslint-disable-next-line rule -- why".' }));
        }

        if (GOKAN_SRS_SOURCE.test(file)) {
            eachLine(text, l => {
                const m = SUB_FLOOR_PX.exec(l);
                return !!m && Number(m[1]) < 12;
            }, line => add({ file, line, rule: 'font-size-floor', message: 'Font size below 12px. Nothing below 12px except em (relative, used for furigana).' }));
            eachLine(text, l => {
                const m = SUB_FLOOR_REM.exec(l);
                return !!m && Number(m[1]) < 0.75;
            }, line => add({ file, line, rule: 'font-size-floor', message: 'Font size below 12px (0.75rem). Nothing below 12px except em (relative, used for furigana).' }));
            eachLine(text, l => SCALE_TRANSFORM.test(l), line =>
                add({ file, line, rule: 'no-scale-transform', message: 'No hover:scale-* or active:scale-*. Motion is 150-200ms ease-in-out, no bounce.' }));
            eachLine(text, l => TRACKING_WIDE.test(l), line =>
                add({ file, line, rule: 'no-tracking-wide', message: 'No tracking-wide/wider/widest. Use type-label instead of an uppercase tracked label.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file !== TIME_UTILS_FILE) {
            eachLine(text, l => LOCALE_DATE_TIME.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'date-formatting', message: 'toLocaleDateString/toLocaleTimeString/dateStyle/timeStyle belong only in utils/time.utils.ts; use its formatters.' }));
        }

        if (DATASET_URL_SOURCE.test(file) && file !== DATASET_URL_HELPER && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => l.includes('/data/compiled/') && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'dataset-url', message: 'Build dataset URLs with datasetUrl() (services/http.ts); it adds the dataset version browsers cache by.' }));
        }

        if (UI_SOURCE.test(file) && file !== KANJI_SPELLING_NOTE) {
            eachLine(text, l => RENDERED_KANJI_SPELLING.test(l), line =>
                add({ file, line, rule: 'headword', message: 'Renders writtenForm.kanji. Name the word with headwordOf/secondaryForm (@gokan/dataset-schema): a word learned in kana is shown in kana.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file.endsWith('.tsx') && text.includes('headwordOf(')) {
            const lines = text.split('\n');
            lines.forEach((l, i) => {
                if (RENDERED_READING.test(l) && !lines.slice(Math.max(0, i - 2), i + 1).some(g => KANA_GUARD.test(g))) {
                    add({ file, line: i + 1, rule: 'secondary-form', message: 'Renders reading.primary beside a headword: for a word learned in kana that repeats the kana (ここ ここ). Use secondaryForm (@gokan/dataset-schema).' });
                }
            });
        }

        if (GOKAN_SRS_SOURCE.test(file) && file.endsWith('.tsx') && file !== SECONDARY_FORM_COMPONENT) {
            eachLine(text, l => RENDERED_SECONDARY_FORM.test(l), line =>
                add({ file, line, rule: 'one-secondary-form', message: 'Renders secondaryForm with its own markup. Use <SecondaryForm vocab={...} /> (components/SecondaryForm.tsx), so a kanji spelling is in mincho in every list.' }));
        }

        if (WORKFLOW.test(file) && text.includes(AGENT_ACTION)) {
            for (const [, sources] of text.matchAll(SETTING_SOURCES)) {
                if (!sources.split(',').includes('project')) {
                    add({ file, rule: 'agent-rules-loaded', message: `\`--setting-sources ${sources}\` leaves out \`project\`, so the agent never loads CLAUDE.md and the AGENTS.md it imports. Keep \`project\` in the list.` });
                }
            }
        }

        if (WORKFLOW.test(file) && text.includes(AGENT_ACTION) && /^\s+contents: write\b/m.test(text) && !AGENT_BRANCH_LOCK.test(text)) {
            add({ file, rule: 'agent-branch-lock', message: 'An agent job that can push queues on its branch lock: job-level concurrency with `group: agent-branch-${{ <branch> }}`, `cancel-in-progress: false`, `queue: max`. Two agents never run on one branch at once.' });
        }

        if (WORKFLOW.test(file)) {
            for (const job of workflowJobs(text)) {
                if (RUNS_CHECK.test(job.text) && !SUBMODULE_CHECKOUT.test(job.text)) {
                    add({ file, line: job.line, rule: 'check-with-dataset', message: `Job \`${job.name}\` runs \`bun run check\` without the dataset: its real-dataset suites fail when the compiled dataset is missing. Give its actions/checkout \`with: submodules: true\`.` });
                }
            }
        }

        if (UI_SOURCE.test(file)) {
            eachLine(text, l => KUN_READINGS.test(l) && !KUN_READING_LABEL.test(l), line =>
                add({ file, line, rule: 'kun-reading', message: 'Show a kun reading through kunReadingLabel (@gokan/dataset-schema): まな(ぶ), the okurigana in parentheses, never a colour.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && !BOXED_GLYPH_FILES.has(file)) {
            eachLine(text, l => BOXED_GLYPH.test(l), line =>
                add({ file, line, rule: 'glyph-tile', message: 'A glyph in a box is a KanjiTile (components/KanjiTile.tsx): boxed only when it links, plain when it has no page.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file !== SYNONYM_READER && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => SYNONYM_DATA.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'one-synonym-reader', message: 'Reads the dataset\'s synonym pairs. Go through services/exercise/wordRelation.ts (relationOf, synonymsOf, listedSynonymsOf), so a page and grading read a pair the same way.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file !== RUBY_COMPONENT && !file.endsWith('.test.tsx')) {
            eachLine(text, l => RUBY_ELEMENT.test(l), line =>
                add({ file, line, rule: 'one-ruby', message: 'Furigana renders through Ruby (components/Ruby.tsx): each reading over its kanji only (rubyParts), neighbouring readings kept apart.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file !== BOTTOM_SHEET && !file.endsWith('.test.tsx')) {
            eachLine(text, l => SHEET_PANEL.test(l), line =>
                add({ file, line, rule: 'one-sheet', message: 'A panel over the bottom of the screen is a BottomSheet (components/ui/BottomSheet.tsx): backdrop, 44px Close, Esc.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && !PORTAL_FILES.has(file) && !file.endsWith('.test.tsx')) {
            eachLine(text, l => PORTAL_CALL.test(l), line =>
                add({ file, line, rule: 'one-lookup-card', message: 'A layer over the page is the lookup card (components/lookup/useLookup.tsx), a BottomSheet or the quiz settings dialog: a word or kanji shown on hover or tap is the lookup card, never a second popover.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file.endsWith('.tsx')) {
            for (const line of linksAloneInParagraphs(text)) {
                add({ file, line, rule: 'link-alone-in-paragraph', message: 'A link alone in a <p> is not running text, but `p a` underlines it for good. Wrap it in a <div>.' });
            }
        }

        if (GOKAN_SRS_SOURCE.test(file) && !DETAIL_GRID_FILES.has(file) && !file.endsWith('.test.tsx')) {
            eachLine(text, l => /\bgrid-cols-12\b/.test(l), line =>
                add({ file, line, rule: 'detail-layout', message: 'The 12-column detail grid lives in DetailHeader and DetailBody (components/detail/); use them.' }));
        }
        if (DETAIL_SCREEN.test(file) && !(text.includes('<DetailHeader') && text.includes('<DetailBody'))) {
            add({ file, rule: 'detail-layout', message: 'A detail page is DetailHeader then DetailBody (components/detail/), like the vocab, kanji and grammar pages.' });
        }

        if (APP_SOURCE.test(file)) {
            eachLine(text, l => ORDER_TABLE.test(l), line =>
                add({ file, line, rule: 'one-order-table', message: 'A Record over every KanjiOrderId belongs in @gokan/dataset-schema (ORDER_INFO, KANJI_ORDERS): add a field there.' }));
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
