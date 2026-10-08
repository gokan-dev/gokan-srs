# Agent guide: Gokan monorepo

This is the one file of project rules. `CLAUDE.md` and `GEMINI.md` only import it, so every
agent (Claude, Gemini, Codex, CI agents) reads the same conventions. Follow every rule below
from the first line you write: they are not style preferences to apply after review. Each one
exists because the problem it prevents has already happened in this codebase.

Most rules are enforced by `bun run check`, which runs on every commit (git hook), after every
file edit (Claude Code hook) and in CI. A red check is never fixed by relaxing a rule,
disabling a lint, or adding an exemption: fix the code, or change the convention here
deliberately and say so in the PR.

## What this repo is

Gokan (語感) is a Japanese study instrument, not a game: calm, precise, trustworthy.

- `apps/gokan-srs`: the SRS learning app (React 19, TypeScript, Vite, Tailwind v4).
- `apps/gokan-dictionary`: a static, crawlable dictionary (Svelte 5 SSR at build time).
- `packages/dataset-schema` (`@gokan/dataset-schema`): the compiled-dataset types both apps use.
- `packages/deploy` (`@gokan/deploy`): the content-addressed S3 deploy both apps ship with.
- `apps/gokan-srs/dataset`: git submodule of the separate `gokan-dataset` repo (raw data, build
  pipeline, compiled output). It has its own conventions and tests.

How the system works (state machine, SRS formula, grammar curriculum, sync, deployment) is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read the section for the area you are changing
before changing it, and update it when behaviour changes. Visual rules are in
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

## Workflow

- Install: `git submodule update --init --recursive`, then `bun install` at the root.
- Before every commit: `bun run check`. It runs lint (both apps, one config), typecheck (both
  apps and the scripts), tests (both apps), the conventions check and the duplicate check.
  Faster partial runs while iterating: `bun run lint`, `bun run typecheck`, `bun run test`,
  `bun run check:conventions`, `bun run check:duplicates`.
- A bug fix comes with a test that fails without the fix.
- `git log` is the record of what changed. Add an entry to
  [docs/MODIFICATION_LOG.md](docs/MODIFICATION_LOG.md) only for reasoning a diff cannot show:
  an investigation's result, why the obvious approach was rejected, or an interaction a later
  change could silently undo.
- Line endings are LF everywhere (`.gitattributes`).
- Dataset changes belong in the `gokan-dataset` repo: commit and push inside the submodule
  first, then commit the new pointer here.

## Writing rules

- **No em dashes** (U+2014) anywhere: code, comments, docs, commit messages, PR text, UI copy.
  Use a colon, parentheses, a comma, or reword. Enforced.
- UI copy is neutral, direct and encouraging without cheerleading: no exclamation-mark praise,
  no gamified language.
- Comments explain why, not what. Match the density of the surrounding code.

## Typing: everything is typed

- TypeScript only. `.ts`, `.tsx`, and `.svelte` with `<script lang="ts">`. The single
  JavaScript file is `apps/gokan-dictionary/svelte.config.js`, because Svelte's tooling only
  reads a JS config; it is `// @ts-check`ed. Enforced.
- No `any`, written or leaked: `no-explicit-any` and every `no-unsafe-*` rule are errors, so an
  untyped value (a raw `JSON.parse`, an untyped library return) cannot flow into typed code.
- No escape hatches: no `as never`, no `as unknown as`, no `@ts-ignore` / `@ts-nocheck`.
  `@ts-expect-error` needs a written reason. An object literal is never asserted to a type
  (`{...} as T` skips the missing-property check): annotate it instead.
- **Untrusted data is parsed once, at the boundary.** Anything from `fetch`, `localStorage`,
  Drive or `JSON.parse` enters as `unknown` and is narrowed in one place: `services/http.ts`
  (`fetchJson`, `readJson`) for HTTP, `services/progressHydration.ts` (`parseStoredProgress`,
  `parseStoredSettings`, the `Stored<T>` types) for persisted progress. Past that point values
  are fully typed. Never re-cast the same data later.
