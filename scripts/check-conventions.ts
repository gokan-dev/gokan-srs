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
import { basename, dirname, join, posix } from 'node:path';

interface Violation {
    file: string;
    line?: number;
    rule: string;
    message: string;
}

const EM_DASH = String.fromCharCode(0x2014);

/** Files exempt from the text rules: generated, vendored or binary content. */
const TEXT_EXEMPT = [/^bun\.lock$/, /^ressources\//, /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|pdf|zip)$/i];


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
// Serif is a display face (titles, the logo, large prompts). At a body size it is body copy,
// which is sans (type-body, type-support, type-meta), and body copy is where inline Japanese
// lands: Source Serif 4 has no CJK glyphs, so it fell back to the system font, or to boxes.
const SERIF_BODY_TEXT = /\bfont-serif\b(?=.*(?<![\w:-])text-(?:(?:xs|sm|base)\b|\[(?:1[2-7])(?:\.\d+)?px\]))|(?<![\w:-])text-(?:(?:xs|sm|base)\b|\[(?:1[2-7])(?:\.\d+)?px\])(?=.*\bfont-serif\b)/;
/** A definition term without a type role (type-label, type-meta...): DESIGN_SYSTEM section 3 names its size, weight and colour once. */
const UNTYPED_DT = /<dt\b(?![^>]*className=[^>]*\btype-[a-z])/;
const LOCALE_DATE_TIME = /\.toLocaleDateString\(|\.toLocaleTimeString\(|\bdateStyle\s*:|\btimeStyle\s*:/;
const TIME_UTILS_FILE = 'apps/gokan-srs/src/utils/time.utils.ts';
const GOKAN_SRS_SOURCE = /^apps\/gokan-srs\/src\/.*\.tsx?$/;

/** Pure-logic directories: every module has a colocated test. */
const TESTED_DIRS = ['apps/gokan-srs/src/utils', 'apps/gokan-dictionary/src/lib', 'packages/deploy/src'];
/** Modules with no logic to test: constants and type declarations only. */
const TEST_EXEMPT = new Set(['apps/gokan-dictionary/src/lib/types.ts', 'apps/gokan-dictionary/src/lib/pageProps.ts']);

const AGENT_STUBS = ['CLAUDE.md', 'GEMINI.md'];
const AGENT_STUB_CONTENT = '@AGENTS.md';

/**
 * Dataset files keep their names across dataset releases and are cached by browsers, so every
 * request carries the dataset version. One helper builds those URLs; nothing else names the path.
 */
const DATASET_URL_SOURCE = /^apps\/gokan-srs\/src\/.*\.tsx?$/;
const DATASET_URL_HELPER = 'apps/gokan-srs/src/services/http.ts';
/**
 * A clip is served at one path on the shared host, for both apps: one builder names it
 * (`audioUrl`, `@gokan/dataset-schema`), so the app and the dictionary cannot ask for a clip at
 * two different addresses (#255).
 */
const AUDIO_URL_SOURCE = /^(apps\/gokan-srs\/src|apps\/gokan-dictionary\/src|packages\/[^/]+\/src)\/.*\.(tsx?|svelte)$/;
const AUDIO_URL_HELPER = 'packages/dataset-schema/src/audio.ts';

/**
 * A dataset file in its English shape is built from its published inputs in one place, the
 * reader both apps share (`publishedDatasetReader`, `englishDatasetFile` in
 * `@gokan/dataset-schema/published-dataset`), so no app holds a second way to assemble a file. No
 * app imports the projection (`englishFile`, `englishInputs`) itself, through
 * `@gokan/dataset-schema/english-file` or straight from the dataset's src/layout/englishFile.
 */
const ENGLISH_FILE_IMPORT = /\bfrom\s+['"](@gokan\/dataset-schema\/english-file|[^'"]*\/layout\/englishFile)['"]|\bimport\(\s*['"](@gokan\/dataset-schema\/english-file|[^'"]*\/layout\/englishFile)['"]/;
/**
 * The dictionary reads the dataset through one DictionaryData (lib/types.ts): its checkout
 * implementation, lib/dataset.server.ts, is held by lib/server/dictionary.ts, and a page or helper
 * that imported it would read the checkout around the interface.
 */
const DICTIONARY_DATA_IMPORT = /\bfrom\s+['"][^'"]*\/dataset\.server['"]|\bimport\(\s*['"][^'"]*\/dataset\.server['"]/;
const DICTIONARY_SOURCE = /^apps\/gokan-dictionary\/(src|scripts)\/.*\.(ts|svelte)$/;
const DICTIONARY_DATA_HOLDER = 'apps/gokan-dictionary/src/lib/server/dictionary.ts';
/**
 * The search script links what a page in its locale may link: linkUrls(locale) (lib/localeLinks.ts),
 * the section's own pages and English's for the types it does not serve yet. localeUrls alone would
 * link a Chinese kanji or grammar page, which is not built (#170).
 */
const URLS_IMPORT = /\bimport\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*\/urls['"]/g;
const DICTIONARY_CLIENT = /^apps\/gokan-dictionary\/src\/client\//;
// A breadcrumb is chrome: its steps come from the locale's catalog (lib/messages), as its home
// step does, or a translated page's trail would continue in English after its first step.
const DICTIONARY_PAGE_COMPONENT = /^apps\/gokan-dictionary\/src\/pages\/[^/]+\.svelte$/;
// A detail page's tab row is the contract with client/detailTabs.ts (data-detail-tabs, data-tab):
// one component writes it, so the word, kanji and grammar pages cannot drift apart.
const DETAIL_TABS_ROW = /\bdata-detail-tabs\b/;
const DETAIL_TABS_COMPONENT = 'apps/gokan-dictionary/src/pages/DetailTabs.svelte';
const BREADCRUMB_TRAIL = /trail=\{\[([\s\S]*?)\]\}/g;
// A quoted label, or a backtick one with nothing interpolated (`Orders`). The templated steps
// (`Chapter ${n}`, `JLPT N${level}`, `Page ${page}`, a kanji range) wait for #170's catalog phrases.
const QUOTED_LABEL = /\blabel:\s*(?:['"]|`(?![^`]*\$\{))/g;
const ENGLISH_FILE_SOURCE = /^(apps\/(gokan-srs|gokan-dictionary)\/(src|scripts)\/.*\.(tsx?|svelte)|scripts\/.*\.ts|apps\/gokan-srs\/vite\.config\.ts)$/;

/**
 * Until #211 a sync step copied the dataset into apps/gokan-srs/public/data/compiled/; the app now
 * reads the published dataset at /dataset/. Docs and sources that still describe the step describe
 * a build that no longer exists. MODIFICATION_LOG.md (history), tests and the dataset submodule are
 * out of scope; .gitignore and the SRS vite config name the path because they keep a leftover copy
 * untracked and refuse to build with one. The package.json files and knip.json held the step's
 * scripts, so a rebase or a copied script would bring it back there; this file names it in its regex.
 */
const REMOVED_SYNC_STEP = /sync-dataset|sync:dataset|dataset:sync|public\/data\/compiled/;
const REMOVED_SYNC_STEP_SCOPE = /^(docs\/ARCHITECTURE\.md|AGENTS\.md|\.gitignore|(apps\/[\w-]+\/)?package\.json|knip\.json|scripts\/(?!check-conventions\.ts).+\.ts|apps\/[\w-]+\/vite\.config\.ts|apps\/[\w-]+\/(src|scripts)\/.+|packages\/[\w-]+\/src\/.+)$/;
const REMOVED_SYNC_STEP_ALLOWED = new Set(['.gitignore', 'apps/gokan-srs/vite.config.ts']);

/**
 * A word learned in kana (ここ) has a rare kanji spelling (此処) in writtenForm.kanji, so the UI
 * names words through headwordOf/secondaryForm (@gokan/dataset-schema). Rendering
 * writtenForm.kanji in a JSX or Svelte expression is how the rare spelling would come back.
 * The one exemption is the note whose job is to show that spelling.
 */
const UI_SOURCE = /^apps\/(gokan-srs|gokan-dictionary)\/src\/.*\.(tsx|svelte)$/;
const RENDERED_KANJI_SPELLING = /\{[^{}]*\bwrittenForm\.kanji\b[^{}]*\}/;
const KANJI_SPELLING_NOTE = 'apps/gokan-srs/src/components/KanjiSpellingNote.tsx';
/**
 * A page folder imports nothing from another page folder: what two pages share is a building block
 * in `components/`, `hooks/` or `utils/` (AGENTS.md, shared building blocks), where the next page
 * finds it, and moving a page never breaks another. The pairs below are the exercise engine's
 * seams, there before the rule: the activities' prompts and formatting the one `ExerciseCard`
 * picks, the screens that host it, and the hub's quiz settings and listening helpers.
 */
const SRS_PAGES = 'apps/gokan-srs/src/pages/';
const MODULE_IMPORT = /\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]|\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const CROSS_PAGE_ALLOWED = new Set([
    'exercise/ExerciseCard.tsx -> quiz/quizFormatting',
    'exercise/ExerciseCard.tsx -> quiz/VocabPrompts',
    'exercise/ExerciseCard.tsx -> grammar/GrammarPrompts',
    'grammar/GrammarScreen.tsx -> exercise/ExerciseCard',
    'quiz/VocabQuizScreen.tsx -> exercise/ExerciseCard',
    'main/MainScreen.tsx -> settings/sections/VocabQuizSettings',
    'main/MainScreen.tsx -> settings/sections/GrammarQuizSettings',
    'main/MainScreen.tsx -> listening/listeningShared',
]);
/** The page folder of a path under SRS_PAGES (`kanji` for pages/kanji/KanjiWords.tsx), null for a file directly in it. */
function pageFolderOf(path: string): string | null {
    if (!path.startsWith(SRS_PAGES)) return null;
    const parts = path.slice(SRS_PAGES.length).split('/');
    return parts.length > 1 ? parts[0] : null;
}
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
/**
 * A headword is always Japanese, and the face it inherits may be Source Serif 4 or Inter, neither of
 * which has CJK glyphs: an element that renders one names a Japanese face itself.
 */
const RENDERED_HEADWORD = />\{\s*(?:headwordOf|secondaryForm|headwordWithReading)\(/;
const JAPANESE_FACE = /\b(?:font-mincho|font-gothic|jp-[\w-]+)\b/;

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
// `bun install` sets core.hooksPath (the root package's prepare script), so in that job a plain
// `git commit` or `git push` runs the hooks, each `bun run check`: the same rule as above, reached
// implicitly. A command line only: an agent's prompt telling it to push is not one.
const RUNS_INSTALL = /^\s*(?:-\s+)?(?:run:\s+)?bun install\b/m;
const HOOKED_GIT = /^\s*(?:-\s+)?(?:run:\s+)?git (?:commit|push)\b(?!.*--no-verify)/;
const JOB_HEADER = /^ {2}([\w-]+):\s*$/gm;

/**
 * Production's CloudFront distribution is on the Free flat-rate plan, which refuses a custom cache
 * policy and a custom response headers policy: an apply that attaches one fails whole (#209). Its
 * stack (terraform/main.tf and the modules it uses) attaches managed cache policies only, by their
 * ID, and no response headers policy (a header goes in a CloudFront Function). Assignments are
 * checked, not resource definitions: an unattached policy costs nothing. Staging (terraform/staging/)
 * is not on that plan, and attaches its noindex headers policy on purpose.
 */
const PRODUCTION_TERRAFORM = /^apps\/gokan-srs\/terraform\/(main\.tf|modules\/.+\.tf)$/;
const MANAGED_CACHE_POLICIES = new Map([
    ['658327ea-f89d-4fab-a63d-7e88639e58f6', 'Managed-CachingOptimized'],
]);
const CACHE_POLICY_ASSIGNMENT = /^\s*cache_policy_id\s*=\s*([^#\s]+)/;
const HEADERS_POLICY_ASSIGNMENT = /^\s*response_headers_policy_id\s*=/;
/** A rule or rule group added to a web ACL: the Free plan's ACL refuses a custom one (#222). */
const WAF_RULE_RESOURCE = /^\s*resource\s+"aws_wafv2_(web_acl_rule|web_acl_rule_group_association|rule_group)"/;

/**
 * An email address handed to Terraform stays out of public logs: the repository is public, so its
 * Actions logs and run summaries are too. The variable is `sensitive` (a plan prints
 * `(sensitive value)`, not a subscription's endpoint), and a workflow sets it from a secret, which
 * GitHub masks, never from an Actions variable, which a step's log prints as is (#209).
 */
const TERRAFORM_FILE = /^apps\/gokan-srs\/terraform\/.+\.tf$/;
const EMAIL_VARIABLE = /^variable\s+"(\w+_email)"\s*\{([\s\S]*?)^\}/gm;
const SENSITIVE = /^\s*sensitive\s*=\s*true\b/m;
const EMAIL_FROM_VARS = /^\s*TF_VAR_\w*_email:\s*\$\{\{\s*vars\./;

/**
 * A CloudFront invalidation naming a site's wildcard by hand: the dictionary's or the dataset's
 * cached responses cleared on every deploy whether they changed or not. invalidationFor decides
 * what a deploy clears (#199); a fixed list in a workflow is how the whole-site clear came back.
 * Any quoted site wildcard, not only one on a `--paths` line: a bash array or a continued line is
 * the same list.
 */
const FIXED_SITE_INVALIDATION = /["']\/(dictionary|dataset)\/\*["']/;

/**
 * A step that clears the cache after a failed deploy runs on `failure()` only: a cancelled run
 * (by hand, a lost runner) after an upload stored its manifest leaves the next deploy seeing
 * nothing changed, and old responses cached for a year. It needs `cancelled()` as well.
 */
const FAILURE_ONLY_CONDITION = /^\s*-?\s*if:.*\bfailure\(\)/;
/** `cancelled()` as a condition, not its negation (`!cancelled()` means the opposite). */
const CANCELLED_CONDITION = /(?<!!)\bcancelled\(\)/;
/** Where a workflow step starts: its `- ` item, whatever key comes first. */
const WORKFLOW_STEP_START = /^\s*- (?=[a-z-]+:)/gm;

/**
 * A job that builds the dictionary sets the locales it serves (VITE_DICTIONARY_LOCALES) in the
 * job's own `env`, never on one step: check:parity starts builds of its own (the base worktree's,
 * the on-request server's), which see the job's env and not a sibling step's, and an English-only
 * build compared with a Chinese dist/ fails `--expect identical` for no real reason (#170).
 */
const DICTIONARY_BUILD = /apps\/gokan-dictionary\s+build(?::on-request)?\b|\bdictionary:build\b|\bcheck:parity\b/;
const JOB_LEVEL_LOCALES = /^ {6}VITE_DICTIONARY_LOCALES:/m;

/**
 * The locales each environment serves are written once: production's as deploy-site.yml's
 * `dictionary_locales` default, staging's in deploy-staging.yml. check-dictionary-deployed.yml
 * rebuilds what an environment serves, so its two literals must equal those, or `--expect
 * identical` fails against the deployed site with no hint why.
 */
const DEPLOY_SITE = '.github/workflows/deploy-site.yml';
const DEPLOY_STAGING = '.github/workflows/deploy-staging.yml';
const CHECK_DEPLOYED = '.github/workflows/check-dictionary-deployed.yml';
/** The staging rendered review builds what staging serves, for its local check:layout. */
const REVIEW_STAGING = '.github/workflows/claude-review-staging.yml';
const REVIEW_STAGING_LOCALES = /^ {6}VITE_DICTIONARY_LOCALES:\s*(.+?)\s*$/m;
const PRODUCTION_LOCALES_DEFAULT = /^ {6}dictionary_locales:\s*\n((?: {8}.*\n)+)/m;
const STAGING_LOCALES = /^\s+dictionary_locales:\s*'([^']*)'/m;
const DEPLOYED_LOCALES = /^\s+VITE_DICTIONARY_LOCALES:\s*\$\{\{\s*inputs\.environment == 'production' && '([^']*)' \|\| '([^']*)'\s*\}\}/m;

/** The locale lists the three deploy workflows write, each where it is written, or what is missing. */
function deployedLocaleViolations(): Violation[] {
    const readText = (file: string) => (existsSync(file) ? readFileSync(file, 'utf8') : '');
    const defaults = PRODUCTION_LOCALES_DEFAULT.exec(readText(DEPLOY_SITE))?.[1];
    const production = defaults ? /^\s+default:\s*'([^']*)'/m.exec(defaults)?.[1] : undefined;
    const staging = STAGING_LOCALES.exec(readText(DEPLOY_STAGING))?.[1];
    const deployed = DEPLOYED_LOCALES.exec(readText(CHECK_DEPLOYED));
    const rule = 'one-locale-list';
    const missing: Violation[] = [];
    if (production === undefined) missing.push({ file: DEPLOY_SITE, rule, message: 'No `dictionary_locales` input with a quoted `default`: production\'s locales are written there.' });
    if (staging === undefined) missing.push({ file: DEPLOY_STAGING, rule, message: 'No quoted `dictionary_locales:`: staging\'s locales are written there.' });
    if (!deployed) missing.push({ file: CHECK_DEPLOYED, rule, message: 'No `VITE_DICTIONARY_LOCALES: ${{ inputs.environment == \'production\' && \'<production>\' || \'<staging>\' }}`: the check builds what each environment serves.' });
    if (missing.length || production === undefined || staging === undefined || !deployed) return missing;
    const line = readText(CHECK_DEPLOYED).slice(0, deployed.index).split('\n').length;
    const wrong: Violation[] = [];
    if (deployed[1] !== production) wrong.push({ file: CHECK_DEPLOYED, line, rule, message: `Builds production with '${deployed[1]}', but deploy-site.yml's \`dictionary_locales\` default is '${production}'. Make them equal, or the comparison with the deployed site fails.` });
    if (deployed[2] !== staging) wrong.push({ file: CHECK_DEPLOYED, line, rule, message: `Builds staging with '${deployed[2]}', but deploy-staging.yml passes \`dictionary_locales: '${staging}'\`. Make them equal, or the comparison with the deployed site fails.` });
    const reviewText = readText(REVIEW_STAGING);
    const review = REVIEW_STAGING_LOCALES.exec(reviewText);
    if (!review) wrong.push({ file: REVIEW_STAGING, rule, message: 'No job-level `VITE_DICTIONARY_LOCALES`: the staging review builds what staging serves.' });
    else if (review[1].replace(/^'(.*)'$/, '$1') !== staging) wrong.push({ file: REVIEW_STAGING, line: reviewText.slice(0, review.index).split('\n').length, rule, message: `Builds staging's pages with '${review[1]}', but deploy-staging.yml passes \`dictionary_locales: '${staging}'\`. Make them equal.` });
    return wrong;
}

/**
 * GitHub creates no `workflow_run` event for a run started with GITHUB_TOKEN, and every
 * `gh workflow run` here uses it (the agent PAT has no Actions permission). So a workflow listening
 * to `workflow_run` of one this repository dispatches never sees the dispatched runs: the auto-resume
 * listened to "Agent: implement issue" and missed every release member after the first and every
 * resumed run, leaving a stopped run for the hourly sweep, which GitHub drops under load (#245).
 * React from inside the dispatched workflow instead (a final job), as claude-implement-issue.yml does.
 */
const GITHUB_DIR_FILE = /^\.github\/(workflows\/[^/]+\.ya?ml|actions\/.+\.ya?ml)$/;
const WORKFLOW_NAME = /^name:\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*$/m;
const DISPATCH = /\bgh workflow run\s+([\w.-]+\.ya?ml)\b/g;
const WORKFLOW_RUN_LIST = /^ {2}workflow_run:\s*\n\s+workflows:\s*(\[[^\]\n]*\]|(?:\n\s+-\s*.+)+)/m;

/** Listeners on `workflow_run` of a workflow some step here dispatches, each where it listens. */
function dispatchedWorkflowRunViolations(): Violation[] {
    const fileList = (dir: string, nested: boolean): string[] => existsSync(dir)
        ? readdirSync(dir, { recursive: nested, encoding: 'utf8' }).map(f => `${dir}/${f.replaceAll('\\', '/')}`).filter(f => /\.ya?ml$/.test(f))
        : [];
    const workflows = fileList('.github/workflows', false);
    const sources = [...workflows, ...fileList('.github/actions', true)].map(file => ({ file, text: readFileSync(file, 'utf8') }));
    const dispatched = new Set(sources.flatMap(({ text }) => [...text.matchAll(DISPATCH)].map(m => m[1])));
    const fileOf = new Map(sources.filter(({ file }) => workflows.includes(file)).flatMap(({ file, text }) => {
        const m = WORKFLOW_NAME.exec(text);
        return m ? [[m[1] ?? m[2] ?? m[3], basename(file)] as const] : [];
    }));
    const violations: Violation[] = [];
    for (const { file, text } of sources) {
        const listen = WORKFLOW_RUN_LIST.exec(text);
        if (!listen) continue;
        const names = listen[1].startsWith('[')
            ? listen[1].slice(1, -1).split(',')
            : listen[1].split('\n').filter(l => l.trim()).map(l => l.replace(/^\s*-\s*/, '').replace(/\s+#.*$/, ''));
        for (const name of names.map(n => n.trim().replace(/^(["'])(.*)\1$/, '$2'))) {
            const target = fileOf.get(name);
            if (target === undefined || !dispatched.has(target)) continue;
            violations.push({
                file,
                line: text.slice(0, listen.index).split('\n').length,
                rule: 'workflow-run-of-dispatched',
                message: `Listens to \`workflow_run\` of "${name}", which \`gh workflow run ${target}\` dispatches with GITHUB_TOKEN: GitHub creates no workflow_run event for those runs, so this never sees them. React from inside ${target} (a final job with \`needs\` and \`if: always()\`).`,
            });
        }
    }
    return violations;
}

/**
 * One switch width for every detail page in both apps: the dictionary's `$bp-detail` equals the
 * app's `lg` (`--breakpoint-lg`, where its word page turns from tabs into the full page), so a
 * page cannot be tabs in one app and whole in the other at the same width.
 */
const DETAIL_BREAKPOINT_FILES = { dictionary: 'apps/gokan-dictionary/src/styles/_tokens.scss', srs: 'apps/gokan-srs/src/index.css' };

function detailBreakpointViolations(dictionaryTokens: string | null, srsCss: string | null): Violation[] {
    const dictionary = dictionaryTokens && /^\$bp-detail:\s*([\d.]+rem);/m.exec(dictionaryTokens)?.[1];
    const srs = srsCss && /^\s*--breakpoint-lg:\s*([\d.]+rem);/m.exec(srsCss)?.[1];
    if (!dictionary) return [{ file: DETAIL_BREAKPOINT_FILES.dictionary, rule: 'detail-breakpoint', message: 'Declares no `$bp-detail: <n>rem;`, the detail pages\' switch width.' }];
    if (!srs) return [{ file: DETAIL_BREAKPOINT_FILES.srs, rule: 'detail-breakpoint', message: 'Declares no `--breakpoint-lg: <n>rem;` in its @theme, the word page\'s switch width.' }];
    return dictionary === srs ? [] : [{
        file: DETAIL_BREAKPOINT_FILES.dictionary,
        rule: 'detail-breakpoint',
        message: `\`$bp-detail\` is ${dictionary}, gokan-srs's \`lg\` ${srs}: a detail page switches from tabs to the full page at one width in both apps.`,
    }];
}

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
/**
 * Outside the app, the package and the dictionary read them only through
 * packages/dataset-schema/src/synonyms.ts (synonymEntriesOf, pairCloseness, held equal to the app's
 * closenessOf by its test); vocabulary.ts declares the field. The same pattern, less a catalog's
 * own words (a section's or a tab's name or its search's placeholder, `words.sections.synonyms`) and a tab's id.
 */
const SHARED_SYNONYM_SOURCE = /^(packages\/[^/]+\/src\/.*\.ts|apps\/gokan-dictionary\/(src|scripts)\/.*\.(ts|svelte))$/;
const SHARED_SYNONYM_DATA = /\bVocabSynonym\b|(?<!\b(?:sections|search|placeholders|tabs))\.synonyms\b|(?<!id: )'synonyms'/;
const SHARED_SYNONYM_READERS = new Set(['packages/dataset-schema/src/synonyms.ts', 'packages/dataset-schema/src/vocabulary.ts']);

/**
 * A stored due date is read only where scheduling is decided: the effective due date under the
 * current review pacing (`effectiveDueDate`) is derived in the scheduling modules, the formula
 * writes it, hydration and migration move it as stored. Anywhere else a raw read would ignore the
 * pacing slider and disagree with the queue.
 */
// A stored dueDate, or the cached nextReviewAt compared as a due date: both are raw, read
// under no pacing, so a due check on either disagrees with the queue after a slider move.
const DUE_DATE_READ = /\.dueDate\b|\.nextReviewAt\s*(<=?|>=?)/;
const DUE_DATE_READERS = new Set([
    'apps/gokan-srs/src/services/scheduling.ts',
    'apps/gokan-srs/src/services/grammarScheduling.ts',
    'apps/gokan-srs/src/services/srs.service.ts',
    'apps/gokan-srs/src/services/progressHydration.ts',
    'apps/gokan-srs/src/services/migration.service.ts',
]);

/** Furigana in the app is the Ruby component: readings over the kanji only, half size, kept apart. */
const RUBY_ELEMENT = /<ruby\b/;
/** A sheet's top corners: the panel BottomSheet draws over the bottom of the screen. */
const SHEET_PANEL = /\brounded-t-md\b/;
const BOTTOM_SHEET = 'apps/gokan-srs/src/components/ui/BottomSheet.tsx';
/** The layers drawn over the page, through a portal: the sheet, the lookup card, the quiz settings dialog. */
const PORTAL_CALL = /\bcreatePortal\(/;
const PORTAL_FILES = new Set([BOTTOM_SHEET, 'apps/gokan-srs/src/components/lookup/useLookup.tsx', 'apps/gokan-srs/src/components/QuizSettingsMenu.tsx']);
const RUBY_COMPONENT = 'apps/gokan-srs/src/components/Ruby.tsx';
/** A component walking a slot's options: the options of a picked slot are drawn in one place. */
const SLOT_CHOICES_WALK = /\.choices\b[^\n]*\.(?:map|filter)\(/;
const SLOT_CHOICES_COMPONENT = 'apps/gokan-srs/src/components/quiz/SlotChoices.tsx';
/** A word's reading row (its reading, its play button, the kana note): one component, on the word page and the intro. */
const WORD_READING_MARK = /\bdata-word-reading\b/;
const WORD_READING_COMPONENT = 'apps/gokan-srs/src/components/WordReading.tsx';
/** A shared component reaching into a page module: the layering runs the other way. */
const SRS_COMPONENT = /^apps\/gokan-srs\/src\/components\/.*\.tsx?$/;
const IMPORT_FROM_PAGES = /\bfrom\s+['"](\.\.\/)+pages\/|\bimport\(\s*['"](\.\.\/)+pages\//;
/** A raw part-of-speech code (`v5r`, `adj-i`): a sense's labels come from utils/senses.utils.ts (organizeSenses). */
const RAW_POS = /\.pos\[/;
/** A word's or a kanji's page path, built by hand: vocabPath and kanjiPath (utils/navigation.utils.ts) build them. */
const HAND_BUILT_ENTRY_PATH = /`\/(?:vocab|kanji)\/\$\{/;
/** The path builders, and the app-route-to-dictionary-page table (the dictionary's URLs, not the app's routes). */
const ENTRY_PATH_FILES = new Set(['apps/gokan-srs/src/utils/navigation.utils.ts', 'apps/gokan-srs/src/utils/seo.utils.ts']);

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

/**
 * Every JSX opening tag in a file, with the line it starts on. A tag runs to the first `>` outside
 * braces, so a multi-line className and an arrow function prop (`=>`) stay inside it.
 */
function jsxOpeningTags(text: string): { line: number; tag: string }[] {
    const tags: { line: number; tag: string }[] = [];
    const start = /<[A-Za-z][\w.]*[\s/>]/g;
    for (let m = start.exec(text); m; m = start.exec(text)) {
        let depth = 0;
        let end = m.index + 1;
        for (; end < text.length; end++) {
            const c = text[end];
            if (c === '{') depth++;
            else if (c === '}') depth--;
            else if (c === '>' && depth === 0) break;
        }
        tags.push({ line: text.slice(0, m.index).split('\n').length, tag: text.slice(m.index, end + 1) });
    }
    return tags;
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
        if (/\.(js|jsx|mjs|cjs)$/.test(file)) {
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
            eachLine(text, l => SERIF_BODY_TEXT.test(l), line =>
                add({ file, line, rule: 'serif-body-text', message: 'font-serif at a body size (text-xs/sm/base, or 12 to 17px). Body copy is sans (type-body, type-support, type-meta or font-sans): Source Serif 4 has no CJK glyphs, so inline Japanese falls back to boxes (docs/DESIGN_SYSTEM.md section 3).' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
            eachLine(text, l => UNTYPED_DT.test(l), line =>
                add({ file, line, rule: 'type-role', message: 'A <dt> takes a type role in its className (type-label, type-meta...), not a hand-built size, weight and colour (docs/DESIGN_SYSTEM.md section 3).' }));
            for (const { line, tag } of jsxOpeningTags(text)) {
                if (/\splaceholder=/.test(tag) && /\bfont-(?:gothic|mincho)\b/.test(tag) && !/\bplaceholder:font-sans\b/.test(tag)) {
                    add({ file, line, rule: 'placeholder-font', message: 'A field in a Japanese face sets `placeholder:font-sans`: the placeholder inherits font-gothic/font-mincho otherwise, and the `--font-sans` fallback draws Japanese placeholders in Noto Sans JP (docs/DESIGN_SYSTEM.md section 3).' });
                }
            }
        }

        if (GOKAN_SRS_SOURCE.test(file) && file !== TIME_UTILS_FILE) {
            eachLine(text, l => LOCALE_DATE_TIME.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'date-formatting', message: 'toLocaleDateString/toLocaleTimeString/dateStyle/timeStyle belong only in utils/time.utils.ts; use its formatters.' }));
        }

        if (DATASET_URL_SOURCE.test(file) && file !== DATASET_URL_HELPER && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => l.includes('/dataset/') && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'dataset-url', message: 'Build dataset URLs with datasetUrl() (services/http.ts); it adds the dataset version browsers cache by.' }));
        }

        if (AUDIO_URL_SOURCE.test(file) && file !== AUDIO_URL_HELPER && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => l.includes('/audio/') && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'audio-url', message: 'Build audio clip URLs with audioUrl() (@gokan/dataset-schema, audio.ts), the one place both apps learn where clips are served.' }));
        }

        if (DICTIONARY_SOURCE.test(file) && file !== DICTIONARY_DATA_HOLDER && !file.endsWith('.test.ts')) {
            eachLine(text, l => DICTIONARY_DATA_IMPORT.test(l), line =>
                add({ file, line, rule: 'dictionary-data', message: 'Only lib/server/dictionary.ts (and tests) import lib/dataset.server.ts. A page reads the dataset through the DictionaryData it chooses (lib/types.ts), never a loader.' }));
        }

        if (DICTIONARY_CLIENT.test(file)) {
            for (const match of text.matchAll(URLS_IMPORT)) {
                const names = match[1].split(',').map(name => name.trim().split(/\s+as\s+/)[0]);
                if (!names.includes('localeUrls')) continue;
                add({
                    file,
                    line: text.slice(0, match.index).split('\n').length,
                    rule: 'locale-links',
                    message: 'The search script links through linkUrls(locale) (lib/localeLinks.ts): localeUrls would link a page its section does not serve.',
                });
            }
        }

        if (/^apps\/gokan-dictionary\/src\/.*\.svelte$/.test(file) && file !== DETAIL_TABS_COMPONENT) {
            eachLine(text, l => DETAIL_TABS_ROW.test(l), line =>
                add({ file, line, rule: 'one-detail-tabs', message: 'Writes a detail page\'s tab row. Use DetailTabs (pages/DetailTabs.svelte), the one row client/detailTabs.ts reads, so every detail page\'s tabs stay alike.' }));
        }

        if (DICTIONARY_PAGE_COMPONENT.test(file)) {
            for (const trail of text.matchAll(BREADCRUMB_TRAIL)) {
                for (const label of trail[1].matchAll(QUOTED_LABEL)) {
                    add({
                        file,
                        line: text.slice(0, trail.index + 'trail={['.length + label.index).split('\n').length,
                        rule: 'breadcrumb-label',
                        message: 'A breadcrumb step written as a string literal. Take its label from the catalog (pageLocale().messages: chrome.sections, chrome.grammarTabs, chrome.crumbs), as the home step does.',
                    });
                }
            }
        }

        if (ENGLISH_FILE_SOURCE.test(file)) {
            eachLine(text, l => ENGLISH_FILE_IMPORT.test(l), line =>
                add({ file, line, rule: 'english-file', message: 'No app imports englishFile/englishInputs: a dataset file is built in its English shape only by the reader both apps share (publishedDatasetReader, englishDatasetFile in @gokan/dataset-schema/published-dataset). In gokan-srs, load it through fetchDatasetFile.' }));
        }

        if (REMOVED_SYNC_STEP_SCOPE.test(file) && !REMOVED_SYNC_STEP_ALLOWED.has(file) && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => REMOVED_SYNC_STEP.test(l), line =>
                add({ file, line, rule: 'removed-sync-step', message: 'Names the dataset sync step removed in #211 (sync-dataset, sync:dataset, dataset:sync, public/data/compiled). The app reads the published dataset at /dataset/ (services/http.ts); describe that, or record the history in docs/MODIFICATION_LOG.md.' }));
        }

        const importerPage = pageFolderOf(file);
        if (importerPage !== null && /\.tsx?$/.test(file)) {
            for (const match of text.matchAll(MODULE_IMPORT)) {
                const target = posix.normalize(posix.join(posix.dirname(file), match[1] ?? match[2]));
                const targetPage = pageFolderOf(target);
                if (targetPage === null || targetPage === importerPage) continue;
                if (CROSS_PAGE_ALLOWED.has(`${file.slice(SRS_PAGES.length)} -> ${target.slice(SRS_PAGES.length)}`)) continue;
                add({
                    file,
                    line: text.slice(0, match.index).split('\n').length,
                    rule: 'cross-page-import',
                    message: `pages/${importerPage}/ imports from pages/${targetPage}/. What two pages share is a building block: move it to components/, hooks/ or utils/ and list it in AGENTS.md.`,
                });
            }
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

        if (GOKAN_SRS_SOURCE.test(file) && file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
            eachLine(text, l => RENDERED_HEADWORD.test(l) && !JAPANESE_FACE.test(l), line =>
                add({ file, line, rule: 'headword-japanese-face', message: 'Renders a headword without a Japanese face. Add font-mincho, font-gothic or a jp- class to its element: the inherited face may have no CJK glyphs (docs/DESIGN_SYSTEM.md section 3).' }));
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
                if (RUNS_INSTALL.test(job.text) && !SUBMODULE_CHECKOUT.test(job.text)) {
                    eachLine(job.text, l => HOOKED_GIT.test(l), offset =>
                        add({ file, line: job.line + offset - 1, rule: 'check-with-dataset', message: `Job \`${job.name}\` installs dependencies, which sets the git hooks, then commits or pushes without \`--no-verify\`: the hook runs \`bun run check\` without the dataset and fails. Pass \`--no-verify\` (the PR's CI checks it), or check out with \`submodules: true\`.` }));
                }
                const code = job.text.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
                const header = job.text.split(/^ {4}steps:/m)[0];
                if (DICTIONARY_BUILD.test(code) && !JOB_LEVEL_LOCALES.test(header)) {
                    add({ file, line: job.line, rule: 'job-level-locales', message: `Job \`${job.name}\` builds the dictionary without \`VITE_DICTIONARY_LOCALES\` in the job's \`env\`. Set it there, not on one step: check:parity starts builds of its own that only see the job's env.` });
                }
            }
        }

        if (PRODUCTION_TERRAFORM.test(file)) {
            eachLine(text, l => {
                const m = CACHE_POLICY_ASSIGNMENT.exec(l);
                return !!m && !MANAGED_CACHE_POLICIES.has(m[1].replace(/^"(.*)"$/, '$1'));
            }, line => add({ file, line, rule: 'free-plan-policies', message: `A cache policy that is not a managed one by its ID (${[...MANAGED_CACHE_POLICIES].map(([id, name]) => `${name} "${id}"`).join(', ')}). Production's distribution is on CloudFront's Free plan, which refuses a custom cache policy: the whole apply fails. Use a managed policy, or add one to MANAGED_CACHE_POLICIES with its name.` }));
            eachLine(text, l => HEADERS_POLICY_ASSIGNMENT.test(l), line =>
                add({ file, line, rule: 'free-plan-policies', message: 'Attaches a response headers policy. Production\'s distribution is on CloudFront\'s Free plan, which refuses a custom one: the whole apply fails. Set a header in a viewer-response CloudFront Function (as page_cache_control in modules/dictionary-server).' }));
            eachLine(text, l => WAF_RULE_RESOURCE.test(l), line =>
                add({ file, line, rule: 'free-plan-policies', message: 'Adds a rule to a WAF web ACL. Production\'s web ACL belongs to CloudFront\'s Free plan, which refuses a custom rule (WAFFeatureNotIncludedInPricingPlanException): the apply fails. The dictionary\'s server is capped by its reserved concurrency and watched by its usage alarms instead.' }));
        }

        if (TERRAFORM_FILE.test(file)) {
            for (const match of text.matchAll(EMAIL_VARIABLE)) {
                if (!SENSITIVE.test(match[2])) {
                    add({ file, line: text.slice(0, match.index).split('\n').length, rule: 'private-email', message: `Variable \`${match[1]}\` holds an email address without \`sensitive = true\`: the plan, published to a public run summary, would print it. Declare it sensitive (and wrap a \`count\` that reads it in \`nonsensitive(... != "")\`).` });
                }
            }
        }

        if (WORKFLOW.test(file)) {
            eachLine(text, l => EMAIL_FROM_VARS.test(l), line =>
                add({ file, line, rule: 'private-email', message: 'Sets a Terraform email variable from an Actions variable, which every step\'s log prints unmasked in a public repository. Read it from a secret (`${{ secrets.NAME }}`), which GitHub masks.' }));
            eachLine(text, l => FIXED_SITE_INVALIDATION.test(l), line =>
                add({ file, line, rule: 'selective-invalidation', message: 'Invalidates a site by a fixed wildcard on every deploy, clearing pages that did not change. A deploy clears what changed: the paths deploy-s3.ts --invalidations lists (invalidationFor, packages/deploy/src/invalidation.ts), or "/*" after a failure.' }));
            const starts = [...text.matchAll(WORKFLOW_STEP_START)].map(m => m.index);
            const steps = starts.map((start, i) => ({ start, body: text.slice(start, starts[i + 1] ?? text.length) }));
            const lineAt = (offset: number) => text.slice(0, offset).split('\n').length;
            for (const { start, body } of steps) {
                const condition = body.split('\n').find(l => FAILURE_ONLY_CONDITION.test(l));
                if (condition === undefined || !body.includes('create-invalidation') || CANCELLED_CONDITION.test(condition)) continue;
                add({ file, line: lineAt(start), rule: 'selective-invalidation', message: 'Clears the cache on failure() only. A cancelled run after an upload stored its manifest leaves the next deploy seeing nothing changed, and the old responses cached for a year: run it on (failure() || cancelled()).' });
            }
            // The server keeps dataset indexes for an instance's lifetime: its new code goes live
            // only once the dataset's invalidation has completed, or an instance started in between
            // renders cleared pages from a stale file, cached a year. So in a deploy that lists what
            // to clear, the server's step needs an earlier, unconditional step clearing /dataset/ and
            // waiting for it (a skipped one, as staging's was, leaves the race open).
            const serverStep = steps.findIndex(({ body }) => body.includes('update-function-code'));
            if (serverStep !== -1 && text.includes('--invalidations')) {
                // Comment lines left out: a step's slice runs on to the comment above the next one.
                const datasetWaited = steps.slice(0, serverStep).some(({ body }) => {
                    const code = body.split('\n').filter(l => !/^\s*#/.test(l));
                    const joined = code.join('\n');
                    return joined.includes('create-invalidation') && joined.includes('/dataset/') && joined.includes('wait invalidation-completed')
                        && !code.some(l => /^\s*-?\s*if:/.test(l));
                });
                if (!datasetWaited) {
                    add({ file, line: lineAt(steps[serverStep].start), rule: 'selective-invalidation', message: 'Updates the dictionary server\'s code with no earlier, unconditional step clearing /dataset/ and waiting for it (aws cloudfront wait invalidation-completed). The server keeps dataset indexes for an instance\'s lifetime, so an instance started before the dataset\'s invalidation completes renders the cleared pages from a stale file, cached a year.' });
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
        if (SHARED_SYNONYM_SOURCE.test(file) && !SHARED_SYNONYM_READERS.has(file) && !/\.test\.ts$/.test(file)) {
            eachLine(text, l => SHARED_SYNONYM_DATA.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'one-synonym-reader', message: 'Reads the dataset\'s synonym pairs. Go through @gokan/dataset-schema\'s synonyms.ts (synonymEntriesOf, synonymSections, pairCloseness), held equal to the app\'s grading by its test, so the dictionary and the app read a pair the same way.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && !DUE_DATE_READERS.has(file) && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => DUE_DATE_READ.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'effective-due-date', message: 'Reads a stored dueDate, or compares the cached nextReviewAt. Go through services/scheduling.ts (effectiveDueDate, isEntryDue, isVocabDue, isFirstReviewDue) or grammarScheduling.ts, so every reader follows the review pacing the queue uses.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file !== RUBY_COMPONENT && !file.endsWith('.test.tsx')) {
            eachLine(text, l => RUBY_ELEMENT.test(l), line =>
                add({ file, line, rule: 'one-ruby', message: 'Furigana renders through Ruby (components/Ruby.tsx): each reading over its kanji only (rubyParts), neighbouring readings kept apart.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file.endsWith('.tsx') && file !== SLOT_CHOICES_COMPONENT && !file.endsWith('.test.tsx')) {
            eachLine(text, l => SLOT_CHOICES_WALK.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'one-choice-list', message: 'Draws a slot\'s options. Use SlotChoices / ChoiceNotes (components/quiz/SlotChoices.tsx), so every exercise answered by picking shows its options, the one that fits and a wrong pick the same way.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file.endsWith('.tsx') && !file.endsWith('.test.tsx')) {
            eachLine(text, l => RAW_POS.test(l), line =>
                add({ file, line, rule: 'pos-labels', message: 'Renders a raw part-of-speech code. Take the sense\'s posLabel from organizeSenses (utils/senses.utils.ts), in the page\'s sense order.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && !ENTRY_PATH_FILES.has(file) && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => HAND_BUILT_ENTRY_PATH.test(l), line =>
                add({ file, line, rule: 'entry-paths', message: 'Builds a word or kanji path by hand. Use vocabPath / kanjiPath (utils/navigation.utils.ts), so every link to an entry is one URL.' }));
        }

        if (GOKAN_SRS_SOURCE.test(file) && file !== WORD_READING_COMPONENT && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => WORD_READING_MARK.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l), line =>
                add({ file, line, rule: 'one-word-reading', message: 'A word\'s reading row is WordReading (components/WordReading.tsx): where its play button goes, and how its readings wrap, is decided once for the word page and the intro.' }));
        }

        if (SRS_COMPONENT.test(file) && !/\.test\.tsx?$/.test(file)) {
            eachLine(text, l => IMPORT_FROM_PAGES.test(l), line =>
                add({ file, line, rule: 'components-not-from-pages', message: 'A shared component imports from pages/. Shared building blocks live in components/, hooks/ and utils/, and pages use them: move what it needs out of the page module.' }));
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
        // DetailTabsBody is DetailBody's tabs, with the tab state's panels and sections.
        if (DETAIL_SCREEN.test(file) && !(text.includes('<DetailHeader') && /<DetailBody\b|<DetailTabsBody\b/.test(text))) {
            add({ file, rule: 'detail-layout', message: 'A detail page is DetailHeader then DetailBody or DetailTabsBody (components/detail/), like the vocab, kanji and grammar pages.' });
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
    if (files.some(f => f === DEPLOY_SITE || f === DEPLOY_STAGING || f === CHECK_DEPLOYED || f === REVIEW_STAGING)) {
        for (const v of deployedLocaleViolations()) add(v);
    }
    if (files.some(f => GITHUB_DIR_FILE.test(f))) {
        for (const v of dispatchedWorkflowRunViolations()) add(v);
    }
    if (files.some(f => f === DETAIL_BREAKPOINT_FILES.dictionary || f === DETAIL_BREAKPOINT_FILES.srs)) {
        for (const v of detailBreakpointViolations(read(DETAIL_BREAKPOINT_FILES.dictionary), read(DETAIL_BREAKPOINT_FILES.srs))) add(v);
    }

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
