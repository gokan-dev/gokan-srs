# Agent guide: Gokan monorepo

This is the one file of project rules. `CLAUDE.md` and `GEMINI.md` only import it, so every
agent (Claude, Gemini, Codex, CI agents) reads the same conventions. Follow every rule below
from the first line you write: they are not style preferences to apply after review. Each one
exists because the problem it prevents has already happened in this codebase.

Most rules are enforced by `bun run check`, which runs in CI on every push. Its fast part
(conventions and ESLint) also runs on the changed files after every file edit (Claude Code hook)
and on the staged files at every commit (git hook). A red check is never fixed by relaxing a rule,
disabling a lint, or adding an exemption: fix the code, or change the convention here
deliberately and say so in the PR.

## What this repo is

Gokan (語感) is a Japanese study instrument, not a game: calm, precise, trustworthy.

- `apps/gokan-srs`: the SRS learning app (React 19, TypeScript, Vite, Tailwind v4).
- `apps/gokan-dictionary`: a static, crawlable dictionary (SvelteKit, every page prerendered, no client runtime).
- `packages/dataset-schema` (`@gokan/dataset-schema`): the compiled-dataset types both apps use.
- `packages/deploy` (`@gokan/deploy`): the content-addressed S3 deploy both apps ship with.
- `apps/gokan-srs/dataset`: git submodule of the separate `gokan-dataset` repo (raw data, build
  pipeline, compiled output). It has its own conventions and tests.

How the system works (state machine, SRS formula, grammar curriculum, sync, deployment) is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read the section for the area you are changing
before changing it, and update it when behaviour changes. Visual rules are in
[docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

ARCHITECTURE.md (over 80k tokens) and docs/MODIFICATION_LOG.md (over 50k) are never read whole:
list the headings (`grep -n '^##' docs/ARCHITECTURE.md`), then read only the sections you need,
by line range. A whole read stays in an agent's context for the rest of its run. Not mechanised (a
hook cannot tell a needed section from the rest); every CI agent run lists what it read in its job
summary ("Largest tool results"), which is where a whole read shows.

## Workflow