- Persisted shapes are typed as stored (`Stored<T>`: dates as strings, sets as arrays) and
  hydrated before any logic runs. Migration code operates on hydrated values.
- A `switch` over a union names every member (`switch-exhaustiveness-check`), so adding a
  union member fails everywhere it is not handled yet.
- Compiled-dataset types (`Vocabulary`, `Kanji`, `Sentence`, `GrammarPoint`, index shapes,
  `TagsLookup`...) come only from `@gokan/dataset-schema`. App model files hold app state only
  (progress, settings). Redeclaring a schema type in an app is an error; derive narrower types
  with `Pick`/`Omit` under a different name. Enforced.
- Unused variables are errors; prefix a deliberately unused parameter with `_`.
- Every `eslint-disable` carries a reason: `// eslint-disable-next-line rule -- why`. A disable
  that no longer suppresses anything is an error. Enforced.

## No duplication: share, never copy

Before writing a component, hook, helper, style rule or test fixture, search for an existing
one and extend it. Two copies always drift; this codebase has paid for it repeatedly (three
diverging copies of the dataset models, several quiz cards each with their own submit flow,
a dozen test files each with their own fixtures). `bun run check:duplicates` fails on any copied
block of 60+ tokens in production code (120+ in tests).

- Code both apps need goes in a package under `packages/`. The apps never import from each
  other (enforced by lint).
- If two places need the same thing with a small difference, make the shared piece take a
  parameter; do not fork it.

### Shared building blocks (use these)

Both apps: a word is named through `headwordOf`, `secondaryForm` and `headwordWithReading`
(`searchHeadword` / `searchSecondaryForm` for search rows) from `@gokan/dataset-schema`, never by
reading `writtenForm.kanji` for display: a word learned in kana (`usuallyKana`) is shown in kana.

gokan-srs, quizzes. **Every quiz is an exercise, and every exercise runs on one engine
(`services/exercise/`, see the Exercise engine section of docs/ARCHITECTURE.md).** An activity
(vocab, grammar) hosts exercises; what differs between exercises is data, never a separate flow.
Four layers, each the only place its question is answered:

- What is asked: an `Exercise` (`kind`, `host`, `slots`, `cue`, and what its card shows), built
  once at load by `vocabExercise` / `grammarExercise` (`builders.ts`). Accept-lists are
  assembled only by the slot builders (`readingSlot`, `meaningSlot`, `wordSlot` in `slots.ts`).
- Grading: `gradeExercise` / `gradeSlot` (`grading.ts`) is the only grader: typos, the kanji
  skeleton, other forms of a word, near-synonyms judged against the cue. Its primitives
  (`matchAnswer`, `matchBest` from `utils/answerMatching.ts`, `isFormOfWord` from
  `utils/inflection.utils.ts`, the synonym helpers) are imported only by the engine (enforced).
- SRS effects: `effectsOf` decides what an answer does (`review`, `retry`, `reinforce`,
  `defer`); `applyEffects` (`effects.ts`) writes it, on Continue, against the current progress.
- Turn and cards: `context/quiz/exerciseReducer.ts` (answers, hints, feedback, one action family
  for both activities) and `useExerciseTurn` (submit, continue, auto-advance, the AI check).
  Every card is a `SingleAnswerCard`, `SentenceClozeCard` or `StudyCard` (`components/quiz/`),
  chosen in one exhaustive switch, `pages/exercise/ExerciseCard.tsx`.

**Adding an exercise**: its `kind` in `ExerciseKind` with what its card shows, its builder, its
prompt (in the activity's `pages/` folder) and its case in `ExerciseCard`. Nothing else: grading,
feedback, hints, focus, auto-advance and SRS writes come with the engine, and the exhaustive
switches fail to compile until every new case is handled. A new rule for answers (a tolerance,
a credit) goes in the engine, so every exercise gets it.

The rest of the study flow:

- Scheduling: `SRSService.calculateNextState` is the one formula (grammar reuses it through
  `GrammarSRSService`). Due dates and mastery are derived only by `services/scheduling.ts` and
  `services/grammarScheduling.ts`; never hand-set `nextReviewAt` or `stage`.
- Calibration: `services/calibration.ts`, per quiz type, recorded by `applyEffects` only.
- Sentences: `utils/sentenceRanking.ts` for every activity that picks an example; a sentence with
  blanks is a `ClozeSentence` (`utils/clozeSentence.utils.ts`); a grammar example becomes a
  `Sentence` through `grammarExampleToSentence` (`utils/grammarSentence.utils.ts`).
- Session flow: `useSessionLifecycle`, `components/SessionProgress.tsx` (counter, ticker, gains),
  the commit pipeline in `quizSelectors.ts` shared by the preview and the session.
- Card building blocks: `components/quiz/` (`QuizCardFrame`, `QuizMasteryCorner`,
  `SubmitButton`, `ContinueButton`, `FeedbackNote`, `ClozeBlank`, `ExpandableSenses`,
  `Headword`, `quizStyles.ts` for result colours), `hooks/useQuizFocusManagement.ts` for
  keyboard flow, `components/MasteryRing.tsx`.

gokan-srs, everything else:

- Data loading in components: `hooks/useAsyncData.ts`. Time: `hooks/useNow.ts`,
  `utils/time.utils.ts`. Debounce: `hooks/useDebouncedValue.ts`.
- Lists and stats: `components/SmartList.tsx` (+ `utils/smartList.utils.ts`),
  `components/ui/Pagination.tsx`, `pages/stats/components/CoverageChart.tsx` and
  `utils/coverage.utils.ts`, `utils/activity.utils.ts`, `utils/winRate.utils.ts`.
- Detail pages: `components/detail/` (`DetailCard`, `DetailField`, `DetailErrorScreen`,
  `SrsStatsCard`), `components/RelatedEntriesCard.tsx`, `components/SRSHistoryGraph.tsx`,
  `components/ProgressCard.tsx`, `components/InteractiveSentence.tsx`,
  `pages/grammar/GrammarExampleList.tsx`.
- Settings controls: `components/ui/SettingToggle.tsx`, `SettingSlider.tsx`, `components/OptionGrid.tsx`,
  `components/LearningOrderPicker.tsx`, `components/QuizSettingsMenu.tsx`.
- Small UI: `components/TagChip.tsx`, `components/CardSkeleton.tsx`,
  `components/KanjiSpellingNote.tsx` (the kanji spelling of a word learned in kana).
- Words learned in kana in the learning orders: `utils/usuallyKana.utils.ts`
  (`orderIncludesUsuallyKana`, the per-session pacer); scheduling asks `isReadingRelevant`.
- Test fixtures: `src/test/fixtures.ts` (`vocabProgress`, `grammarProgress`, `userProgress`,
  `userSettings`, `vocabulary`, `grammarPoint`, `srsEntry`...). A test may wrap one in a
  one-line local default, never redeclare it.

gokan-dictionary:

- Page frame and breadcrumb: `pages/PageLayout.svelte` (every page).
- `pages/VocabEntryList.svelte`, `pages/GrammarPointCard.svelte`,
  `pages/ExampleSentenceList.svelte`, `lib/sentenceSegments.ts`.
- Every URL from `lib/urls.ts` (it applies the base path); SEO from `lib/seo.ts`.
- Test fixtures: `src/test/fixtures.ts`.

## Functional rules (gokan-srs)

- **Reducers and selectors are pure.** No `Date.now()`, `new Date()` or `Math.random()` in
  `*Reducer.ts` / `*Selectors.ts` (enforced): the orchestration hooks pass `now` and any
  randomness in. Effects and I/O live in `useQuizOrchestration` / `useGrammarOrchestration`.
- **One source of truth per question.** What to show next: `selectNextView` /
  `selectNextGrammarView`. When something is due: `scheduling.ts`. What a session contains:
  the dedup-then-cap pipeline, run identically for the hub preview and the session. Do not add
  a second place that answers the same question.
- **Grading is pure and synchronous.** `gradeExercise` is the only grader; whatever it needs
  (a word's forms, its near-synonyms, the cue) is resolved when the exercise is built, never
  fetched while grading.
- **An answer writes SRS state only through `applyEffects`** (enforced): `SRSService.applyAnswer`
  and its siblings are never called from a hook, a card or a selector.
- **Persistence and network go through one layer each** (enforced): `localStorage` only via
  `StorageService`, `sessionStorage` only via `hooks/usePersistedControls.ts`, `fetch` only in
  `services/`. Every dataset URL is built by `datasetUrl()` (`services/http.ts`), which adds
  the dataset version browsers cache by (enforced).
- **Progress in localStorage is compacted** (`services/progressCompaction.ts`), behind
  `StorageService`, so code always uses the readable names. A new persisted date field goes in
  its `DATE_KEYS`; a value may be left out of storage only when hydration restores it. Storage
  writes never throw: a full origin is reported (`StorageFullBanner`), never a crash.
- **Data integrity fails loudly.** A dataset file that fails to load is a fatal error, never
  silently skipped.
- **Sync never loses data.** Drive merges are per entry and per direction; queues merge as
  unions. A scoped reset uses the authoritative sync path.
- **Migrations**: new progress fields are additive and defaulted at hydration (no version gate
  needed). Bump `CURRENT_FORMAT_VERSION` whenever the dataset's alias or variant indexes gain
  entries, or stored ids stay stranded.
- **Effects declare their real dependencies.** Prefer `useEffectEvent` for callbacks an effect
  should not re-run on; a remaining `exhaustive-deps` disable needs a reason.

## Design rules

- **Colours only from tokens.** Values are written in exactly two files:
  `apps/gokan-srs/src/index.css` and `apps/gokan-dictionary/src/styles/app.scss`. Elsewhere use
  token classes (`text-error`, `bg-divider`, `text-feedback-correct`, `/opacity` for tints) or,
  for inline styles and SVG, `THEME` in `commons/theme.ts` (CSS variables). No default Tailwind
  palette classes (`text-gray-500`), no numeric shades on tokens (`text-secondary-400` resolves
  to nothing), no hex or `rgb()` in components. Enforced.
- Primary accent for focus and progress; the error colour only for errors and warnings.
  Ordinal data (mastery stages, quiz directions) uses one hue in steps, never several hues.
- Japanese text uses `font-mincho` or `font-gothic`; `font-serif` has no CJK glyphs.
- Motion is minimal: 150-200ms, ease-in-out, no bounce.
- Mobile: inputs are `text-base` on phones (smaller makes iOS zoom), page roots are `w-full`,
  flex/grid children that truncate need `min-w-0`. Check layouts at 320px and 375px.
- Dictionary styles: SCSS, one stylesheet per page type in `styles/pages/`; a rule goes in
  `app.scss` only when two or more page types use it; `_tokens.scss` emits no CSS; Svelte
  components have no `<style>` blocks. The build must stay byte-reproducible (no timestamps or
  build ids in output), or every deploy re-uploads all pages.

## Testing rules

- Vitest in both apps. Pure logic has a colocated `*.test.ts`; every module in
  `apps/gokan-srs/src/utils` and `apps/gokan-dictionary/src/lib` must have one (enforced).
  Reducers, selectors and services are tested directly.
- Tests build data with the shared fixtures (see above), with fresh nested objects; never share
  `history` arrays between fixtures.
- Thin I/O glue (DOM wiring, the prerender script) is verified by running it, not unit tests.