- Install: `git submodule update --init --recursive`, then `bun install` at the root.
- **CI is where a change is verified, for people and agents alike.** `CI: checks` (the full gate,
  `bun run check`: conventions, lint, typecheck, tests, duplicates, unused code) runs on every
  push; the builds and the browser checks (`check:layout`, `check:lighthouse`, SEO held at 100 on
  every dictionary page, `check:parity`) run on every push that touches what they cover (path
  filters), PR or not, the same way every time. A green run on a docs-only push says nothing about
  layout or Lighthouse on that head. Push the branch,
  then `bun run ci:wait`: it waits for that commit's "CI: ..." runs, prints the failed jobs' logs
  and exits non-zero on a failure. Locally, run only the narrow command that covers what you are
  changing while iterating (one workspace's tests, `bun run typecheck`, `bun run lint`, one check);
  never the full suite or a production build as a gate. No local hook runs them either (no
  pre-push hook). Not mechanised for local runs; the implement prompt says the same (the fix-CI and
  address-feedback prompts follow in a later change).
- A bug fix comes with a test that fails without the fix.
- A convention lives in `bun run check`, not only in prose. When review (human or agent) finds a
  rule this file states that the gate did not catch, the same change adds the check that would
  have caught it (a `check-conventions.ts` rule, an ESLint rule, a test, or a layout assertion)
  and is seen to fail on the pre-fix state. Prose is one review away from regressing; the gate is
  not. A rule that genuinely cannot be mechanised says so, and names what a reviewer must look at.
- Review your own diff before you hand it off. Before opening a PR or tagging a release
  candidate, read the whole diff against this file and, for any UI change, docs/DESIGN_SYSTEM.md:
  run `/code-review` (or an equivalent pass over the diff) and, for UI, look at the result (a dev
  server, or the rc on staging) at 320px, 375px and 1280px, light and dark. Unreviewed work is not handed off
  faster: it moves the same review onto the next reader plus a round trip.
- **Two agents never work on one branch at once.** Every agent job in `.github/workflows/` that
  can push queues on its branch's lock: job-level `concurrency` with
  `group: agent-branch-<branch>`, `cancel-in-progress: false`, `queue: max` (a later run waits,
  none is dropped). A run that waited checks the branch has not moved on before acting.
  Enforced.
- **The pipeline runs per issue, optionally batched into a release.** Labeling an issue
  `ready-for-dev` builds it on `agent/issue-<n>` against `main`: one PR, one version
  (`claude-implement-issue.yml`). A *sprint* is a tracking issue (title `Release X.Y.Z: ...`, body
  an ordered `- [ ] #nnn` task list); labeling it `release-ready` (`claude-start-release.yml`) first
  runs a pre-flight that reads every member and asks the maintainer, in one round, about every
  load-bearing decision the issues leave open (the sprint starts only once nothing is pending, so a
  precision question never stalls it mid-flight) and writes which members wait for which (same
  files or area, or one builds on another; checked by `packages/deploy/src/releaseOrder.ts`, serial
  when invalid), then cuts `release/X.Y.Z` and builds against that branch, at once, every member whose
  waits are merged and that is not in flight (`in-progress`) (each the same
  implement/review/triage/correct round, base-aware: every workflow diffs and syncs against the
  PR's base, not a hardcoded `main`). Triage merges a member into the release branch directly when
  its round ends `done` (no `agent-done` on a release); each merge ticks the tracker (under a
  per-release lock), starts the members it unblocks and syncs those in flight with the release
  branch (a new round), and the last one opens one `release/X.Y.Z -> main` PR, so the maintainer
  approves once per release rather than once per feature. Parallel members share the one staging
  site through a queue: a deploy and its rendered review hold it together (`deploy-staging.yml`'s
  `staging-site` group), and rc numbers are taken under a per-release lock. Triage (`claude-triage.yml`) asks the maintainer only for choices that are
  costly to reverse or change scope; a reversible choice with a clear recommendation is applied and
  noted under "Decided by default". The workflow, not the agent, decides from the brief's sections
  (`scripts/lib/triageOutcome.ts`): a round 1 that leaves only defaults is `finish` (they are
  applied with no staging round; triage of that push waits for CI, then sorts its PR review with the
  round 2+ bar), and from round 2 on polish starts no round: it is left on the PR and the release
  tracker for one final pass. Every
  answer to a triage that pushes nothing (a brief, or a decision such as "stop") goes back to triage,
  so it ends in done or decide. Fix CI (`claude-fix-ci.yml`) acts on agent commits too, bounded by a
  count (`scripts/lib/fixCiGate.ts`: one attempt a commit, three in a row with no done or decide
  triage, decision or word from the maintainer before they are asked), and only a failed run takes
  the branch lock. The agents' CI wait is the default branch's `scripts/ci-wait.ts`, run from a
  worktree, so a branch cut before it verifies the same way (enforced, with every `triage.ts`
  command a workflow runs: `pipeline-command`). An interrupted run (crash, turn limit, usage limit) resumes
  itself from the commits it pushed: the implement workflow's own last job (`resume`) decides as the
  run ends, `claude-sweep.yml` sweeps hourly as a backstop, both through
  `.github/actions/resume-issue`, bounded by progress and escalating with `needs-attention` when a
  branch stops advancing. `pause-automation` on an issue opts it out. Nothing reacts through
  `workflow_run` to a workflow we dispatch: GitHub creates no such event for a run started with
  `GITHUB_TOKEN`, which every dispatch uses (enforced: `workflow-run-of-dispatched`). A
  `workflow_run` listener watches only existing workflow names, each running on an event it
  accepts (for fix-ci, `BRANCH_CI_EVENTS`), so renaming a CI workflow or changing its triggers is
  checked against them (enforced: `workflow-run-listener`). The
  review-side agents (review, staging review, triage, address-feedback, fix-ci, the release
  pre-flight, on-demand) are not dispatched per issue, so `claude-retry.yml` re-runs any of their
  runs that failed recently (a usage limit, a transient error), capped by attempt count.
- A change that ships in the deployed apps (`shipsInDeployment`) records itself for the What's new
  page and the app's version. On `main` (a single issue) it adds one entry at the top of
  `apps/gokan-srs/release/changelog.ts`: the next minor (the version its rc tags carry), the day,
  one plain sentence a learner can read, the issue. On a `release/X.Y.Z` branch (a sprint) it adds
  one `apps/gokan-srs/release/changelog.d/<issue>-<slug>.md` fragment instead (that one sentence),
  never editing `changelog.ts`: `release/assemble-fragments.ts` folds every fragment into one
  `X.Y.Z` entry when the release opens its `-> main` PR, so the sprint ships as a single version.
  The build and a test refuse a list out of order or malformed; that a shipping change recorded
  itself (an entry on `main`, a fragment on a release) is not mechanised (`bun run check` has no
  base branch to diff against), so a reviewer checks it against the diff.
  A change that ships code but nothing a learner sees (a refactor, tooling a build imports, a change
  the gate proves leaves the output identical, such as `check:parity --expect identical` or an
  equality test) adds no entry (nor, on a release branch, a fragment), so the app's version does
  not move: its PR says so, and names what proves it. The assembled entry's headline comes from
  the tracker's title, which may name such a member: assemble lists every member with no fragment
  beside the headline it wrote (`--members`, `headlineReview`), but whether a phrase names one is
  not mechanised, so a reviewer checks the release PR's headline against the members that have
  fragments, and strips what a learner cannot see.
- `git log` is the record of what changed. Add an entry to
  [docs/MODIFICATION_LOG.md](docs/MODIFICATION_LOG.md) only for reasoning a diff cannot show:
  an investigation's result, why the obvious approach was rejected, or an interaction a later
  change could silently undo.
- Line endings are LF everywhere (`.gitattributes`).
- Dataset changes belong in the `gokan-dataset` repo: commit and push inside the submodule
  first, then, once its CI has committed `compiled/`, commit the new pointer here (at the bot's
  commit, below).
- **Never build the dataset locally: its CI does.** Push the change (sources, scripts, types,
  `data/audio/` (the clips and `clips.json`)) to a gokan-dataset branch. Its Build workflow builds incrementally
  (each stage is skipped while its inputs are unchanged), runs the tests, and commits `compiled/`
  and the generated docs back to the branch as a bot commit (`github-actions[bot]`, "Build
  compiled/ from <sha>"). On main it also checks that a full rebuild from the raw sources is
  byte-identical. Wait for the Build run of the commit you pushed (keyed to its sha, not the
  newest run on the branch, which right after a push is often the previous push's), pull the bot
  commit "Build compiled/ from <your pushed sha>" before pushing again, and point this repo's
  submodule only at it (or, when the run for that same sha passed and made no commit, since
  nothing in `compiled/` changed, at the pushed commit itself). A local build reads about 400 MB of LFS sources and rewrites about 160k files in
  `build/`: over an hour on a Windows machine. What stays local writes inputs, never
  `compiled/`: fetching sources (`fetch:media`, `fetch:covers`) and making audio clips
  (`build:audio`, which needs the engine; CI attaches them). The dataset's `check:schemas` reads
  only the committed `compiled/` and still runs locally (its `check:layout` compares against
  `build/`, so it runs in its CI). A pointer is valid when a Build run that passed exists for the
  pointer's sha and made no commit (no bot commit "Build compiled/ from <that sha>" exists in the
  dataset repo), or the pointer is a bot commit "Build compiled/ from <sha>" whose named sha has
  a passing Build run (the bot pushes with `GITHUB_TOKEN`, so its own commit starts no Build run:
  that is why the bot-commit case checks the sha it names). Not mechanised yet: a CI step here,
  when the submodule pointer moves, could check that condition through
  `gh api repos/gokan-dev/gokan-dataset/commits/<sha>/check-runs`, against the pointer's sha or
  the sha its bot commit names, and, for a pointer that is not a bot commit, find that no commit
  names its sha (`git log --all --grep "Build compiled/ from <sha>"` over the dataset's history).
  Until then a reviewer checks the same condition on a pointer bump.

## Writing rules

- **No em dashes** (U+2014) anywhere: code, comments, docs, commit messages, PR text, UI copy.
  Use a colon, parentheses, a comma, or reword. Enforced.
- UI copy is neutral, direct and encouraging without cheerleading: no exclamation-mark praise,
  no gamified language.
- Comments explain why, not what. Match the density of the surrounding code.

## Typing: everything is typed

- TypeScript only. `.ts`, `.tsx`, and `.svelte` with `<script lang="ts">`. There is no
  JavaScript file: since SvelteKit 3 the dictionary's configuration is in its `vite.config.ts`
  (`svelte.config.js` is gone). Enforced.
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
A word's textbook lessons are named through `textbookLessonsLabel`, how common it is through
`frequencyBand` (a band and a round "Top 300 words", never a bare rank). A kanji's kun reading is
shown through `kunReadingLabel` (まな(ぶ), enforced); its learning orders through `KANJI_ORDERS`,
`kanjiOrder`, `KANJI_BOOKS` and `kanjiBookPositions`, its grade through `kanjiGradeLabel`. Also shared by both apps,
from the same package: romaji (`romajiToHiragana` and `readRomajiQuery` read Hepburn; `kanaToHepburn`
writes it, so they read it back; `kanaToRomaji` writes IME keystrokes, ん as `nn`, for typo distances
and search keys, never to be read back as Hepburn; `toHiragana`, `looksLikeRomaji`), a sentence's linked and highlighted runs (`segmentInteractiveSentence`), a
reading split over a word's kanji runs for furigana (`rubyParts`), a clip's URL (`audioUrl`, enforced),
the one-clip-at-a-time player both apps' play buttons run on (`createClipPlayer`), a grammar example as a
`Sentence` (`grammarExampleToSentence`, `patternHighlightRanges`) and a word's pitch accent
(`primaryPitchAccent`, `moraeOf`, `pitchContour`, its English screen-reader words `pitchAccentLabel`,
drawn from `pitchPaths`, with the sizes it gives, by gokan-srs's `components/PitchAccent.tsx` and the
dictionary's `pages/PitchAccent.svelte`).

gokan-srs, quizzes. **Every quiz is an exercise, and every exercise runs on one engine
(`services/exercise/`, see the Exercise engine section of docs/ARCHITECTURE.md).** An activity
(vocab, grammar) hosts exercises; what differs between exercises is data, never a separate flow.
Four layers, each the only place its question is answered:

- What is asked: an `Exercise` (`kind`, `host`, `slots`, `cue`, and what its card shows), built
  once at load by `vocabExercise` / `grammarExercise` (`builders.ts`). Accept-lists are
  assembled only by the slot builders (`readingSlot`, `meaningSlot`, `wordSlot`, `textSlot`,
  `choiceSlot` in `slots.ts`). How a slot is answered is data on it too, so any exercise of any
  activity can use it: `given` (the dictionary form shown beside a blank that asks for a form
  of it) and `choices` (picked from options, each wrong one with its reason, graded exactly).
- Grading: `gradeExercise` / `gradeSlot` (`grading.ts`) is the only grader: typos, the kanji
  skeleton, other forms of a word, near-synonyms judged against the cue. A synonym pair is read only
  through `services/exercise/wordRelation.ts` (`relationOf`, `outcomeOf`, `OUTCOME_LOOK`,
  `listedSynonymsOf`, `closenessOf`): grading, the cards, the ticker and a word page's Synonyms
  card agree on a pair's tier
  (enforced: `VocabSynonym` / `.synonyms` nowhere else). Outside the app, the package and the dictionary
  read a pair only through `@gokan/dataset-schema`'s `synonyms.ts` (`synonymEntriesOf`, `synonymSections`,
  `pairCloseness`), whose `pairCloseness` an app test holds equal to `closenessOf` for every kind of pair
  (enforced, the same rule). Its primitives
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
  `Sentence` through `grammarExampleToSentence` (`@gokan/dataset-schema`).
- Contrast drill (practice outside the SRS, issue #249): its sets and cards only from
  `context/quiz/drillSelectors.ts` (`loadDrill`, `hasDrill` for its button, `rulesOut` decides an
  example card's wrong options, a contrast case its own: `caseCardOf`), its types (`DrillSet`, `DrillPointInfo`) in `models/grammar.model.ts`, its run
  through the `drill` exercise host and `drillReducer.ts` (kept on a lookup, ended elsewhere:
  `drillRouteRole`), its cards' `mode: 'drill'` (no effects, decided in `effectsOf`), what a card
  shows on its exercise (`point`, each choice's `pointId` and `contrast`), its way in
  `components/DrillLink.tsx`, its page `pages/exercise/DrillScreen.tsx`.
- Grammar destinations: a point's page through `grammarPath`, a family's page through
  `grammarFamilyPath`, the chapter browser on a chapter through `grammarChapterPath`, a drill
  through `drillPath` (`utils/navigation.utils.ts`; enforced with the word and kanji paths). A
  Japanese run inside English text (a lesson title in a page title, a contrast case's guidance) is
  set in a Japanese face by `components/MixedText.tsx` (over `japaneseRuns`,
  `utils/japaneseRuns.utils.ts`); a contrast case, on a family page or under a drill card, is
  `components/ContrastCaseText.tsx`.
- Session flow: `useSessionLifecycle`, `components/SessionProgress.tsx` (counter, ticker, gains),
  the commit pipeline in `quizSelectors.ts` shared by the preview and the session.
- Card building blocks: `components/quiz/` (`QuizCardFrame`, `QuizMasteryCorner`,
  `SubmitButton`, `ContinueButton`, `FeedbackNote`, `ClozeBlank`, `SlotChoices` (the options of
  a picked slot, the only place a quiz option is drawn), `ExpandableSenses`,
  `Headword`, `quizStyles.ts` for result colours), `hooks/useQuizFocusManagement.ts` for
  keyboard flow, `components/MasteryRing.tsx`.

gokan-srs, everything else:

- Data loading in components: `hooks/useAsyncData.ts`. Time: `hooks/useNow.ts`,
  `utils/time.utils.ts`. Debounce: `hooks/useDebouncedValue.ts`.
- A dataset file is loaded through `fetchDatasetFile` / `fetchOptionalDatasetFile`
  (`services/http.ts`), the one place that builds it in its English shape from the published
  dataset at `/dataset/` (`englishFile` / `englishInputs` imported nowhere else: enforced). Its
  loader caches the request, not its parsed result: `RequestCache` (keyed) or `sharedRequest`
  (one file) from `services/http.ts`, so callers asking at once share one download.
- Page frame: `components/Page.tsx` (the two widths), `components/PageHeader.tsx` (title,
  Back, actions), `components/ui/TabNav.tsx` (route tabs), `components/nav/` (header, tab bar,
  footer), destinations in `utils/navigation.utils.ts` (a word's page only through `vocabPath`, a
  kanji's through `kanjiPath`, a grammar point's through `grammarPath`: enforced).
- Lists and stats: `components/ui/ListRow.tsx` rows, `components/WordStudyStatus.tsx` (a word's
  status, or Learn), `utils/learningStatus.utils.ts` (New / Learning / Mastered for a word or a
  grammar point), `components/ui/Pagination.tsx`, `pages/stats/components/CoverageChart.tsx` and
  `utils/coverage.utils.ts`, `utils/activity.utils.ts`, `utils/winRate.utils.ts`.
- Detail pages: `components/detail/` (`DetailHeader` the subject and its main action,
  `DetailBody` the 8/4 body under it, or one column under a sticky tab row, `tabs`; a tabbed page (a
  word's, a kanji's, a grammar point's) through `useDetailTabs` (its tab state, tabs from
  `utils/detailTabs.utils.ts`) and `DetailTabsBody` (its tab row, panels and full page), `LearnStatus`,
  `DetailSection`, `DetailField` (a labelled value; `compact`, a header's facts row, as a word's
  KKLC step and Textbooks), `YourProgress` (the compact Your study, a word's and a grammar point's)
  and its `DirectionStatus`, `DetailErrorScreen`), `components/RelatedEntriesCard.tsx` (its rows alone:
  `RelatedEntryList`), `components/SRSHistoryGraph.tsx`, `components/KanjiTile.tsx` (a glyph:
  boxed only when it links), `components/WordTile.tsx` (a word as a boxed link),
  `components/FrequencyMeter.tsx`,
  `components/InteractiveSentence.tsx`,
  `pages/grammar/GrammarExampleList.tsx`.
- Settings controls: `components/ui/SettingToggle.tsx`, `SettingSlider.tsx`, `components/OptionGrid.tsx`,
  `components/LearningOrderPicker.tsx`, `components/QuizSettingsMenu.tsx`.
- Small UI: `components/ui/Chip.tsx` (neutral metadata chip; `JlptChip`/`TagChip` wrap
  it), `components/StatusDot.tsx` (the New/Learning/Mastered language; a kanji's Known / Not known yet,
  `components/KanjiKnownStatus.tsx`),
  `components/ui/SelectableOption.tsx` (one choice at a time: option grids, the theme
  picker, onboarding), `components/ui/FilterToggle.tsx` (any number active at once: list
  filters, genre pills), `components/ui/ListRow.tsx` (a clickable row, always a `Link`),
  `components/ui/Disclosure.tsx` (collapsed-by-default section),
  `components/ui/StackedBarChart.tsx` (the one bar chart), `components/CardSkeleton.tsx`,
  `components/KanjiSpellingNote.tsx` (the kanji spelling of a word learned in kana),
  `components/PlayButton.tsx` (a word or sentence read aloud: one player, `services/clipPlayer.ts`,
  clip URLs only from `audioUrl`, enforced; beside a sentence, `SentenceWithPlay`),
  `components/SecondaryForm.tsx` (the form beside a headword, in every list: enforced),
  `components/Ruby.tsx` (every furigana: the only `<ruby>` in the app, enforced),
  `components/ui/TextButton.tsx` (an action written as text), `components/ui/BottomSheet.tsx`
  (the one sheet, enforced), `components/lookup/` (a word's or kanji's card on hover, focus and
  tap: `useLookup`, `LookupText`, `LookupLink`, `HeadwordKanji`; the only popover, enforced), `components/ui/TabNav.tsx` (every
  tab row: route tabs, or a page's own tabs as ARIA tabs), `components/ui/SearchField.tsx`, `components/ui/Marked.tsx`
  (a search's matches, from `utils/exploreSearch.utils.ts`).
- A panel's search, on any page (a word's Sentences and Related, a kanji's Words, a grammar point's
  Examples): `components/search/` (`PanelSearch` the field and its count line, `usePanelQuery` its
  query, `useIndexSearch` word ids searched through the search index, `usePagedPanel` a list shown
  a page at a time with its search, the field only past one page, and `ShowMore` its "Show N
  more"). A page folder never imports from another's: what two pages share lives here, in
  `components/`, `hooks/` or `utils/` (enforced: `cross-page-import`).
- A word's page: its tabs (`utils/wordTabs.utils.ts`: their hashes, and `initialWordTab`, which
  one opens), Dict (`pages/vocab/DictTab.tsx`), the Sentences, Synonyms and Related panels in
  `pages/vocab/explore/` (one search each, `utils/exploreSearch.utils.ts`), Kanji
  (`components/KanjiSummary.tsx`, a kanji in brief; `components/KanjiReadings.tsx`, a kanji's
  On/Kun list, `compact` or `large`, also the kanji page's), Study (`pages/vocab/StudyTab.tsx`); its reading line, with its play button, on the page and the
  intro card alike, `components/WordReading.tsx` (enforced); its
  summary gloss from `summaryGloss` (`@gokan/dataset-schema`), its two examples from
  `utils/wordExamples.utils.ts`.
  Synonyms and mix-ups on it: Closest synonyms and the Synonyms panel
  (`pages/vocab/explore/SynonymsPanel.tsx`), their sections, order and caps in
  `utils/synonymSections.utils.ts`, a pair's label from
  `closenessOf` (`CLOSENESS_LABEL`). Mix-ups are recorded only by the `mixup` effect
  (`effects.ts`), stored through `utils/mixups.utils.ts` (cap, Drive union, a word's history and
  counts) and shown by `pages/vocab/YourMixups.tsx`.
- Words learned in kana in the learning orders: `utils/usuallyKana.utils.ts`
  (`orderIncludesUsuallyKana`, the per-session pacer); scheduling asks `isReadingRelevant`.
- Test fixtures: `src/test/fixtures.ts` (`vocabProgress`, `grammarProgress`, `userProgress`,
  `userSettings`, `vocabulary`, `grammarPoint`, `srsEntry`...). A test may wrap one in a
  one-line local default, never redeclare it.

gokan-dictionary:

- Data: every page's data through one `DictionaryData` (`lib/types.ts`), today `checkoutData`
  (`lib/dataset.server.ts`, imported only by `lib/server/pages.ts` and tests: enforced); a
  cross-page projection (the word summaries) is one index it provides, never built inline.
- Page frame and breadcrumb: `pages/PageLayout.svelte` (every page: skip link, header with
  `SearchBox.svelte`, footer). Grammar browse pages share `pages/GrammarTabs.svelte`.
- Lists: `pages/VocabEntryList.svelte` (every word list: headword | reading | gloss, the rest
  in a disclosure), `pages/GrammarList.svelte` (every list of grammar points),
  `pages/Chip.svelte` (neutral metadata), `pages/Pager.svelte`.
- Sentences: `pages/SentenceText.svelte` renders runs from `lib/furigana.ts`
  (`sentenceRuns`, over the shared `rubyParts`); `pages/GrammarExamples.svelte` for grammar examples;
  `pages/FuriganaToggle.svelte`; the order a word's sentences show in, `lib/sentenceOrder.ts`.
- Word pages: `lib/senses.ts` (meanings, summary gloss), `@gokan/dataset-schema`'s
  `conjugation.ts` (the one rule table, used by `conjugate` for the Forms table and by `deinflect`
  for both apps' search).
- Search: the index built at prerender by `lib/searchIndex.ts`, its rows the shared format
  (`searchWordRow`, `searchKanjiRow`, `searchGrammarRow`, row flags, columns:
  `@gokan/dataset-schema`'s `searchRows.ts`, gokan-srs's header search builds the same rows),
  prepared by `prepareRowSearch` (`rowSearch.ts`, apart so the page-wide script reads rows without the
  matcher) and ranked by `runRankedSearch` through `lib/searchQuery.ts`,
  the same module behind the header panel, `/search/` and the build-time acceptance check. A
  query lists the same rows in the same order in both apps (held by `scripts/searchParity.test.ts`).
- Size budgets: `lib/budgets.ts`, checked by `scripts/check-build.ts` after every build, in brotli
  bytes (what a reader downloads); a list page's to the end of its first screen (`FIRST_SCREEN_ROWS`).
- Locales: `lib/locale.ts` (`Locale`, the served ones, a page's locale from its optional route
  segment `[[locale=locale]]`; English has none). Every link is built for a locale:
  `localeUrls(locale)` from `lib/urls.ts` (it applies the base path and the locale segment), in a
  component `pageLocale().urls` (`pages/pageLocale.ts`, set by the root layout). A page in another
  locale links its own section's pages, and English's for the types it does not serve, marked
  `hreflang="en"` (`pageLocale().linkLang`, `lib/localeLinks.ts`; checked as it renders, with its
  English and its catalog's words, `hooks.server.ts`). The search script links through
  `linkUrls(locale)` too, never `localeUrls` (enforced), and says its words from
  `lib/messages/search` (one module per locale, apart from the page catalog).
- Words: every title, description and word of chrome from the locale's catalog, `lib/messages`
  (`Messages`, one module per locale, `en.ts`; a breadcrumb step too, enforced; `messagesFor(locale)`, in a component
  `pageLocale().messages`; a sentence with links is `LinkedText`). A count is `messages.count`.
  The text tools titles are written with (truncating, a searchable pattern) are `lib/seo.ts`.
- Client scripts are plain TypeScript (`client/search.ts`, `client/grammarFilter.ts`): no
  Svelte runtime on any page (the build checks it).
- Test fixtures: `src/test/fixtures.ts` (`vocabulary`, `grammarPoint`, `kanji`, `sentence`).

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
- **Persistence and network go through one layer each** (enforced): `localStorage` and
  `indexedDB` only via `StorageService`, `sessionStorage` only via `hooks/usePersistedControls.ts`, `fetch` only in
  `services/`. Every dataset URL is built by `datasetUrl()` (`services/http.ts`), which adds
  the dataset version browsers cache by (enforced).
- **Progress is stored compacted** (`services/progressCompaction.ts`), one record in IndexedDB
  behind `StorageService`, so code always uses the readable names. Its read is asynchronous;
  Drive hands its merged progress to the app directly, never through storage. A new persisted date field goes in
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
  to nothing), no hex or `rgb()` in components, no removed token (`muted`, `subtle`,
  `label-neutral`, `meaning-muted`, `quiz-*`: see docs/DESIGN_SYSTEM.md section 2 for where
  each one moved). Enforced.
- **Text in `text-accent` is always a link or an action; metadata is neutral.** A JLPT chip,
  a part-of-speech tag, a register label and the like are never accent-coloured (`Chip`,
  `JlptChip`, `TagChip` are neutral by construction); the error colour is only for errors and
  warnings. Ordinal data (mastery stages, quiz directions) uses the accent in steps, never
  several hues.
- Japanese text uses `font-mincho` or `font-gothic`; `font-serif` has no CJK glyphs. UI sans
  text (English copy, numbers) uses `font-sans` (Inter), not `font-gothic`.
- **No font size below 12px** (`text-[Npx]` with N < 12, `text-[Nrem]` with N < 0.75); `em`
  stays allowed, since it is relative (furigana). Enforced. No uppercase letter-spaced labels
  (`tracking-wide`/`wider`/`widest`): use `type-label`. Enforced.
- Motion is minimal: 150-200ms, ease-in-out, no bounce. No `hover:scale-*` or
  `active:scale-*`. Enforced.
- `rounded-md` for every card, panel, input, button and chip, including the quiz card frame;
  `rounded-full` only for pills, avatars, rings, toggles and the progress bar.
- Mobile: inputs are `text-base` on phones (smaller makes iOS zoom), page roots are `w-full`,
  flex/grid children that truncate need `min-w-0`. `bun run check:layout` measures both
  production builds in Chrome at 320px and 375px (sideways scroll, the 12px floor, 16px
  inputs, the dictionary's 44px tap targets) and CI runs it (`ci-site.yml`); a new page type
  or main route goes in its lists.
- **UI work follows docs/DESIGN_SYSTEM.md, from the first line.** Before writing a screen,
  read the sections for what it touches and reuse its components (a detail page is
  `DetailHeader` + `DetailBody`, a glyph is a `KanjiTile`, a choice is an `OptionGrid`). Then
  look at it at 320px, 375px and desktop, light and dark, before committing: the checks catch
  what can be measured, not whether a colour or a box means the right thing.
- `toLocaleDateString`/`toLocaleTimeString`/`dateStyle`/`timeStyle` only in
  `utils/time.utils.ts` (`formatDate`, `formatShortDate`, `formatDateTime`, `formatWeekday`,
  plus the relative helpers). Enforced.
- Dictionary styles: SCSS, one stylesheet per page type in `styles/pages/`; a rule goes in
  `app.scss` only when two or more page types use it; `_tokens.scss` emits no CSS; Svelte
  components have no `<style>` blocks. The build must stay byte-reproducible (no timestamps or
  build ids in output), or every deploy re-uploads all pages.
- Dictionary pages: every element holding Japanese text carries `lang="ja"` (prerender fails on
  Japanese-only text outside one, and on a `jp`-class element without it; `langOf` for dataset
  text that may be either language), and each page type stays within its size budget
  (`lib/budgets.ts`, docs/DESIGN_SYSTEM.md section 8; the build fails otherwise): the 14 KB rule, a
  page's HTML within 13 KB of brotli so it arrives in the first round trip.

## Testing rules

- Vitest in both apps. Pure logic has a colocated `*.test.ts`; every module in
  `apps/gokan-srs/src/utils` and `apps/gokan-dictionary/src/lib` must have one (enforced).
  Reducers, selectors and services are tested directly.
- Tests build data with the shared fixtures (see above), with fresh nested objects; never share
  `history` arrays between fixtures.
- Thin I/O glue (DOM wiring, the dictionary's routes and server hook) is verified by running it, not unit tests.
