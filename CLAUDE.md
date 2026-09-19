# CLAUDE Project Context

> [!IMPORTANT]
> **Keep this documentation updated.**
> This file serves as the long-term memory for AI agents working on Gokan SRS. When making functional changes, update the relevant sections to reflect the current state of the codebase.
>
> **⚠️ CRITICAL REQUIREMENT: ALWAYS UPDATE BOTH CLAUDE.md AND GEMINI.md ⚠️**
> 
> When you modify either CLAUDE.md or GEMINI.md, you MUST immediately update the other file with IDENTICAL changes.
> Both files must always contain the same information to ensure all AI agents have equivalent knowledge.
> 
> **WORKFLOW**: After editing one file, IMMEDIATELY edit the other before proceeding with any other work.

> [!IMPORTANT]
> **No em dashes.** The em dash character (—) is prohibited everywhere in this project: documentation, code, comments, commit messages, PR descriptions, workflow names, and any AI-generated output. Use a colon, parentheses, a comma, or a reworded sentence instead. This applies to every agent and every file, from now on.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Design System](#design-system)
3. [Project Structure](#project-structure)
4. [Core Data Models](#core-data-models)
5. [Services & Business Logic](#services--business-logic)
6. [State Management](#state-management)
7. [Application Pages](#application-pages)
8. [gokan-dictionary App](#gokan-dictionary-app)
9. [Build & Development](#build--development)
10. [Functional Workflows](#functional-workflows)
11. [Constants & Configuration](#constants--configuration)

---

## Project Overview

**Gokan SRS** (語感 - "sense of language") is a Japanese vocabulary learning application using Spaced Repetition System (SRS) algorithms. It's designed as a serious study instrument, not a gamified app.

This repo (`gokan-srs`) is a **monorepo** (Bun workspaces) hosting `apps/gokan-srs` (this app) and `apps/gokan-dictionary` (a companion SEO-crawlable static dictionary site - see [gokan-dictionary App](#gokan-dictionary-app) below and [issue #19](https://github.com/gokan-dev/gokan-srs/issues/19)). Both live under the `gokan-dev` GitHub org, alongside the separate `gokan-dataset` repo (the open, CC BY-SA-licensed vocab/kanji/sentence dataset both apps consume). See the root [README.md](README.md) for the full ecosystem layout.

### Main Goals
- **Vocabulary Acquisition**: Teach Japanese vocabulary based on user's kanji knowledge
- **Spaced Repetition**: Optimize review timing using custom SRS algorithm
- **Kanji-Aware Learning**: Only introduce vocabulary containing kanji the user knows
- **Google Drive Sync**: Persist user progress across devices

### Tech Stack
- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite (rolldown-vite variant)
- **Styling**: Tailwind CSS v4
- **State Management**: React Context + useReducer
- **Authentication**: Google OAuth (@react-oauth/google)
- **Icons**: Lucide React
- **Animations**: Framer Motion

---

## Design System

> [!IMPORTANT]
> **Adhere strictly to the design system.**
> Gokan SRS is a study instrument, not a game. The appearance must be calm, precise, and trustworthy.

Refer to [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for full details. It's a monorepo-wide doc — both `apps/gokan-srs` and `apps/gokan-dictionary` should follow it.

### Key Principles
- **Tone**: Neutral, Direct, Encouraging (no cheerleading)
- **Visuals**: Minimize colors. Use Primary Accent (Indigo #2E3A59) for focus. Use Secondary Accent (Muted Vermilion #8A3A2E) ONLY for errors/warnings
- **Typography**: Source Serif 4 + Inter for English, Noto Serif JP + Noto Sans JP for Japanese
- **Animations**: Minimal (150-200ms), no bounce, ease-in-out only

---

## Project Structure

Monorepo root, using Bun workspaces (`package.json`'s `workspaces: ["apps/*"]`). Everything that used to live at repo root (before the `[2026-07-26]` monorepo migration) now lives under `apps/gokan-srs/`, unchanged internally - only the path prefix changed.

The compiled dataset itself lives in the separate [`gokan-dataset`](https://github.com/gokan-dev/gokan-dataset) repo, consumed here as a **git submodule** at `apps/gokan-srs/dataset/` - see Build & Development → Dataset Consumption for how the pieces fit together.

```
gokan-srs/                          # monorepo root
├── apps/
│   ├── gokan-srs/                  # the SRS learning app - was the repo root pre-migration
│   │   ├── dataset/                   # git submodule -> gokan-dataset (raw sources, build pipeline, compiled/ output - including grammar, see Grammar Dataset)
│   │   ├── public/                    # Static assets
│   │   │   └── data/compiled/         # NOT committed - synced from dataset/compiled/ at dev/build time (vocab, kanji, sentences, grammar)
│   │   ├── scripts/
│   │   │   └── sync-dataset.ts       # Copies dataset/compiled/ -> public/data/compiled/
│   │   ├── src/
│   │   │   ├── assets/               # Images, fonts
│   │   │   ├── commons/              # Shared constants
│   │   │   │   └── constants.ts      # App-wide configuration
│   │   │   ├── components/           # Reusable UI components
│   │   │   ├── hooks/                 # Reusable React hooks shared across pages
│   │   │   │   └── useQuizFocusManagement.ts # Submit/Continue focus management, shared by VocabBaseQuizCard and GrammarQuizCard
│   │   │   ├── context/              # React Context providers
│   │   │   │   ├── quiz/             # Quiz state machine (modular, see State Management) - also hosts the Grammar activity's parallel state
│   │   │   │   │   ├── quizReducer.ts          # Pure reducer (state + actions, no I/O) - QuizState is Vocab's state intersected with GrammarQuizState
│   │   │   │   │   ├── quizSelectors.ts        # selectNextView + derived selectors (vocab)
│   │   │   │   │   ├── useQuizOrchestration.ts # All effects + actions (I/O, sync, timers) - vocab
│   │   │   │   │   ├── grammarReducer.ts       # Grammar action types + pure reducer logic, delegated to from quizReducer
│   │   │   │   │   ├── grammarSelectors.ts     # selectNextGrammarView, computeBlankPlan + derived selectors (grammar)
│   │   │   │   │   ├── useGrammarOrchestration.ts # All effects + actions for the Grammar activity
│   │   │   │   │   └── QuizProvider.tsx        # Thin assembler exposing QuizContextValue (both activities)
│   │   │   │   ├── useQuiz.ts        # useQuiz() hook + QuizContext object
│   │   │   │   ├── GoogleDriveContext.tsx
│   │   │   │   ├── ThemeContext.tsx
│   │   │   │   ├── KanjiForm/        # Kanji knowledge form state
│   │   │   │   └── Responsive/       # Responsive utilities
│   │   │   ├── models/               # TypeScript interfaces
│   │   │   │   ├── vocabulary.model.ts
│   │   │   │   ├── user.model.ts
│   │   │   │   ├── grammar.model.ts  # GrammarPoint/GrammarExample/GrammarProgress (see Core Data Models)
│   │   │   │   ├── data.model.ts     # External dataset DTOs
│   │   │   │   ├── index.model.ts
│   │   │   │   ├── state.model.ts
│   │   │   │   └── kanji.model.ts
│   │   │   ├── pages/                # Page components
│   │   │   │   ├── main/             # Activity hub (landing route '/') - activity cards + session recap
│   │   │   │   ├── quiz/             # Vocab study session screen, route '/quiz' (also hosts quizFormatting.ts helpers) - VocabQuizScreen, VocabQuizCard, VocabMeaningQuizCard, VocabBaseQuizCard
│   │   │   │   ├── grammar/          # Grammar study session screen, route '/grammar' (see Application Pages)
│   │   │   │   ├── setup/            # Initial setup wizard
│   │   │   │   ├── settings/         # Global settings screen
│   │   │   │   │   └── sections/     # Per-activity settings groups (VocabQuizSettings, GrammarQuizSettings) - shared by the global page and each quiz's cog panel
│   │   │   │   ├── profile/          # User profile
│   │   │   │   ├── stats/            # Statistics screen + charts (see Application Pages)
│   │   │   │   └── about/            # About page
│   │   │   ├── services/             # Business logic
│   │   │   │   ├── srs.service.ts    # SRS algorithm (formula only) - also the source of the reusable calculateNextState formula
│   │   │   │   ├── scheduling.ts     # Single source of truth for due-date/mastery derivation (vocab)
│   │   │   │   ├── vocabulary.service.ts
│   │   │   │   ├── grammar.service.ts       # Loads compiled grammar data (public/data/compiled/grammar/, see Grammar Dataset)
│   │   │   │   ├── grammarScheduling.ts     # scheduling.ts's equivalent for GrammarProgress's single SRSEntry
│   │   │   │   ├── grammarSrs.service.ts    # SRSService's equivalent for grammar: JLPT-order queue refill, applyAnswer, intro choice
│   │   │   │   ├── storage.service.ts
│   │   │   │   ├── backup.service.ts        # Write-once pre-migration safety snapshots
│   │   │   │   ├── progressSerialization.ts # Shared (de)serialization for storage + Drive
│   │   │   │   ├── migration.service.ts
│   │   │   │   ├── sync/                    # Google Drive sync (see Services & Business Logic)
│   │   │   │   │   ├── driveClient.ts       # Raw Drive REST HTTP calls
│   │   │   │   │   ├── mergeProgress.ts     # Pure per-entry merge logic (vocab + grammar)
│   │   │   │   │   ├── googleDriveSync.ts   # Orchestrator: CAS retry, dedup, backups
│   │   │   │   │   └── types.ts
│   │   │   │   └── quiz.service.ts
│   │   │   ├── utils/                # Helper functions
│   │   │   │   ├── srs.utils.ts
│   │   │   │   ├── knowledge.utils.ts # Knowledge-points model + cumulative curve builder
│   │   │   │   ├── activity.utils.ts  # buildDailyActivity: shared per-day review bucketing (DailyProgressionChart + Main hub's daily card)
│   │   │   │   ├── grammarSentence.utils.ts # grammarExampleToSentence: adapts a GrammarExample into InteractiveSentence's Sentence shape (GrammarDetailScreen)
│   │   │   │   └── quiz.utils.ts
│   │   │   ├── App.tsx               # Root component with routing
│   │   │   ├── main.tsx              # Entry point
│   │   │   └── index.css             # Global styles
│   │   ├── terraform/                 # AWS infra (S3 + CloudFront) - specific to this app's hosting
│   │   ├── docs/                       # gokan-srs-specific docs
│   │   │   ├── ARCHITECTURE_AUDIT.md  # Architecture audit + remediation summary
│   │   │   ├── FUTURE_REFACTORS.md    # Deeper structural follow-ups, not yet scheduled
│   │   │   └── srs-*.txt              # SRS formula research notes
│   │   ├── package.json                # App-specific deps/scripts (react, vite, vitest, ...)
│   │   ├── vite.config.ts, tsconfig*.json, eslint.config.js, index.html
│   │   └── README.md
│   └── gokan-dictionary/            # SEO-crawlable static dictionary pages (kanji/vocab) - see "gokan-dictionary App" below
│       ├── src/
│       │   ├── pages/                  # Home/Vocab/Kanji/Grammar page + Vocab/VocabJlpt/Kanji/Grammar index Svelte components, + SiteHeader/SiteFooter (no <style> blocks - see app.css)
│       │   ├── lib/                    # site.ts, urls.ts, seo.ts, documentShell.ts, vocabSummary.ts, sentenceSegments.ts, sitemap.ts, dataset.server.ts, types.ts
│       │   ├── client/                 # search.ts (site-wide search box, every page) + grammarBrowser.ts (mounts the grammar browser)
│       │   ├── public/                 # favicon.svg - copied into dist/ by Vite
│       │   ├── models/                 # 2nd copy of the shared model files (see Core Data Models)
│       │   ├── app.css                 # single global stylesheet for all pages
│       │   └── App.svelte, main.ts     # `vite dev`-only placeholder shell, unused in production
│       ├── scripts/
│       │   ├── prerender.ts            # static site generator - writes every vocab/kanji/grammar page plus the browse indexes
│       │   └── svelte-ssr-loader.ts    # Bun runtime plugin compiling .svelte for prerender.ts (see below)
│       ├── package.json
│       └── README.md
├── docs/                            # Ecosystem-wide docs (not specific to one app)
│   ├── DESIGN_SYSTEM.md            # Visual design guidelines - both apps should follow it
│   └── FUTURE_FEATURES.md          # Roadmap spanning gokan-srs, gokan-dictionary, gokan-dataset
├── .github/workflows/
│   ├── deploy.yml                   # Test + deploy gokan-srs, path-filtered to apps/gokan-srs/**
│   └── ci-gokan-dictionary.yml      # Typecheck + build gokan-dictionary, path-filtered
├── package.json                      # Workspace root manifest (Bun workspaces: "apps/*")
├── bun.lock                          # Single lockfile for the whole workspace
├── README.md                         # Monorepo overview, links to each app
├── CLAUDE.md                         # This file
└── GEMINI.md
```

`gokan-dataset` (the open dataset) and the org they all live under (`gokan-dev`) are separate repos, not part of this monorepo.

**Note**: every other file-path reference in this document (Core Data Models, Services & Business Logic, State Management, Application Pages, Test Infrastructure, etc.) is relative to `apps/gokan-srs/` unless stated otherwise - they predate the monorepo split and were not individually re-prefixed.

---

## Core Data Models

### Vocabulary (`vocabulary.model.ts`)

**`Vocabulary`** - Represents a Japanese word/phrase
- `id`: JMdict word ID (stable identifier)
- `writtenForm`: Kanji form + contained kanji characters
- `reading`: Primary reading + alternatives
- `frequency`: Kanji rank + optional kana rank
- `jlptLevel`: optional JLPT level (1=N1 hardest ... 5=N5 easiest). Descriptive/display-only - not used for learning order. Populated at build time by matching against the [Bluskyo/JLPT_Vocabulary](https://github.com/Bluskyo/JLPT_Vocabulary) dataset (`resolveJlptLevel` in the submodule's `scripts/build-common.ts`): every one of the word's written forms is tried first, then its readings, since that dataset files orthography variants (近付く, not JMDict's 近づく) and usually-kana words (かばん, not 鞄) under a key JMDict's kanji headword never matches. A reading key is only accepted when the matched entry's reading is this word's primary reading, so homophones can't inherit each other's level. Most vocab still won't have one (that dataset covers a few thousand words out of JMDict's ~40k+).
- `progression.kklcStep`: KKLC step requirement
- `components[]`: IDs of other vocabularies contained within this one
- `senses[]`: Array of meanings with POS, glosses, misc tags
- `usageHints`: Optional context hints

### Kanji (`kanji.model.ts`)

**`Kanji`** - A single kanji character and its known step/frequency numbers across different systems
- `character`: The kanji glyph itself
- `steps.kklc`: KKLC step number (this app's primary kanji-learning order)
- `steps.jlpt`: optional JLPT level (1=N1 hardest ... 5=N5 easiest), from the same JLPT dataset as vocab. Only ever set for kanji already in the KKLC-derived kanji set (build-kanji.ts's outer loop iterates KKLC chapters, not the JLPT file) - doesn't expand kanji coverage.
- `steps.frequency`: optional JPDB kanji frequency rank (currently unused, reserved)
- `frequency`: JPDB kanji frequency rank

**`VocabProgress`** - User's learning progress for a vocabulary item
- `vocabId`: Reference to Vocabulary.id
- `stage`: `'learning'` | `'graduated'`
- `introductionAt`: When user first saw this vocab
- `nextReviewAt`: Next scheduled review (null = new item)
- `lastReviewedAt`: Last review timestamp
- `totalReviews`: Total number of reviews
- `consecutiveFailures`: Consecutive wrong answers
- `reading`: SRSEntry for reading reviews
- `meaning`: SRSEntry for meaning reviews
- `production`: optional SRSEntry for production reviews (English meaning prompt, Japanese reading answer). Optional on the type because progress saved before this quiz type existed has no such field; the migration fills one in on every load. A filled-in entry is **inert** (`dueDate: null`, which no due-check matches) until activated, so adding this direction made nothing due. See Services & Business Logic -> Production quiz rollout.
- `needsRetry`: optional `{ reading?: boolean; meaning?: boolean; production?: boolean }` - per-quiz-type immediate-retry flag. A wrong reading answer only forces a reading retry and never blocks a due meaning or production review (and vice versa).
- `nextReviewAt` is always **derived**, never hand-set independently - see `scheduling.ts` in Services & Business Logic.

**`SRSEntry`** - Detailed SRS state for reading/meaning/production
- `memoryStrength`: Current memory strength (days)
- `interval`: Current interval (days)
- `difficulty`: 0.0 (hard) to 1.0 (easy), default 0.3
- `dueDate`: When next review is due
- `history[]`: Array of ReviewLog entries

### Sentence Models (`sentence.model.ts`)

**`Sentence`**
- `id`: Original Japanese sentence ID (from source)
- `original`: Japanese sentence text
- `en`: Array of English translations (id + text)
- `indices`: Reading hints/furigana string (optional)

**`SentenceSet`**
- `vocabId`: Reference to Vocabulary.id
- `sentences`: Array of associated Sentence objects


### User Models (`user.model.ts`)

**`UserProgress`**
- `kanjiKnowledge`: KanjiKnowledge object
- `learningQueue`: Array of VocabProgress (all vocab ever introduced)
- `grammarQueue`: Array of GrammarProgress (all grammar points ever introduced) - independent of `learningQueue`, added additively (no format-version migration needed, just a default-to-`[]` at hydration time - see Grammar Activity below)
- `stats`: Counters for newLearnedToday, totalLearned, totalReviews
- `dailyOverride`: Allow bypassing daily new vocab limit

**`KanjiKnowledge`**
- `method`: `'kklc'` | `'rtk'` | `'jlpt'` | `'custom'`
- `step`: Current step (e.g., KKLC step 500)
- `kanjiSet`: Set<string> of known kanji characters

**`UserSettings`**
- `preferredLearningOrder`: `'kanji_coverage'` | `'frequency'` | `'kklc'` | `'jlpt'` (`'jlpt'` walks N5→N1, frequency-ordered within a level; kanji-filtered by default like every other order - see Services & Business Logic)
- `kanjiCoverageTarget`: 1 to 5 (how many words to learn per known kanji before prioritizing new words, default 1)
- `learningFrequency`: `'high'` | `'medium'` | `'low'`
- `enableMeaningQuiz`: boolean (default true)
- `enableProductionQuiz`: optional boolean (default true). The production quiz (English meaning prompt, Japanese reading answer). Turning it off excludes production from queue selection, mastery and `nextReviewAt` derivation, exactly as `enableMeaningQuiz` does for meaning.
- `geminiApiKey`: optional Gemini API key for AI context validation
- `enableGeminiContext`: boolean (default false)
- `alwaysUseAiForMeaningContext`: boolean (default true)
- `meaningContextThreshold`: `'early'` | `'normal'` | `'late'` (default `'normal'`). Controls the mastery % at which meaning quizzes switch to sentence/context mode (early=30%, normal=50%, late=70%).
- `ignoreKnownKanjiRequirement`: optional boolean (default false). When true, drops the "all contained kanji must already be known" filter for the `frequency`/`kanji_coverage`/`jlpt` orders. Has no effect on `kklc` (gated by step, not by kanji set). Settings UI surfaces it for every order except `kklc`.
- `kanjiCountStep`: optional number (default 10, `CONSTANTS.setup.defaultKanjiCountStep`). The increment the profile page's known-kanji stepper moves by, editable there and persisted so it follows the user across devices. Purely a UI preference; nothing in the SRS reads it.

### Grammar Activity (`grammar.model.ts`)

New SRS-driven activity alongside the vocab quiz (issue #17) - reuses `srs.service.ts`'s formula rather than a new algorithm, per the issue's resolved decision. See Services & Business Logic → Grammar Services and Application Pages → Grammar Screen for the rest of the design; this section only covers the data shapes.

**`GrammarPoint`** - One grammar point, sourced from the hanabira.org-japanese-content dataset (CC license, attribution required - see the About page's credit link)
- `id`: Stable id assigned at build time from the vendored snapshot (e.g. `"n5-001"`) - the upstream dataset has no ids of its own
- `title`: Japanese/pattern portion only, e.g. `"～けど、～"`. The upstream source originally welded this together with a romaji transliteration in a trailing parenthetical (e.g. `"～けど、～ (〜kedo、～)"`) - `gokan-dataset`'s build step (`splitTitle`) splits the two apart (issue #47) so the app can choose independently where to show each.
- `romaji?`: The transliteration split off `title`, e.g. `"〜kedo、～"`. Absent for the ~1.3% of points (9/828) with no cleanly-splittable trailing parenthetical - a dataset-side gap, not something the app fixes. Rendered only on `GrammarDetailScreen` and `GrammarIntroCard` (small muted line under the title); every other grammar surface (`GrammarRelatedPointsCard`, `GrammarCard`/`SmartGrammarList`, `GrammarQuizCard`) shows only the kana `title`, unchanged from before this field existed.
- `shortExplanation`, `longExplanation`, `formation` (a template like `"Noun + が + いちばん + Adjective/Verb"`, shown to the user and also the source `gokan-dataset` matches against `GrammarExample.words[]` at build time to precompute `patternWordIndices`, below)
- `jlptLevel`: 1 (N1 hardest) .. 5 (N5 easiest) - every grammar point has one, unlike vocab's optional `jlptLevel` (this dataset is itself organized by level)
- `examples`: Array of `GrammarExample` (3-5 per point)
- `formalityLevel?`: `'casual' | 'neutral' | 'polite' | 'formal' | 'very-formal-literary'` - register, for points that have one (most don't - only points with a close synonym differing mainly by register). Sourced from `gokan-dataset`'s hand-authored `formality.json` mapping, not derived at build time.
- `usageNote?`: One short (~60-80 char) line covering whatever actually disambiguates this point from its near-synonyms - usually register, sometimes connotation/nuance instead (criticism, surprise, unmet expectation). Surfaced on `GrammarQuizCard` as a small unobtrusive cue near the JLPT chip (issue #42) - deliberately not shown on `GrammarIntroCard`/`GrammarDetailScreen`'s `title`/`formation`, which already answer the question this exists to disambiguate.
- `family?`: `{ id: string; name: string; relatedPoints: string[] }` - the named cluster of other `GrammarPoint`s expressing the same core idea at a different formality/nuance. `id` is a stable slug (e.g. `"contradiction"`), `name` is a display label (e.g. `"Contradiction (But / However)"`), and `relatedPoints` holds the ids of the *other* points in the family (excludes this point's own id, symmetric - if A's family lists B, B's family lists A). Replaces an earlier flat `relatedPoints?: string[]` field. All derived at build time in `gokan-dataset` by grouping every point that shares the same `family.id`; the app never hardcodes a family id/name. Surfaced by `GrammarRelatedPointsCard` on `GrammarDetailScreen` (issue #45), using `family.name` as the card header instead of a generic label.

> [!NOTE]
> `formalityLevel`/`usageNote`/`family` are populated for a growing, ongoing subset of points via `gokan-dataset`'s `data/raw/grammar/formality.json` (see its `GRAMMAR_FORMALITY_TRACKING.md` for current coverage). All three fields are optional and inert wherever a point has none. `compiled/grammar/index/families.json` (`Record<familyId, { name, memberIds }>`, mirroring `index/jlpt.json`'s shape) is also compiled but not yet consumed anywhere in the app - reserved for a possible future family-browsing view.

**`GrammarExample`** - `jp`/`romaji`/`en` plus `words: GrammarExampleWord[]`, a build-time tokenization of `jp` (via kuromoji) where each word is resolved against the compiled vocab dataset. Concatenating every word's `surface` reconstructs `jp` exactly. Also carries `patternWordIndices: number[]` - indices into `words[]` for this example's grammar-pattern markers, precomputed in `gokan-dataset` by matching `formation`'s literal Japanese against `words[]` (surface/`baseForm`/reading); empty when the pattern couldn't be confidently located in this specific example (rare - see the Grammar Dataset section and `gokan-dataset`'s pattern-location issue). The app never re-derives this - `computeBlankPlan` just reads it.

**`GrammarExampleWord`** - `{ surface, vocabId, reading?, baseForm? }`. `vocabId` is `null` for particles/symbols/anything unresolved (always shown literally, never blanked); when resolved, `reading` is the matched vocab's primary reading, embedded at build time as a cheap default. `baseForm` is kuromoji's dictionary/base form (e.g. `"思う"` for the conjugated token `"思っ"`), only set when it differs from `surface` - captured for build-time pattern-matching, currently unused at runtime. `computeBlankPlan` (`grammarSelectors.ts`) additionally does one runtime `VocabularyService.loadVocab(vocabId)` fetch per selected blank, at card-load time (not on submit, so grading stays synchronous) - this both supplies a full accept-list of writing variants for grading (surface, embedded reading, plus the fetched vocab's `writtenForm.kanji`/`alternatives`, `reading.primary`/`alternatives`, and any `mergedVocabs` readings) and the English gloss shown by the per-blank hint control.

**`GrammarProgress`** - User's SRS progress for one grammar point, mirroring `VocabProgress` but with a single `entry: SRSEntry` (no reading/meaning split - a grammar quiz has exactly one quiz type) and a single `needsRetry?: boolean` (not per-type).

### Session State (`state.model.ts`)

**`SessionState`** - Current quiz session state
- `'review'`: Due reviews exist
- `'learn'`: Can add new words
- `'session-complete'`: This session cleared everything it committed to, but reviews the per-session cap left out are still due (see Session quiz cap under State Management). Vocab only: `GrammarSessionState` excludes it alongside `'learn-kanji'`.
- `'waiting'`: Waiting for next review
- `'exhausted'`: No vocab left at all

---

## Services & Business Logic

### SRS Service (`srs.service.ts`)

Core SRS algorithm implementation. **This is the heart of the learning system.**

#### Key Methods

**`evaluateMeaning(userInput, meanings)`**
- Checks user input against English meanings/glosses
- Normalizes input (lowercase, strip punctuation, strip articles "to/a/an/the")
- Uses fuzzy matching (Levenshtein) and handles synonyms


**`evaluateAnswer(userInput, readings)`**
- Checks user input against all acceptable readings
- Returns best result: `'correct'` > `'minor_error'` > `'wrong'`
- Uses Levenshtein distance for typo detection

**`applyAnswer(vocab, quizType, quizMode, userAnswer, correctAnswer, latencyMs, now, forcedResult?, intervalModifier?, frequencyModifier?, meaningQuizEnabled?, productionQuizEnabled?)`**
- Updates VocabProgress based on answer result
- Calculates new memory strength and interval
- Returns updated progress + result + interval

**`calculateNextState(entry, result, latencyMs, now)`**
- Core SRS formula implementation
- Adjusts memory strength based on:
  - Answer result (correct/minor_error/wrong/pass)
  - Response latency (faster = easier)
  - Current difficulty
- Optional trailing `strengthDeltaModifier` (default 1.0) scales the strength delta (`resultFactor * L * D`). Untouched for vocab; the Grammar activity uses it to modulate a successful grammar answer's gain by how many of the sentence's vocab blanks were right (see State Management → Grammar Activity State).
- Returns new SRSEntry + interval

**`refillQueue(currentQueue, kanjiKnowledge, settings, maxToAdd, ignoredIds)`**
- Adds new vocabulary to learning queue
- Respects kanji knowledge constraints
- Uses either KKLC or frequency ordering
- Returns updated queue

**`findCandidatesJLPT(activeIds, kanjiKnowledge, maxToFind, ignoreKnownKanji?)`** (private)
- Backs `preferredLearningOrder: 'jlpt'`. Walks N5 → N1 (`JLPT_LEVELS`), frequency-ordered within each level, off `index/jlpt.json`.
- **Kanji-filtered by default**, same as every other order - only skipped when `settings.ignoreKnownKanjiRequirement` is on. The mode's defining feature is following the official level lists exactly (a user studying for a specific sitting covers that level's vocabulary as published); enforcing known kanji by default keeps that combined with the app's kanji-aware learning goal instead of overriding it, while the opt-in toggle preserves the old unconditional behavior for anyone who wants a level's list exactly regardless of kanji already studied.
- The JLPT lists cover only ~6.4k of ~36k words, so once drained it **falls back to `findCandidatesFrequency`** (respecting the same `ignoreKnownKanjiRequirement` flag) rather than stranding the user on the "exhausted" screen. `countLearnableVocabulary` mirrors this, delegating to the frequency count only when the JLPT pool hits zero - the two pools overlap heavily and must never be summed.
- `kklc` is unaffected by `ignoreKnownKanjiRequirement` either way, since it's gated by step, not by kanji set.

**`applyVocabIntroChoice(progress, choice)`**
- Handles "Learn" or "Skip" on intro card
- **Learn**: Sets `nextReviewAt = now` (becomes immediately reviewable)
- **Skip**: Sets stage to `'graduated'`, maxMemoryStrength on **all three** entries (never appears again). Mastering production here is required, not incidental: skip is the one path that writes `'graduated'` directly, and leaving production unmastered would make every skipped word fail `isVocabFullyMastered` and return as a production review

### Production quiz rollout (`srs.service.ts`, `migration.service.ts`)

The production quiz (English meaning prompt, Japanese reading answer) is the third vocab quiz type and the only direction that starts from English, so it carries its own `SRSEntry` rather than sharing reading's or meaning's. It grades against the **same reading accept-list** as the reading quiz (`SRSService.evaluateAnswer`); only the prompt differs.

Adding a third direction to an existing queue is the whole difficulty here: done naively it multiplies a long-time user's daily workload overnight. Four things prevent that, and each is load-bearing.

- **The migration fills in an inert entry, never a due one.** `backfillProduction` gives a learning word `dueDate: null`, which no due-check matches, so shipping this made **nothing** due. The entry sits dormant until something activates it.
- **Activation is lazy, and rides the user's own review curve.** `SRSService.seedProductionEntry` brings a word's production entry online the first time that word is answered in any other direction. A word reviewed monthly therefore picks up production a month from now, so the new direction spreads over one full review cycle instead of arriving as a single wave. There is deliberately **no** backfill pass that sets real due dates.
- **Already-graduated words are grandfathered as production-mastered.** This is the single most important line in the migration. Graduation is *derived* (`isVocabFullyMastered`), not merely stored, so an unmastered production entry would fail that predicate for every word the user ever skipped or finished and hand the entire completed pile back as production reviews. `'skip'` is how users say "I already know this word", so that pile is typically large.
- **A word that an answer just finished is never re-opened.** `applyAnswer` checks mastery *excluding* production before seeding, and skips activation when the word is already fully mastered in the directions it was being trained in. Without this, the answer that would have graduated a word instead attaches a fresh unmastered entry to it, which is the same wave one word at a time. This is also what keeps the existing "graduates on reading mastery alone when meaning quizzes are disabled" invariant true.

Strength is seeded from the word's **meaning** entry at a discount (`CONSTANTS.srs.production.seedStrengthRatio`, 0.4) rather than from zero. Producing a word from English is harder than recognising it, so this is well under parity, but a half-known word should not be drilled from scratch: seeding lower than the user's real ability just inflates the backlog it took care to spread out. The first review is pushed `seedDelayHours` (24h) out so it lands outside the session that activated it.

One ordering detail that a future change could easily undo:

- **`applyAnswer` selects entries by a keyed lookup, not a reading/meaning ternary.** With three types a ternary is not a style question: `quizType === 'reading' ? reading : meaning` silently routes every production answer into the **meaning** entry, corrupting its schedule with no type error to catch it. The same applies to the mastery-delta computation in `useQuizOrchestration`'s `continueToNext`.

**No same-session collision handling lives in `applyAnswer` anymore.** An earlier version had a correct reading answer stagger a due meaning's `dueDate` +12h so the two weren't asked back to back, but deliberately left production unstaggered (it re-seeds against reading's own cadence, so a fixed push just repeated every session and production was never once asked - reported from staging after the first release: reading and meaning came up daily while production never appeared). That asymmetry, and the stagger's second-order bug (it could resolve a committed meaning task's `SessionStats.done` without the user ever answering it - see `docs/MODIFICATION_LOG.md`), were both symptoms of solving a session-layer problem inside the SRS formula. It's now solved once, at the session layer: `dedupTaskKeysByVocab` (`quizSelectors.ts`) keeps at most one task per vocab per session (reading > meaning > production) when the committed set is built, uniformly across all three types, without mutating any entry's persisted schedule - see Session quiz cap below.

**Counted in the knowledge curve** (`knowledge.utils.ts`), alongside reading and meaning: production is a real direction the learner studies, and excluding it meant a production answer moved the session total while the curve ignored it. A word mastered in all three directions is worth 600.

The care needed is in the curve's **no-history fallback**, which credits an entry at the word's introduction date when it carries no review logs (that is what makes a skipped "I already know this" word count at all). The migration grandfathers every already-graduated word to production-mastered so it does not un-graduate, and those entries have no logs either - crediting them through that fallback would date ~200 points at each word's introduction and rewrite years of curve the learner never earned. So for production the fallback applies only when `totalReviews === 0`, which is exactly the skipped-at-intro case: there the learner asserted they knew the word, reading and meaning are credited on that same basis, and production is no different. A word with real review history waits for a real production review before counting. Daily activity (`buildDailyActivity`) includes `production.history` unconditionally, since that is purely a record of reviews actually done.
### Scheduling Service (`scheduling.ts`)

**Single source of truth** for "when is this vocab due" and "is it fully mastered". Previously this question was answered independently in three places (`VocabProgress.nextReviewAt` hand-synced by `applyAnswer`, `reading.dueDate`, `meaning.dueDate`), which could drift out of agreement - e.g. disabling meaning quizzes left a stale `meaning.dueDate` able to make `nextReviewAt` report "due" while queue-selection had already stopped considering meaning reviews.

**Key functions:**
- `isEntryMastered(entry)`: `memoryStrength >= maxMemoryStrength`
- `isVocabFullyMastered(vocab, settings)`: reading mastered AND (meaning quizzes disabled OR meaning mastered) AND (production irrelevant OR production mastered). Production counts as **irrelevant** when the quiz type is off in settings **or** the entry has never been activated - a never-activated entry must not read as `unmastered`, or every word in an existing queue would fail this the day the quiz type shipped
- `vocabNextReviewAt(vocab, settings)`: derives the authoritative `nextReviewAt` - the earliest of the non-mastered reading/meaning/production due dates, **excluding meaning entirely when `enableMeaningQuiz` is false** and production whenever it is disabled or not yet activated
- `isProductionQuizEnabled(settings)` / `isProductionActivated(entry)`: the two gates behind `relevantProductionEntry`, the private helper the three functions above share
- `isVocabDue(vocab, settings, now)`: convenience wrapper (always false for graduated items)

`SRSService.applyAnswer` calls into this module rather than hand-computing `nextReviewAt`/`stage`; `sync/mergeProgress.ts` and the v8+ migration pass do the same, so all three call sites can never disagree.

#### SRS Formula Constants (from `constants.ts`)
- `targetRecall`: 0.75 (75% target recall rate)
- `expectedLatency`: 1500ms
- `minInterval`: 0.2 days (~5 hours)
- `maxInterval`: 3650 days (10 years)
- `maxMemoryStrength`: 1270 (≈1 year interval = mastery)
- `resultFactors`: correct +0.25, minor_error +0.10, wrong -0.40, pass -0.15

### Vocabulary Service (`vocabulary.service.ts`)

Handles loading vocabulary data from compiled JSON files.

**Static Methods:**
- `loadKKLCKanjiIndex()`: Load KKLC kanji index (step → kanji[])
- `loadKKLCIndex()`: Load KKLC vocab index (step → vocabIds[])
- `loadFrequencyIndex()`: Load frequency-sorted vocab index
- `loadVocab(id)`: Load individual vocabulary by ID (cached)
- `loadKanjiIndex()`: Load the full compiled `Kanji[]` array (small, whole-file fetch, cached) and index it by character in-memory
- `loadKanji(character)`: Look up a single `Kanji` by character (used by the Kanji Detail Page)
- `loadKanjiVocabIndex()`: Load the kanji → vocabIds reverse index (which vocab contain a given kanji, sorted by frequency)
- `loadJlptIndex()`: Load the JLPT level → vocab index (level 1..5 → entries, frequency-sorted within a level)

**Data Location**: `data/compiled/`
- Indexes: `index/kklc.json`, `index/kklc-kanji.json`, `index/frequency.json`, `index/kanji-vocab.json` (kanji character → vocab IDs containing it, frequency-sorted), `index/jlpt.json` (JLPT level → `{id, containedKanji}[]`, frequency-sorted within each level; ~6.4k of the ~36k vocab carry a level)
- Vocabulary: `vocab/{id}.json` (one file per vocab item)
- Kanji: `kanji.json` (flat array of all `Kanji` objects)

### Grammar Service (`grammar.service.ts`) and Grammar SRS (`grammarSrs.service.ts`)

**`GrammarService`** - Loads grammar data from `public/data/compiled/grammar/` (synced from the `gokan-dataset` submodule like every other dataset - see Build & Development → Grammar Dataset for how it's produced).
- `loadJlptIndex()`: Load the JLPT level → grammar point ids index (`index/jlpt.json`)
- `loadGrammarPoint(id)`: Load an individual `GrammarPoint` by id (cached), from `points/{id}.json`

**`GrammarSRSService`** - `SRSService`'s equivalent for grammar, reusing its formula (`SRSService.calculateNextState`, made `static` non-private specifically so this class can call it) rather than inventing a new one:
- `createGrammarProgress(grammarId)` / `applyGrammarIntroChoice(progress, choice)`: mirror `SRSService.createVocabProgress`/`applyVocabIntroChoice`, but against a single `entry` instead of `reading`/`meaning`
- `applyAnswer(progress, result, latencyMs, now, intervalModifier?, frequencyModifier?, strengthDeltaModifier?)`: takes an already-combined `AnswerResult` (the caller - `useGrammarOrchestration`'s `submitGrammarAnswer` - grades every blank via `gradeGrammarAnswers`, whose `overall` is decided by the pattern blanks, not a naive worst-of-all; see State Management). `strengthDeltaModifier` (default 1.0) scales the memory-strength gain by the vocab-correct ratio and is forwarded to `SRSService.calculateNextState`. Retry handling (`needsRetry`, a single boolean here) mirrors vocab's per-quiz-type flag exactly, just without the type dimension.
- `applyVocabReinforcement(learningQueue, credits, now, settings)`: applies **positive-only** vocab credit for the reinforcement blanks answered correctly in a grammar sentence, feeding each into that word's **production** `SRSEntry` via `SRSService.applyAnswer` (forced result, neutralised latency, scaled by `CONSTANTS.srs.production.reinforcementStrengthRatio`). Filling a blank is English sentence in, Japanese out, which is production's definition; reading asks the opposite question (given the written form, produce its sound) and a blank shows nothing to read, so reading was the one direction of the three this exercise structurally cannot test. Credited at a discount because the conditions are much easier than a production card's: the English sentence, the surrounding Japanese and the bracketing particles narrow the candidates, and kanji is accepted where that card wants the reading. Deliberately **not** split across all three entries - each drives its own schedule, so crediting three would push three due dates out on one scaffolded answer and thin review pressure in two directions it never exercised. A word whose production entry is not yet activated is **seeded first** (`seedProductionEntry`) and credited on top, so it joins the rotation at its designed baseline; a no-op entirely when production quizzes are disabled. `credits` is pre-filtered to correct/minor_error results, and a word not in `learningQueue` is skipped - so grammar practice can lift a word's vocab mastery but never lower it. Returns the same queue reference when nothing changed.
- `getNextCandidates(currentQueue, maxToFind, ignoredIds?)` / `countLearnableGrammar` / `hasMoreLearnableGrammar`: walk JLPT order N5 → N1 (`GRAMMAR_JLPT_LEVELS`), source order within a level. **Always** this order - grammar has no frequency data to sort by (unlike vocab), so there's no `preferredLearningOrder` setting for it, and no kanji filtering either (kanji-awareness applies to which *vocab words* are blanked in a quiz sentence, not to which grammar points can be learned - see `computeBlankPlan` in State Management).

### Storage Service (`storage.service.ts`)

Local storage wrapper for user data persistence.

**Keys** (from `constants.ts`):
- `GOKAN_SRS_PROGRESS`: User progress data
- `GOKAN_SRS_SETTINGS`: User settings

### Google Drive Sync (`services/sync/`)

Cloud sync, split into three modules by responsibility:

**`driveClient.ts`** - Thin wrapper around the Drive v3 REST API (folder/file list, download, upload, trash). No merge/business logic - just HTTP calls and `GoogleAuthError` translation on 401/403, so it can be unit-tested without a network by mocking the class methods it needs.

**`mergeProgress.ts`** (pure, no I/O) - Reconciliation logic:
- `mergeEntry(local, remote)`: merges one `SRSEntry` (reading OR meaning) - the entry with the more recent `lastReviewedAt` wins scheduling-relevant fields (dueDate, difficulty), while `memoryStrength`/`interval` are each taken as the **max** of both sides as a safety net; `history` is a full union deduped by timestamp.
- `mergeVocabProgress(local, remote, settings)`: merges reading and meaning **independently** via `mergeEntry` - a device that only reviewed reading can never clobber another device's meaning review (and vice versa). `stage`/`nextReviewAt` are always **re-derived** via `scheduling.ts`, never merged directly.
- `mergeLearningQueues`: pure union by `vocabId` (never drops a word).
- `mergeGrammarProgress`/`mergeGrammarQueues`: grammar's equivalent - `mergeEntry` reused directly (one entry, no reading/meaning split to merge independently), `needsRetry` OR'd, `stage`/`nextReviewAt` re-derived via `grammarScheduling.ts`. `mergeGrammarQueues` is a pure union by `grammarId`.
- `mergeProgress`/`mergeSettings`: top-level merge - kanji knowledge is last-version-wins (local wins on a tie, to preserve un-pushed local edits/deletions), stats are field-wise max, `dailyOverride` is OR'd, `grammarQueue` merged via `mergeGrammarQueues`, and the sync version counter always bumps by 1 past the higher input.

**`googleDriveSync.ts`** (`GoogleDriveSync` class) - Orchestrates the above against Drive:
- **Optimistic concurrency**: captures the remote file's `modifiedTime` when read, re-verifies it immediately before writing, and retries (re-fetch + re-merge, up to 3 attempts) if it changed - closes the classic read-modify-write lost-update window.
- **Duplicate-file reconciliation**: if more than one file matches the expected name (two devices creating it concurrently), all copies are downloaded, merged together, written back to one canonical file, and the rest are trashed.
- **`ensureRemoteBackupOnce()`**: write-once safety net - before this instance's first write, snapshots the current live remote file under `kanji-progress.pre-v8-backup.json`. No-ops if a backup already exists or there's nothing live to back up. Failures are logged but non-fatal (the local backup below is the primary safety net).

**Surfacing background changes to the UI**: `GoogleDriveContext` exposes `lastBackgroundMergeTime` (bumped after a successful background sync) separately from `lastDownloadTime` (bumped only on a full blocking download). `useQuizOrchestration` reconciles (merges) remote changes into live React state via the `RECONCILE_REMOTE` action rather than replacing state wholesale, so an answer submitted mid-sync is never silently overwritten. A `syncPaused` flag surfaces an expired/invalid token visibly (`SyncStatusIndicator` in `App.tsx` shows a reconnect button) instead of silently stopping uploads.

### Data Safety (`backup.service.ts`, `progressSerialization.ts`)

**`BackupService`**: write-once local safety net. `ensureLocalBackupOnce(rawJson)` snapshots the exact raw (un-migrated) localStorage bytes under `GOKAN_SRS_PROGRESS_BACKUP_PREV8` the first time `StorageService.loadProgress()` runs - before any migration logic touches them. Never overwritten once written.

**`progressSerialization.ts`**: single shared (de)serialization module used by both `storage.service.ts` and `sync/googleDriveSync.ts`, so a stored payload always hydrates into the exact same in-memory shape regardless of which channel it came from (fixes a previous divergence where the two channels handled `Date`/`Set` fields slightly differently). Exposes `toPlainProgressJSON`, `hydrateProgress`, and `migrateAndHydrateProgress` (migration + hydration in one call).

### Migration Service (`migration.service.ts`)

Handles data format upgrades to ensure backward compatibility.

**Two-tier version scheme:**
- `SYNC_MIGRATION_VERSION` (7): the ceiling the **synchronous** pass (`migrateUserProgress`) can ever stamp on its own.
- `CURRENT_FORMAT_VERSION` (8): the true terminal version, reachable **only** after the **async** homograph-merge pass (`migrateMergedVocabsAsync`) has actually run.

Previously both were the same constant, so the cheap synchronous pass could stamp the terminal version on its own and pre-empt the async pass entirely - `needsMigration()` would report `false` immediately after a single synchronous load, and the homograph-merge migration (which needs a network fetch) would silently never run. `migrateUserProgress` now caps at `SYNC_MIGRATION_VERSION`, so `needsMigration()` correctly keeps reporting `true` until the async pass has actually completed.

**Features:**
- Converts old `mastery` (0-100) system to new `memoryStrength`/`interval` system
- Normalizes `needsRetry` (legacy boolean → per-type `{reading?, meaning?}` object) **unconditionally**, regardless of format version, since the field isn't tied to the version-gated passes
- Recomputes `nextReviewAt` unconditionally via `scheduling.ts` on every load, retroactively correcting any value written before that derivation existed
- `grammarQueue` (issue #17) is a purely additive field, so it needs no version-gated pass at all - `migrateUserProgress` just fills `DEFAULT_GRAMMAR_PROGRESS` defaults into each item and recomputes its `nextReviewAt` via `grammarScheduling.ts`, unconditionally, every load
- Idempotent migration (already-migrated data not re-migrated)
- Automatic migration on data load (Storage & Google Drive)

**Conversion Formula:**
- `memoryStrength = (mastery / 100) * maxMemoryStrength`
- mastery 0 → memoryStrength 0 (beginner)
- mastery 100 → memoryStrength 1270 (≈1 year interval, mastered)

---

## State Management

### Quiz State (`context/quiz/`)

The quiz state machine is split into four single-responsibility modules rather than one monolithic provider:

- **`quizReducer.ts`** - Pure `QuizState`/`QuizAction`/reducer. No I/O, no side effects, no `Date.now()` calls - fully unit-testable in isolation (`quizReducer.test.ts`).
- **`quizSelectors.ts`** - `selectNextView(state, hasMoreLearnable, now)` is the **single source of truth** for "what should the quiz screen show right now". It replaces three previously-independent decision points (a queue-level `nextDue` memo, a `computeSessionView` function, and an ad-hoc `currentProgress.introductionAt` check in `VocabQuizScreen`) that could drift out of agreement. Returns `{ queueItem, sessionState, nextReviewAt, shouldShowIntro }`. Also exposes `selectCurrentProgress`, `selectCurrentSentence`, `collectActionableTaskKeys` (every quiz task actionable now, as `TaskKey[]`), `dedupTaskKeysByVocab` (keeps at most one task per vocab, reading > meaning > production - see Session quiz cap below), `capSessionCommit` (truncates a snapshot to `CONSTANTS.srs.sessionQuizCap`, split evenly across quiz types with spillover), `selectSessionStats`, and `selectNextSessionPreview`. `selectSessionStats(state, hasMoreLearnable, now)` returns `{ done, total, retriesPending, waiting, moreNew }` computed against the **raw, unfiltered** `state.session.committed` - the same set `selectNextView` serves from and `selectNextSessionPreview` counts, so the three can never disagree: `total` = committed set size (**fixed** for the session), `done` = committed tasks no longer actionable (answered, deferred, or graduated), `retriesPending` = committed tasks currently awaiting a retry (a wrong answer this session, shown highlighted and appended to the bar denominator), `waiting` = distinct vocab with tasks due *now* that were never committed to this session, `moreNew` = `hasMoreLearnable` (the "+" in "n+ waiting"). This replaced a `done + liveDueReviews` formula whose denominator **shrank on every wrong answer** (a wrong answer pushes the due date ~12h out - leaving the live due count - without incrementing `done`, and the pending retry was never re-counted). `selectNextSessionPreview(state, now)` returns `{ review, new, retries, remaining }`, a preview of what the *next* study session will contain - shown on the Main hub's quiz activity card before the user even clicks in. `review`/`retries` count **quiz cards**, derived by running the session's own pipeline (`collectActionableTaskKeys`, then `dedupTaskKeysByVocab`, then `capSessionCommit`), so the figure on the card is literally what the session will commit to and cannot drift from it. `remaining` is the overflow past dedup+`sessionQuizCap` combined, rendered as "N more after this session". `new` stays a count of **words**, since a queued-but-not-yet-due word produces no task key and how many cards it becomes depends on choices the learner has not made yet. Buckets stay mutually exclusive per word: a retry-flagged word counts once, as a retry.

  This replaced a per-distinct-vocab count whose due-check listed reading and meaning by hand. It was never extended to production, so a queue with only production due reported "all caught up" while the session had a full run of cards waiting - and counting words understated a session that asks up to three cards per word, which matters much more now the cap bounds the sitting.
- **`useQuizOrchestration.ts`** - Every effect (vocab/sentence loading, auto-advance timing, daily reset, persistence, migration triggering, Drive sync reconciliation, **session lifecycle** `SESSION_START`/`SESSION_END`) and every action (`submitAnswer`, `continueToNext`, `advanceQueue`, etc.), returning `{ actions, nextView, currentProgress, computed, sessionStats, nextSessionPreview }`. Mount-once effects use a `useRef` guard instead of the previous string-hack dependency array (`[state.progress ? 'loaded' : 'loading']`). Reads `useLocation()` (it renders inside `QuizProvider`, itself inside `BrowserRouter` - see `main.tsx`) to gate both the vocab-loading effect and the session-lifecycle effect to the `/quiz` route, so browsing Settings/Stats/the Main hub neither keeps fetching vocab in the background nor keeps a session alive - see the Main Screen entry in Application Pages.
- **`QuizProvider.tsx`** - Thin assembler: `useReducer(quizReducer, ...)` + `useQuizOrchestration(...)`, wires the result into `QuizContext.Provider`. Owns the public `QuizContextValue` interface.

`useQuiz.ts` (unchanged location) still exposes the `useQuiz()` hook and `QuizContext` object; its type import now points at `./quiz/QuizProvider`.

#### State Shape (`QuizState`)
```typescript
{
  progress: UserProgress | null,
  settings: UserSettings | null,
  currentVocab: Vocabulary | null,
  currentSentences: Sentence[] | null,
  currentSentenceId: string | null,
  currentQuizItem: PendingQuizItem | null,
  userAnswer: string,
  feedback: { show, correct, type, message, matchedAnswer } | null,
  isLoadingVocab: boolean,
  isEvaluatingAi: boolean,
  introCandidates: Vocabulary[],
  nextKanjiToLearn: { step: number; kanjis: string[] } | null,
  sessionHistory: Array<{ vocabId, writtenForm, result, delta }>,
  session: { committed: TaskKey[] } | null,   // active study session's frozen task set
  fatalError: string | null
}
```

**`session` (the committed task set)**: `TaskKey` is `` `${vocabId}:${quizType}` `` (built via the exported `taskKey()` helper). `session.committed` is captured **once** when a study session begins - a snapshot of every quiz task actionable at that moment (`collectActionableTaskKeys`), deduped to at most one task per vocab (`dedupTaskKeysByVocab`, reading > meaning > production) then capped (`capSessionCommit`) - and is extended only by the user's own "Learn" choices (`VOCAB_INTRO_CHOICE` adds the learned word's `reading` task). It never grows from background reviews coming due mid-session.

**Session lifecycle is route-gated** (see `[2026-08-02]` Main Screen entry below): a session can only be active while the user is on `/quiz`, so navigating to any other page (the Main hub, Settings, Stats, ...) ends it exactly like running out of due work does. `SESSION_END` simply clears `session`. There is no longer an end-of-session recap in state - the `[2026-08-04]` change replaced it with a **daily** activity card on the Main hub, sourced from persisted review history (`buildDailyActivity`) rather than the ephemeral session, so it stays accurate across however many sessions happen in a day; see the Main Screen entry in Application Pages.

A vocab with more than one direction due at once (e.g. reading and meaning both actionable) contributes **only its highest-priority direction** to `session.committed` - `dedupTaskKeysByVocab` keeps reading over meaning over production, and the excluded direction(s) are simply not part of this session; they surface as `waiting` and are picked up by a later session's own commit once the committed direction is no longer due (see `docs/MODIFICATION_LOG.md`). This replaced a same-session-collision mechanism that lived in `SRSService.applyAnswer` instead: a correct reading answer used to push a due meaning's `dueDate` forward 12h so the two weren't asked back to back. That stagger was asymmetric (production was never staggered) and had a second-order bug once a session could commit both directions for one vocab at all - the stagger silently resolved the committed meaning task's `SessionStats.done` without the user ever answering it, so one answer could advance the progress bar by 2. Deduping at commit time removes the need for the stagger entirely (there's no second committed task left for it to resolve) and covers all three quiz types uniformly, so `applyAnswer` no longer touches any entry's `dueDate` other than the one it was asked to grade. `selectSessionStats` counts `done`/`total`/`retriesPending` against the frozen, already-deduped `session.committed` set as-is - it does not dedup or filter it itself - and reports mid-session arrivals (plus a vocab's deduped-out other directions) separately as "waiting". The lifecycle (`SESSION_START` on entering review/learn, `SESSION_END` on reaching waiting/exhausted) is driven by an effect in `useQuizOrchestration`, which computes the snapshot with `now` so the reducer stays free of `Date.now()`.

Note: this is **not** the old `sessionQueue`/`sessionBuiltAt` subsystem (a prior "frozen session queue" refactor, see historical `[2026-02-28]` log entry, that nothing ever read - deleted as dead code). That one froze whole vocab items; `session.committed` is a task-key set, and retry-on-wrong-answer is still handled entirely by the per-type `needsRetry` flag on `VocabProgress`, not by the session. Note also that `session.committed` **is** now authoritative over what card is served next (see Session quiz cap below) - it was read only by the progress counter before that change.

#### Session quiz cap

`session.committed` bounds what a sitting can serve, not just what its progress counter counts. `selectNextView` passes it to `getNextVocabToStudy` as an `allowed` set, and the commit pipeline - `collectActionableTaskKeys` → `dedupTaskKeysByVocab` → `capSessionCommit` (all `quizSelectors.ts`) - deduplicates to one task per vocab and then truncates to `CONSTANTS.srs.sessionQuizCap` (200) tasks at commit time. Both `selectNextSessionPreview` and the `SESSION_START` snapshot in `useQuizOrchestration` run the exact same three-function pipeline, so the Main hub's preview count, the in-session progress bar's denominator, and what actually gets served can never drift from each other.

Four things about it are load-bearing:

- **Dedup runs before the cap, not after.** `dedupTaskKeysByVocab` keeps at most one task per vocab (reading > meaning > production), so `capSessionCommit`'s even split-by-type operates on the already-deduped pool. Capping first and deduping after would let a vocab's lower-priority direction occupy a cap slot that a dedup pass would otherwise have freed up for a different vocab entirely.
- **The cap is composed per quiz type, not taken as a prefix.** `getNextVocabToStudy` clears every actionable reading before any meaning, so a prefix of the snapshot would commit 200 readings and zero meanings for a user with 400 due, session after session, while the meaning backlog only grew. `capSessionCommit` buckets by type and fills smallest-pool-first, so each type gets an even share and a type with less work than its share spills the surplus to the others rather than cutting the session short. The split is over the types actually present, so it is thirds now that the production quiz exists, and was halves before it. In practice the dedup step skews this: a user with every word's reading due commits almost entirely reading tasks in early sessions, and meaning/production arrive once reading intervals grow past daily - which is the intended "a vocab's other directions naturally never share a session" behavior, not a bug in the split.
- **The committed set is read unfiltered everywhere it's consumed - for serving and for counting.** A meaning-dropping filter (`filterSessionCommit`) once ran at commit time, which made a dropped task unservable: production was unservable in any session where the word's reading was also due, which for a daily reviewer was every session. Moving that filter to run only inside `selectSessionStats` fixed serving but left the progress counter's `total`/`waiting` disagreeing with both what actually gets served and with `selectNextSessionPreview` (unfiltered). Both problems traced back to the same root cause - trying to solve "don't ask both directions of a word in one sitting" by filtering/staggering *after* the commit, rather than deciding it once when the commit is built - which `dedupTaskKeysByVocab` now does instead (see `docs/MODIFICATION_LOG.md`). The committed set is the single deduped, capped actionable set, filtered nowhere downstream of that.
- **Selection bounded to `committed` needs an exit state, or the screen hangs.** Once the committed set is cleared while capped-out work is still due, `sessionState` computed off the live queue stays `'review'` while selection has nothing left to hand back, so `VocabQuizScreen` would sit on its loading gate forever. `selectNextView` returns `'session-complete'` for exactly that case (a session exists, no queue item, no intro candidates, and at least one actionable task outside the committed set), and `getNextVocabToStudy` returns null rather than falling through to new intros so the user is not started on new vocabulary while reviews they were never offered are due.

`sessionActive` in `useQuizOrchestration` deliberately counts `'session-complete'` as active. Ending the session there would immediately re-satisfy `useSessionLifecycle`'s start condition (work is still due, the route is still `/quiz`) and silently commit a fresh capped set, which would make the cap invisible: the user would just keep being handed cards. Starting another session is the user's explicit choice, via `actions.startNewSession()` (dispatches `SESSION_END`; the lifecycle effect then re-snapshots and re-caps on the next render) from `SessionCompleteScreen`.

#### Actions
- `SETUP_COMPLETE`: Initialize progress after setup
- `LOAD_VOCAB_START/SUCCESS/ERROR`: Vocabulary loading states
- `SET_ANSWER`: Update user input
- `SUBMIT_ANSWER`: Process answer submission
- `UPDATE_AFTER_ANSWER`: Apply the (already-computed) SRS update after `continueToNext`
- `ADVANCE_QUEUE`: Move to next vocab item / fetch intro candidates
- `SAVE_SETTINGS`: Update user settings (clears `introCandidates` if the learning order changed)
- `UPDATE_KANJI_KNOWLEDGE`: Update known kanji. Clears `introCandidates` and `nextKanjiToLearn` when the knowledge actually changed (method, step, or kanji set), since which vocabulary is optimal to learn next depends directly on the known kanji - the same invalidation `SAVE_SETTINGS` performs on a learning-order change. Returns state **unchanged** for an identical payload, because `KanjiKnowledgeEditor` fires its `onChange` on mount as well as on edit and must not discard a valid buffer (or loop).
- `OVERRIDE_DAILY_LIMIT`: Bypass daily new vocab limit (legacy - the limit itself is effectively disabled)
- `VOCAB_INTRO_CHOICE`: Handle Learn/Skip on intro card. On "Learn" with an active session, also adds the word's `reading` task to `session.committed` so a word the user chose to learn counts toward the session total (Skip graduates immediately and adds nothing).
- `SET_NEXT_KANJI` / `LEARN_NEXT_KANJI`: KKLC step-unlock flow
- `SESSION_START` / `SESSION_END`: Set/clear `session` (the frozen task set behind the progress counter). `SESSION_START` takes the pre-computed `taskKeys` snapshot; `SESSION_END` is a no-op (same reference) when no session is active, otherwise clears it.
- `RESET`: Clear all progress
- `RESET_DAILY_STATS`: Reset daily counters (midnight)
- `RECONCILE_REMOTE`: Assign an already-merged `{progress, settings}` from a background Drive sync. The merge itself happens in `useQuizOrchestration` (via `sync/mergeProgress.ts`) **before** dispatch, so the reducer just assigns the result - everything else (`currentVocab`, `userAnswer`, `feedback`) is left untouched, so a background sync can never interrupt an answer in progress.

#### Computed Values
- `isSetupComplete`: Whether initial setup is done
- `sessionState`: Current session state (review/learn/learn-kanji/waiting/exhausted) - derived by `selectNextView`
- `shouldShowIntro`: Whether the currently-loaded vocab should show the intro card - also derived by `selectNextView`
- `currentProgress`: VocabProgress for current vocab
- `nextReviewAt`: Next review timestamp

#### Key Functions
- `setupComplete({ kanjiKnowledge, settings })`: Complete initial setup
- `submitAnswer()`: Evaluate and record answer
- `advanceQueue({ now, overrideDailyLimit })`: Load next vocab
- `continueToNext()`: Move to next item after feedback (calls `SRSService.applyAnswer` exactly once per answer - a prior version called it twice, once for the mastery-delta history entry and once for the queue update)
- `saveVocabIntroChoice(vocab, 'learn'|'skip')`: Handle intro card choice
- `startNewSession()`: End a finished session so the lifecycle effect commits a fresh capped one (the "Start another session" button on `SessionCompleteScreen`)

### Grammar Activity State (`context/quiz/grammarReducer.ts`, `grammarSelectors.ts`, `useGrammarOrchestration.ts`)

The Grammar activity (issue #17) is a **parallel concern within the same `QuizState`/`QuizProvider`**, not a second context/provider. `grammarQueue` lives on the same `UserProgress` object as `learningQueue`, and `useQuizOrchestration`'s persistence/Drive-sync effects key off `state.progress` reference changes generically - so a second provider would need its own read/write path onto that same object, racing the first. Instead:

- **`grammarReducer.ts`** - Defines the grammar-only slice of `QuizState` (`GrammarQuizState`, intersected into `QuizState`) and every `GRAMMAR_`-prefixed action, plus the pure `grammarReducer(state, action)` function. `quizReducer.ts`'s top-level `quizReducer` delegates to it via `isGrammarAction()` (a simple `action.type.startsWith('GRAMMAR_')` check) before its own `switch` - so vocab's reducer code needs no awareness of grammar's action shapes.
- **`grammarSelectors.ts`** - `selectNextGrammarView(state, hasMoreLearnableGrammar, now)` mirrors `selectNextView` (same `{ queueItem, sessionState, nextReviewAt, shouldShowIntro }` shape, `sessionState` typed `GrammarSessionState = Exclude<SessionState, 'learn-kanji'>` since grammar has no kanji-gated step). `computeBlankPlan(point, progress, reviewCount)` (**async**) is grammar-specific: walks the point's examples starting from a deterministic pick (hashed on `${grammarId}:${reviewCount}`, so repeated reviews of the same point cycle through its examples instead of re-rolling every render, wrapping around all examples) in four preference passes. **The grammar construction is the primary thing tested, vocabulary is secondary** - there is one `SRSEntry` per grammar point, so what gets graded has to consistently reflect grammar-point recall, or the schedule that entry drives doesn't mean what it claims to:
  1. **PRIMARY** - the first example whose grammar-pattern markers were located at dataset build time (`GrammarExample.patternWordIndices`, non-empty - see `gokan-dataset`'s `docs/SCHEMA.md` and its pattern-location issue). Blanks those markers unconditionally, regardless of vocab knowledge, then layers in - as **secondary** reinforcement - any other content word in that same example the user already knows (`learningQueue` entry with `introductionAt !== null`), sorted by position. Unknown vocab stays pre-filled as literal context either way.
  2. **FALLBACK** - the pattern isn't locatable in any of the point's examples (rare: ~1.9% of points as of the dataset's last build, all conjugation-transformation-style points with no literal marker in common across their own examples, e.g. potential-form verb tables). The first example containing at least one known word - blanks every known word in it. This is the *original* vocab-only behavior, now demoted to a fallback for the residual the primary path can't cover.
  3. **FALLBACK** - no example has a known word either, on one of these rare pattern-less points: the first example with ANY blankable word (resolved to a vocab id) at all, blanking exactly the single most frequent one (`VocabularyService.loadVocab(...).frequency.kanjiRank`, lowest wins) rather than every content word - blanking everything produced unanswerable cards for a learner with no vocab overlap yet.
  4. If literally no example in the whole point has a single blankable word, returns a read-only plan (`blankWordIndices: []`, `readOnly: true`) - `GrammarQuizCard` renders it as pure study material with no Submit step, since grading zero blanks previously auto-passed and silently granted SRS credit.

  For the blanks it selects, `computeBlankPlan` also resolves (via `VocabularyService.loadVocab`, once per blank, at load time so grading stays synchronous) an `acceptLists: string[][]` - surface, embedded reading, plus every writing variant the vocab fetch offers - and a `glosses: string[]` for the hint control. A failed fetch degrades gracefully to surface+reading and an empty gloss rather than blocking the card. `gradeGrammarAnswers(blankPlan, answers, hintLevels)` is the pure, separately-testable grading function: matches each answer against its blank's accept-list via `SRSService.evaluateAnswer` (same call vocab's reading quiz uses), forces `'minor_error'` for any blank whose hint was revealed to level 2 regardless of what was typed (issue #32 follow-up, RC3 item 3 - previously forced `'pass'`), then decides the grammar point's result from the **pattern-marker blanks alone** (issue #33 follow-up): `computeBlankPlan` now emits an `isPatternBlank: boolean[]` (which blanks are `patternWordIndices` markers vs. secondary vocab reinforcement), and `overall` is the worst-of the *pattern* blanks (**`wrong` > `pass` > `minor_error` > `correct`**) - a missed *vocab* reinforcement blank can never turn a demonstrated grammar core into `wrong`. Vocab blanks instead scale the reward: `gradeGrammarAnswers` also returns a `strengthDeltaModifier` in `[GRAMMAR_VOCAB_COEFF_FLOOR (0.5), 1]` (= `floor + (1 - floor) * vocabCorrectRatio`), applied only when the pattern was a success, since there's one SRSEntry per grammar point and its schedule must reflect grammar-point recall rather than vocabulary that happened to sit in the sentence. On the fallback examples with no located pattern (every `isPatternBlank` false), `overall` falls back to worst-of across *every* blank at full strength (the original behaviour). `'pass'` stays reachable independently of the hint system (a literal typed "pass"). Also exposes `selectCurrentGrammarProgress` and `selectNextGrammarSessionPreview` (mirrors `selectNextSessionPreview`'s `{ review, new, retries }` shape, same mutually-exclusive-bucket logic, for the Main hub's grammar activity card).
- **`useGrammarOrchestration.ts`** - Grammar's equivalent of `useQuizOrchestration`: loading (route-gated to `/grammar`, same guard-by-comparing-`currentGrammarQuizItem` pattern as vocab's vocab-loading effect, now `await`ing `computeBlankPlan`'s vocab fetches before dispatching `GRAMMAR_LOAD_SUCCESS`), auto-advance on a correct answer, and the actions (`setGrammarAnswer`, `revealGrammarHint`, `submitGrammarAnswer`, `advanceGrammarQueue`, `continueGrammarToNext`, `saveGrammarIntroChoice`). `submitGrammarAnswer` delegates grading to `gradeGrammarAnswers` (above) and is a no-op on a `readOnly` plan (nothing to grade). `continueGrammarToNext` branches on `currentGrammarBlankPlan.readOnly`: the normal path applies the combined result via `GrammarSRSService.applyAnswer` (threading the grading's `strengthDeltaModifier` through to `SRSService.calculateNextState`, which scales the memory-strength delta) and additionally feeds **positive-only vocab credit** - the non-pattern blanks the user answered correctly without revealing the hint - into those words' own reading SRS via `GrammarSRSService.applyVocabReinforcement` (skipped on a grammar retry so a training redo can't over-credit the same words; a wrong vocab blank never reaches it, so grammar practice can never *penalise* vocab); the read-only path calls `GrammarSRSService.deferWithoutCredit` instead, which reschedules `dueDate` by a fixed 24h cooldown **without touching `memoryStrength`/`interval`/`difficulty`** - genuinely no SRS credit, just enough to keep the ungradable card from reappearing on the very next pick. Deliberately does **not** duplicate persistence/Drive-sync wiring - dispatching through the shared `quizReducer` gets that for free.
- **Per-blank hint control**: `grammarHintLevels: number[]` (parallel to `blankWordIndices`, reset whenever a new blank plan loads) tracks each blank's hint state - 0 = none, 1 = gloss shown (`revealGrammarHint` dispatches `GRAMMAR_REVEAL_HINT`, capped at 2), 2 = answer revealed. Reaching level 2 writes the accepted form into `grammarAnswers` through the reducer, rather than the card substituting it at render time; the earlier render-only form meant the input showed the answer while state stayed empty, which is what blocked submission when the last remaining blank was revealed. A revealed blank always grades `'minor_error'` (see `gradeGrammarAnswers` above), matching `CONSTANTS.srs.formula.resultFactors.minor_error` (+0.10) - giving up on a word you don't know still leaves an impression from reading the answer, so it's graded the same as a near-miss rather than as harshly as `'wrong'` (-0.40) or as a genuine skip (`'pass'`, -0.15).
- **Session-progress bar parity** (issue #32 follow-up): grammar now has the same frozen-committed-set progress counter vocab has, brought in once the v1 scope cut ("a smaller, reasonable scope decision") started to feel like a real gap. `grammarReducer.ts` gained a `GrammarSessionTracking { committed: string[] }` slice (`grammarSession`, mirroring vocab's `SessionTracking` but simpler - a `GrammarProgress` has one task per point, so `committed` is just grammar ids, no `TaskKey`-style `id:quizType` composite needed) plus `GRAMMAR_SESSION_START`/`GRAMMAR_SESSION_END` actions and a `grammarSessionHistory` array (`{ grammarId, title, result, delta }`, mirroring vocab's `sessionHistory`). `grammarSelectors.ts` gained `collectActionableGrammarIds(queue, now)` (grammar's `collectActionableTaskKeys`, using `isGrammarDue`/`needsRetry`) and `selectGrammarSessionStats(state, hasMoreLearnableGrammar, now)` (grammar's `selectSessionStats`, same `{ done, total, retriesPending, waiting, moreNew }` shape - no staggering to account for, since there's no reading/meaning split). `useGrammarOrchestration.ts` runs the matching session-lifecycle effect (route-gated to `/grammar`, active on `review`/`learn`) and computes each `continueGrammarToNext()` answer's mastery-delta `historyItem` the same way vocab's `continueToNext()` does. `GRAMMAR_INTRO_CHOICE`'s "learn" path adds the point to `grammarSession.committed`, mirroring `VOCAB_INTRO_CHOICE`.

`QuizContextValue` exposes the grammar activity as its own group of fields/actions (`grammarSessionState`, `grammarNextReviewAt`, `currentGrammarProgress`, `shouldShowGrammarIntro`, `nextGrammarSessionPreview`, `grammarSessionStats`, `grammarActions`, `grammarComputed`) alongside the vocab ones - `useQuiz()` is the single hook both activities read from.

---

## Application Pages

### Main Screen (`pages/main/MainScreen.tsx`)

The activity hub - the landing page (route `/`) after setup, replacing the previous behavior of dropping users straight into the quiz. Activities (the main actions a user can take) are presented as cards: "Vocabulary quiz session" (`/quiz`) and "Grammar quiz session" (`/grammar`, issue #17). Settings, Stats, and Kanji are **not** activities - they stay in the global header toolbar (`App.tsx`, rendered outside `<Routes>` so it's present on every page), unchanged by this page's introduction.

Both activity cards render their preview description via a shared `renderSessionPreviewDescription(preview, nextReviewAt)` helper (`MainScreen.tsx`): `"{review} review · {new} new"`, with `· {retries} retries` appended (in the error color) only when `retries > 0`. When all three counts are 0, it falls back to a caught-up message, showing the next review's ETA when one is known. When `preview.remaining > 0` a second line reads `"{remaining} more after this session"`: only the vocab card can overflow (its session is capped, grammar's is not), and saying so up front is the difference between "this session is the work" and "this session is a slice of it", which changes whether the user stops after it. The vocab card sources its preview from `selectNextSessionPreview(state, now)`; the grammar card from `selectNextGrammarSessionPreview(state, now)` - see State Management for both selectors, and Modification Log `[2026-08-04]`/`[2026-08-05]`.

Each activity card carries a **settings cog** in its top right corner, opening that activity's `QuizSettingsMenu` (see Per-activity quiz settings below). This is the only entry point to activity-scoped settings.

`DailyActivityCard` (`pages/main/DailyActivityCard.tsx`) replaced the old ephemeral end-of-session recap (`[2026-08-02]`-era `lastSessionRecap`, removed `[2026-08-04]`): a **today** rollup (reviewed / correct / incorrect) plus a compact 7-day bar chart, both derived from `buildDailyActivity(progress, 7)` (`utils/activity.utils.ts`) - the same per-day bucketing `DailyProgressionChart` uses on the Stats screen. Reading persisted `reading.history`/`meaning.history` logs instead of session-local state means the card stays accurate across however many small sessions happen in a day, rather than being overwritten by the next session like the old recap was.

### Header toolbar and search (`App.tsx`, `components/SearchBar.tsx`)

The toolbar renders outside `<Routes>`, so it is present on every page. It is **one row from `md` up, two rows on a phone**: the logo and the five icons stay on row one, and the search bar wraps onto a full-width row of its own beneath them.

The wrap is done with `flex-wrap` plus per-breakpoint `order` on a single header, not with two markup blocks swapped by `isMobile`. One header in the DOM means nothing remounts when the viewport crosses the breakpoint, so the field cannot lose focus or its query mid-search. The search bar is therefore **last in the DOM** and pulled back between the logo and the spacer by `md:order-2`.

`SearchBar` takes its width and order from a `className` the header passes in, and owns no placement of its own, so where it sits at each breakpoint is decided in exactly one place.

**Two things about the mobile results panel are load-bearing:**

- It is `fixed` with a **measured** `top` (the field's `getBoundingClientRect().bottom`), not `absolute top-full`, because it has to span the viewport rather than the field's own width. The top is measured rather than derived from a header height, which changes with the toolbar's padding and with where the bar wraps. The page is scroll-locked while it is open, which is what keeps that measurement valid: nothing can scroll out from under a fixed panel.
- Its height comes from `window.visualViewport?.height` when available, falling back to `innerHeight`, so the panel ends above the on-screen keyboard instead of running underneath it.

The input is `text-base` on mobile and `md:text-sm` above it. Anything under 16px makes iOS Safari zoom the page in on focus, which on the old narrow field left the typed text scrolled out of view.

### Quiz Screen (`pages/quiz/VocabQuizScreen.tsx`)

Route `/quiz`. The study session itself - **explicit and boundable**, per the Main Screen's activity model: starting it snapshots the vocab available at that moment (`session.committed`, see State Management), and it ends the moment the user navigates to any other page (Main hub, Settings, Stats, ...) or naturally runs out of due work. Leaving early and running out both end the session identically - there's no separate "abandoned session" state. Resuming later (navigating back to `/quiz`) starts a brand new session against whatever is available then, never reopening the previous one.

Main study interface. Switches **exhaustively** on `sessionState` (a TypeScript `never` check at the `default` case fails to compile if a new `SessionState` value is ever added without being handled):

- **`'waiting'`**: Show `WaitingScreen` (next review time). Includes a "Back to activities" link to `/`, since `/quiz` is now a sub-page reached from the Main hub rather than the landing page itself.
- **`'exhausted'`**: Show `ExhaustedScreen` (no more content). Same "Back to activities" link as `WaitingScreen`.
- **`'session-complete'`**: Show `SessionCompleteScreen` (cards cleared, words still waiting, plus a "Start another session" button wired to `actions.startNewSession`). Reached only when the per-session quiz cap held work back; see Session quiz cap under State Management.
- **`'learn-kanji'`**: Show `LearnKanjiCard` (KKLC step unlock)
- **`'review'` / `'learn'`**: Loading gate, then `shouldShowIntro` (from `selectNextView`) decides `VocabIntroCard` vs. the active quiz card (`VocabQuizCard` for reading, `VocabMeaningQuizCard` for meaning, `VocabProductionQuizCard` for production, keyed on `currentQuizItem.quizType`)

**Auto-advance logic**: Owned by `useQuizOrchestration`. If the queue has no valid items but can introduce new vocab, automatically calls `advanceQueue()`.

**Shared formatting** (`pages/quiz/quizFormatting.ts`): `formatReadingList`, `getUniquePosTags`, `getUniqueRelatedCompounds`, and the `useExpandableDefinitions` hook are shared across `VocabQuizCard`, `VocabMeaningQuizCard`, and `VocabIntroCard` rather than being reimplemented in each.

**Shared focus management** (`hooks/useQuizFocusManagement.ts`, issue #32 follow-up RC4 item 2): `VocabBaseQuizCard` and `GrammarQuizCard` both need the same two behaviors - focus the first input on a fresh question (or when feedback clears for a retry), and focus the Continue button once feedback is showing, *unless* the current result is about to auto-advance on its own (a correct reading answer for vocab, a fully-correct answer for grammar) in which case focus is left alone rather than yanked onto a button about to disappear. Previously `VocabBaseQuizCard` (then named `BaseQuizCard`) had this logic inline and `GrammarQuizCard` had none at all - after submitting a grammar answer, focus was left on the now-disabled blank inputs, so Enter did nothing and a mouse became mandatory to continue. `useQuizFocusManagement({ feedbackShown, skipContinueFocus, continueFocusDelay }, deps)` returns `{ firstInputRef, continueRef }`; `deps` is a plain effect dependency array, left to the caller so each card can key the refocus on whatever identifies "a new question" for it (vocab: `[currentVocab?.id, feedback, quizType]`; grammar: `[point?.id, plan, feedback]`). `VocabBaseQuizCard` still owns its own separate effect for the incorrect-answer reveal-delay (`showCorrectAnswer`), which is a display concern, not a focus one.

**Shared session-progress header** (`components/SessionProgress.tsx`, issue #32 follow-up): the `done / total` counter plus its embedded `HistoryTicker` (most-recent-answers strip, correctness color + score delta) is fully presentational, parameterized over a `stats: SessionProgressStats` object and a `history: SessionHistoryEntry[]` array (`{ key, href, label, result, delta }`) rather than reading vocab-specific context directly - the same "mutualize, don't duplicate" treatment `SRSHistoryGraph`/`useQuizFocusManagement` got. `VocabQuizScreen` builds its props from `sessionStats`/`state.sessionHistory` (links to `/vocab/:id`); `GrammarScreen` builds its own from `grammarSessionStats`/`state.grammarSessionHistory` (links to `/grammar/:grammarId`, `waitingNoun="grammar points"` vs. vocab's `"vocab"`). Session-progress bar parity for grammar (previously a deliberate v1 scope cut) is covered in State Management → Grammar Activity State. The `HistoryTicker`'s per-item label now renders in `font-mincho` (was `font-serif`, which has no CJK fallback - the same class of bug the `[2026-08-05]` `GrammarIntroCard` title fix addressed), since both vocab written forms and grammar titles are Japanese text. It also renders a `GainsSummary`: **one net knowledge-point figure** that is the plain sum of the per-answer deltas in the ticker directly below it, so an answer reading `+6` moves the total by `+6`. In a grammar session it carries a second figure (`+N vocab`) for the points that answer credited to the sentence's vocabulary via `applyVocabReinforcement`, which was previously invisible. Each ticker row repeats its own `+N vocab` mark and reveals the per-word split on hover (`私 +2 · 思う +3`), so the aggregate can be traced to the words that earned it. The tooltip is positioned `fixed` off a measured rect rather than absolutely inside the row: the ticker is `overflow-hidden` (it has to be, to clip the strip as entries age out) and an absolutely-positioned child would be clipped with it, the same measured-fixed approach the header search panel uses. `summariseVocabGains` (`grammarSelectors.ts`) builds the split by diffing the learning queue around the reinforcement call rather than re-deriving it from `vocabCredits`, so it reports what was actually written, and labels each word by its dictionary form (`baseForm ?? surface`) since "思う +3" is a word the learner can look up where "思っ +3" is a fragment. The gained/lost breakdown moved to the tooltip. This replaced a `+X / -Y pts` pair that could not be reconciled with the rows beneath it: the ticker printed mastery percentages while the total summed points at half their value, so three numbers described one quantity in two units. See Constants -> knowledge points for the unit itself. To keep this session-scoped, `SESSION_START`/`GRAMMAR_SESSION_START` now also **reset** `sessionHistory`/`grammarSessionHistory`, so both the ticker and the gains figure reflect only the current session rather than accumulating across sessions. This is the lightweight "recap" that replaced the idea of a separate end-of-session recap screen (the earlier `[2026-08-04]` removal of `lastSessionRecap` stands): it counts for both activities via the shared component, with no new screen.

### Grammar Screen (`pages/grammar/GrammarScreen.tsx`)

Route `/grammar` (issue #17). The Grammar activity - a second SRS-driven study session alongside `/quiz`, following the same "explicit and boundable" activity model but with its own, simpler state machine (see State Management → Grammar Activity State). Switches exhaustively on `grammarSessionState` (`GrammarSessionState`, a `never`-checked default case same as `VocabQuizScreen`):

- **`'waiting'` / `'exhausted'`**: Inline `CenteredCard` messages (not `WaitingScreen`/`ExhaustedScreen` - those are vocab-copy-specific, e.g. "Learn more words"), each with a "Back to activities" link.
- **`'review'` / `'learn'`**: Loading gate, then `shouldShowGrammarIntro` (from `selectNextGrammarView`) decides `GrammarIntroCard` vs. a `SessionProgress` header (`stats={grammarSessionStats}`, `history={...grammarSessionHistory mapped to /grammar/:grammarId links}`, `waitingNoun="grammar points"`) plus `GrammarQuizCard`, positioned the same way `VocabQuizScreen` positions its own `SessionProgress` above `VocabQuizCard`/`VocabMeaningQuizCard` (issue #32 follow-up).

**`GrammarIntroCard`** (`pages/grammar/GrammarIntroCard.tsx`) - mirrors `VocabIntroCard`'s layout: a top-right `MasteryRing` (`currentGrammarProgress?.entry.memoryStrength ?? 0` - reads `0` here since an intro candidate has no `GrammarProgress` entry yet, same as a fresh vocab intro card would; issue #32 follow-up RC3 item 1), JLPT chip, title (rendered in `font-mincho`, **not** `font-serif` - the title contains Japanese characters and `font-serif`'s font stack, "Source Serif 4, Georgia, serif", has no CJK fallback at all, unlike `font-mincho`/`font-gothic` which both list a Noto JP fallback; caught via a scripted browser pass, see Modification Log `[2026-08-05]`), `point.romaji` when present (a small muted line beneath the title - issue #47, one of only two places romaji ever renders, the other being `GrammarDetailScreen`), short explanation, and the `formation` template in its own bordered box - appropriate here since this is the "here's what you're about to learn" screen, unlike the quiz card below where it would be the answer.

**`GrammarQuizCard`** (`pages/grammar/GrammarQuizCard.tsx`) - the fill-in-the-blank translation exercise: a top-right `MasteryRing` reflecting the point's own `SRSEntry` (`currentGrammarProgress?.entry.memoryStrength ?? 0`, mirroring `VocabQuizCard`/`VocabMeaningQuizCard`'s use of the same component for vocab - issue #32 follow-up RC3 item 1), then `example.en` as the prompt, then `example.words[]` rendered inline as literal `<span>`s interspersed with an `<input>` for every index in `currentGrammarBlankPlan.blankWordIndices` (see `computeBlankPlan`). Deliberately does **not** show `grammarPoint.formation` **or** `grammarPoint.title` anywhere on this card (RC3 item 2; RC4 item 1 for the title) - unlike the intro card, this one is testing recall of the blanked pattern, and either one can literally spell out the answer (many points' `title` *is* the formation written out, e.g. `それじゃ、～`). Only the JLPT chip stays. Each input is sized from its own **live typed value** (`Math.max(4, value.length + 1)ch`), not from the expected answer - sizing from the answer both froze the width and leaked the answer's character count before the user typed anything (issue #32, item 1). Does **not** reuse `VocabBaseQuizCard`'s markup (single-input-specific) - grammar needs multiple discrete inputs, so it owns its own form/submit/feedback JSX instead, reusing the `Card`/`CardSection` primitives, the same feedback-styling conventions (border colors, `bg-feedback-background`) as vocab's cards, and (RC4 item 2) the shared `useQuizFocusManagement` hook for keyboard-only flow - see the Quiz Screen entry above for details. On feedback, each blank's own border color reflects its individual `perBlankResults` entry (not just the combined result), and the *matched* accepted form (`feedback.matchedAnswers[i]`, not a fixed "expected" string) is revealed beneath any non-correct blank.

Each blank also has a small "?" hint button (hidden once feedback is shown): first click shows the word's English gloss beneath the input, second click reveals the answer (`plan.acceptLists[i][0]`) directly in the now-disabled input and grades that blank as `'minor_error'` on submit regardless of what was typed before (RC3 item 3 - previously `'pass'`) - see `grammarHintLevels` in State Management → Grammar Activity State.

When `currentGrammarBlankPlan.readOnly` is true (no blankable word in any of the point's examples - issue #32, item 6), `GrammarQuizCard` renders an early-return read-only variant instead: the full Japanese sentence as plain text, no inputs, and a single always-enabled Continue button (`grammarActions.continueGrammarToNext()` directly, bypassing the Submit/feedback cycle since there's nothing to grade). `grammarComputed.canSubmitGrammar` additionally requires `blankWordIndices.length > 0`, so an empty card can never reach Submit even if this render path were somehow skipped. It deliberately does **not** require every blank to be filled: see Submit is never gated on filled blanks below.

When `point.usageNote` is set, both the normal and read-only variants render it as a small italic `text-secondary` line directly beneath the JLPT chip (issue #42 - near-synonym points like でも/しかし/けれども are otherwise ungradable from the English prompt alone, since nothing in the sentence signals which register is expected). Nothing renders for the 409/828 points without one - no placeholder. Deliberately not shown on `GrammarIntroCard` or `GrammarDetailScreen`'s answer-adjacent areas beyond the explanation cards, since those already show `title`/`formation` and the note's whole purpose is disambiguation *without* those. Originally verified by hand-patching a point locally, before the dataset had any real `usageNote` values (see the Core Data Models `GrammarPoint` note); the dataset now populates it for 419/828 points as of the `apps/gokan-srs/dataset` submodule bump in issue #47.

### Search appearance (`index.html`, `public/favicon.*`)

What Google and DuckDuckGo show for the site is decided entirely by `apps/gokan-srs/index.html`, and three things about it are worth knowing.

**`/favicon.ico` must exist as a real file.** Search engines and their favicon services request it directly at the site root regardless of what `<link rel="icon">` says. With nothing there, CloudFront's SPA fallback answered `index.html` at `200 text/html`, so DuckDuckGo rendered no icon at all: it was asking for an image and being handed a web page. This is the same distribution-wide `custom_error_response` behaviour documented under Deployment, showing up somewhere it actively broke something.

**The icons are generated by `scripts/build-favicon.py`, run manually when the logo changes.** It is Python and Pillow in a Bun repository for one reason: the mark draws 語感 as SVG `<text>`, so rasterising it needs a CJK font at render time, and the JS-side rasterisers available here fall back to a font without CJK coverage and silently emit tofu boxes. Pillow lets the font be named explicitly and the glyphs asserted non-empty before anything is written. The `.ico` is packed by hand rather than through Pillow's ICO save, which only accepts one source image and resizes it: each size is drawn at its own scale instead, so the ring still reads at 16px rather than being a blurry downscale of the 48px art.

**The `<noscript>` block is not dead weight.** Googlebot executes JavaScript and indexes the rendered page, but DuckDuckGo took its result snippet from this block rather than from `meta description`, so both need to say something sensible and both need updating together.

`meta keywords` was removed: every major engine has ignored it since 2009, and it only advertised the target terms to competitors.

### Onboarding Flow (`pages/setup/OnboardingFlow.tsx`)

Wrapper for new users, replacing a direct `SetupScreen` call. Manages a two-step process:
1. **Welcome Screen** (`WelcomeScreen.tsx`): Explains the app's philosophy and offers three paths:
   - *Just starting out (Beginner)*: Skips the wizard entirely - initializes with KKLC step 0, an empty kanji set, and the `kanji_coverage` learning order.
   - *I already know some kanji (Kanji Learner)*: Proceeds to the Setup Screen wizard.
   - *Already have an account*: `GoogleLoginButton` - Drive login to restore existing progress (auto-retries the download once authenticated).
2. **Setup Screen** (`SetupScreen.tsx`): The wizard for the "Kanji Learner" path - collects kanji knowledge (method + step/count) and learning order preferences.

Calls `actions.setupComplete()` when either path produces a valid `SetupValues` object.

### Settings Screen (`pages/settings/Settings.tsx`)

Reached from the header's **person icon** (`UserRound`), not a cog: the cog now belongs to the per-activity panels below, so keeping one in the header would read as "the same thing, globally".

Section order, top to bottom:
1. **Account (Google Drive sync)** - moved to the top of the page from the bottom. Signing in is what makes every other setting and all progress follow the user across devices, so it is the first thing worth doing here.
2. **Appearance** - theme.
3. **Review pacing** - `learningFrequency` only. This is the one learning preference that is genuinely global: both `SRSService` and `grammarSrs.service.ts` read it.
4. **AI Context Validation** - Gemini toggle, API key, validate-all toggle. Deliberately **stays global** even though only the vocab meaning quiz consumes it today: context-aware validation is expected to reach other activities.
5. **Danger zone** - grammar-only reset, then reset-all (both with confirmation).

Activity-scoped settings are deliberately **not** here: they live on the Main hub's activity cards (below), so the page holds only what applies to the whole app.

### Per-activity quiz settings (`components/QuizSettingsMenu.tsx`, `pages/settings/sections/`)

Settings that only affect one kind of quiz are reached from a cog on **that activity's card on the Main hub** (`MainScreen.tsx`), and from nowhere else - not from the global settings page, and not from inside a running session. The hub is where the user picks an activity, so it is also where they set that activity up.

**`QuizSettingsMenu`** - the cog affordance and the panel chrome, nothing more. Owns open/close (Escape, backdrop click), and renders the panel through a **React portal onto `document.body`**: an inline absolutely-positioned panel would be clipped by the card and constrained by the hub's grid. Every panel footer links out to `/settings` for the global options.

The cog is a **sibling** of `ActivityCard`'s `<button>`, absolutely positioned over its top right corner, not a child of it: a button nested inside a button is invalid HTML, and a nested cog's click would bubble up and start the session instead of opening the settings.

**`pages/settings/sections/VocabQuizSettings.tsx`** - every setting that only affects the vocabulary quiz: `preferredLearningOrder`, `ignoreKnownKanjiRequirement` (shown for every order except `kklc`, a no-op there since it's gated by step rather than by kanji set - including `jlpt`, which is kanji-filtered by default and relies on this toggle to opt back into its old unconditional behavior), `kanjiCoverageTarget`, `enableMeaningQuiz`, and `meaningContextThreshold`. Takes `{ settings, onUpdateSettings, dense }`; `dense` is the narrow single-column layout the popover always uses.

**`pages/settings/sections/GrammarQuizSettings.tsx`** - a placeholder message. Grammar genuinely has no settings of its own yet (everything a grammar session reads is shared), and the honest placeholder was preferred over inventing a grammar-only toggle just to fill the panel. The cog is still shown, for symmetry with the vocabulary quiz.

**Shared controls**: `components/ui/SettingToggle.tsx` (the label + description + switch row, with `dense`/`disabled` variants) and `OptionGrid`'s `dense` prop were extracted so these panels reuse the settings page's controls rather than restyling their own.

### Submit is never gated on filled blanks (`GrammarQuizCard`)

`canSubmitGrammar` checks that a gradable card is loaded and that feedback is not already showing. It does **not** check that every blank has been filled, and that is a deliberate robustness choice rather than a convenience one.

Requiring every input non-empty makes the card **blockable**: any state where an input cannot be filled leaves the learner with no way forward at all, no matter what else is on screen. That has now happened three times, each from a different cause, and the `blankWordSpans` and `GrammarQuizState.example` doc comments record the first two (a multi-token marker split across boxes with no way to know which box wanted which token, and blank indices from one sentence applied to another). The third was the hint button: revealing a blank showed the accepted form as a render-time display value while `grammarAnswers[i]` stayed empty, so revealing the last remaining blank left Submit permanently disabled.

Each individual cause is fixed, but the shared failure mode is the gate itself, so the gate is gone. An empty blank is now a supported answer meaning "I do not know this one": `gradeGrammarAnswers` grades it `'pass'` (the same result a literally typed "pass" gives, -0.15) rather than `'wrong'`, and the accepted form is revealed in the feedback, which is what the learner was reaching for the hint button to get. Auto-advance still requires every blank strictly correct, so a skipped blank always pauses on feedback instead of skipping past the answer.
### Grammar Browse Screen (`pages/grammar/GrammarBrowseScreen.tsx`)

Route `/grammar/browse`, reached from the header toolbar. A read-only view of the whole grammar dataset, for inspection rather than study.

**Grouped by family by default**, not by JLPT level. The page's reason to exist is comparing near-synonyms, and level ordering is already what every other grammar surface presents (the SRS queue, the dictionary's index): family grouping is the view that is not available anywhere else.

**Two `min-width: auto` floors had to be released before this page fitted a phone**, and the first fix addressed only one of them, so the page still overflowed by 770px. Both are the same CSS default in different places: a flex or grid item will not shrink below its content's min-content width unless told to.

1. Each filter group wraps, and below `sm` the groups stack. A non-wrapping group could neither wrap nor shrink, and the Family group's five long labels set a floor far past a phone's width.
2. **The page root carries `w-full`**, and `PointCard`'s root carries `min-w-0`. These are the ones that actually mattered. `App.tsx` wraps every page in `flex flex-col items-center`, and under `align-items: center` a flex item is sized to `fit-content`, not stretched: without `w-full` the root simply grew to its own `max-w-6xl`, so at a 375px viewport the document measured 1161px. Every other page root in the app already had `w-full`, which is why this page alone broke. Once the root was constrained, the cards still forced 591px each, because the `truncate` classes inside them set `white-space: nowrap`, making each card's min-content the full untruncated string; `min-w-0` is what lets truncation actually engage.

Measured rather than eyeballed, which is why the second floor was found at all: `document.documentElement.scrollWidth - clientWidth` went 786 to 770 to 0, checked at 320px and 375px, with the three-column desktop grid confirmed unchanged at 1280px.

Its filter and sort controls persist in `sessionStorage`, so navigating into a grammar detail page and back does not reset them, matching `SmartVocabList`/`SmartGrammarList`. All three now share `hooks/usePersistedControls.ts` rather than each carrying their own copy of the read/write pair. Two details in that hook are load-bearing:
- **Sets are stored as arrays.** `JSON.stringify(new Set())` is `{}`, so persisting the multi-select filters directly would silently save them as empty and look exactly like the filters not being kept at all.
- **The snapshot is read via a lazy `useState`, not `useRef(read(key)).current`.** A ref's argument is still evaluated on every render even though only the first result is kept, so the previous form re-ran `getItem` plus `JSON.parse` on every keystroke and discarded the result. It also reads a ref during render, which the React lint rules reject.

`sessionStorage` rather than a React context: a context is lost on reload and would need a provider above every screen using it, while these are per-screen UI controls nothing else reads.

### Profile Screen (`pages/profile/UserProfileScreen.tsx`)

Hosts `KanjiKnowledgeEditor` (shared with the setup wizard), built around the two things people actually come here to do:

- **Move the known-kanji count by a fixed amount** (they studied another N kanji elsewhere): `KanjiCountStepper` pairs the raw count field with `-N`/`+N` buttons whose increment is the user's own, editable inline and persisted as `UserSettings.kanjiCountStep`. The profile page owns that persistence (`saveSettings`) and passes it down as `countStep`/`onCountStepChange`. The setup wizard supplies neither, and the whole stepping affordance (buttons plus increment field) is then left out rather than defaulted: a first-time user enters a count once, and there is no settings object to persist an increment into anyway.
- **Look one kanji up and see whether it counts as known**: `KanjiKnowledgeGrid` lays the ordered list out in rows of 10 (five on a phone, where ten left each tile about 20px wide once the gutters and gaps were taken out, so a 24px glyph overflowed its own tile and nothing was big enough to tap) with a position gutter (so "the kanji around 1240" is findable by eye), plus a search box resolving either a position (`1240`, `#1240`) or a pasted character via `utils/kanjiSearch.utils.ts`'s pure `findKanjiMatch`. A match is ring-highlighted and scrolled into view **within the pane only** (`container.scrollTo` on `offsetTop`, not `scrollIntoView`, which would also scroll the page out from under the search box while typing). Changing the count scrolls the pane the same way, to the frontier the new count reaches (skipping the first render, so opening the page doesn't animate anywhere the user didn't ask to go). Clicking any tile still toggles it known/unknown, as does the search result's own button.

The rows span the full pane width, matching the search box above them, so the tiles (and therefore the kanji) are as large as the page allows; they stay square via `aspect-square`. The scroll pane itself is user-resizable (`resize: vertical`, a native drag handle) from a starting height the host page picks via `gridHeight`/`initialHeight`: 36rem on the profile page against 22rem in the wizard. That requires a real `height` rather than a `max-height`, and the fade mask is top-only, since a bottom fade washed out the drag handle in that corner.

The grid's header label comes from an order → label map keyed on `KanjiKnowledgeMethod` rather than a hardcoded "KKLC", since further orders (RTK, JLPT) are expected: only that map and the loaded list change when one arrives.

Its scroll pane carries the `.scrollbar-subtle` utility (`index.css`), which styles both `scrollbar-width`/`scrollbar-color` and the `::-webkit-scrollbar` pseudo-elements. Chrome/Edge otherwise draw a wide opaque track that reads as a bright band down the side of a dark pane, where Firefox's thin scrollbar already looked right.

### Kanji Detail Screen (`pages/kanji/KanjiDetailScreen.tsx`)

Route: `/kanji/:character`. Mirrors `VocabDetailScreen`'s card-based layout at a smaller scale:
- Kanji glyph, JLPT chip (`steps.jlpt`, if set), KKLC step, frequency rank, and a "Known" badge if the character is in the user's `kanjiKnowledge.kanjiSet`
- `KanjiVocabListCard` (`pages/kanji/KanjiVocabListCard.tsx`): capped/expandable list (mirrors `VocabRelationshipsCard`'s pattern) of vocabulary containing this kanji, sourced from the `kanji-vocab.json` reverse index, each row navigating to `/vocab/:id`

`VocabDetailScreen`'s kanji-breakdown card (see Core Data Models → Vocabulary) provides the reverse link: each kanji in a word's `containedKanji` is a clickable chip navigating to `/kanji/:character`, so users can move vocab → kanji → vocab.

### Grammar Detail Screen (`pages/grammar/GrammarDetailScreen.tsx`)

Route: `/grammar/:grammarId` (issue #32 follow-up). Mirrors `VocabDetailScreen`'s card-based layout, letting a user look at a single grammar point outside of a live review:
- Title, `romaji` (small muted line beneath the title, omitted cleanly when absent - issue #47), JLPT chip, a `MasteryRing` reading the point's own `GrammarProgress.entry.memoryStrength` (`0` if not yet introduced), `shortExplanation`/`longExplanation`, `formation` (safe to show here, unlike on `GrammarQuizCard` - this is a study page, not a recall test), and every one of the point's example sentences (`jp`/`romaji`/`en`)
- **Interactive example sentences**: `jp` renders via the shared `InteractiveSentence` component (the same one `VocabSentencesCard` uses for vocab sentences) instead of plain text, so every resolved word (`GrammarExampleWord.vocabId !== null`) is clickable through to `/vocab/:id`, exactly like on `VocabDetailScreen`. `GrammarExample`'s shape (`words[]`, no `matches` offsets) differs from `Sentence`'s, so `utils/grammarSentence.utils.ts`'s `grammarExampleToSentence(example, index)` adapts one into the other - deriving each match's `start`/`length` from cumulative `surface` length rather than hand-tracking offsets, relying on the words-concatenate-to-`jp` invariant the dataset guarantees. No `targetVocabId` is passed (unlike vocab's usage, which highlights the vocab the page itself is about) since a grammar example has no single "target" word - every resolved word gets the same clickable-dashed-underline treatment.
- **Register cue (issue #42 follow-up)**: when set, `formalityLevel` renders as a small chip next to the JLPT chip (a label lookup, e.g. `'very-formal-literary'` → "Very formal / literary") and the full `usageNote` renders as a paragraph beneath the title - unlike `GrammarQuizCard`'s trimmed, answer-adjacent placement, there's no answer to leak here, so both render unconditionally when present
- An "Add to Grammar Queue" button when the point hasn't been introduced yet, dispatching the same `GRAMMAR_INTRO_CHOICE`-backed `grammarActions.saveGrammarIntroChoice(point, 'learn')` action `GrammarIntroCard`'s "Learn" button uses - mirrors `VocabDetailScreen`'s "Add to Learning List"
- Once introduced, a Stats card (reviews, interval, introduced date, next review) plus the shared `SRSHistoryGraph` (see below) plotted against the point's single `entry`
- `GrammarRelatedPointsCard` (`pages/grammar/GrammarRelatedPointsCard.tsx`, issue #42 follow-up, adapted to the named `family` schema in issue #45): `VocabRelationshipsCard`'s equivalent for `family.relatedPoints` - fetches each related id via `GrammarService.loadGrammarPoint`, renders `family.name` as the card header (falling back to the generic "Related Points" label only when `family` is absent, which shouldn't happen once `relatedIds.length > 0`) followed by a clickable list (kana-only title, no romaji + JLPT chip) navigating to `/grammar/:grammarId`, with the same cap/expand pattern (`INITIAL_COUNT = 5`, "Show all related points") since a family can run 5-6 members deep. Returns `null` when `family?.relatedPoints` is empty/absent, same as `VocabRelationshipsCard`'s no-relationships case
- Linked from `GrammarIntroCard`'s title and from the JLPT chip on `GrammarQuizCard` (both the normal and read-only variants) - deliberately **not** the quiz card's title, since RC4 removed that specifically to stop leaking the answer (see Application Pages → Grammar Screen)

**`SRSHistoryGraph`** (`components/SRSHistoryGraph.tsx`, renamed from `VocabHistoryGraph.tsx`): generalized to plot an arbitrary list of `{key, label, entry, color}` series against one shared time axis, rather than being hardcoded to vocab's reading/meaning pair - a `GrammarProgress.entry` is shaped exactly like a `VocabProgress.reading`/`meaning` entry for this purpose, so `GrammarDetailScreen` reuses the same component with a single-entry series instead of a second implementation. `VocabDetailScreen` passes reading and meaning, plus production once that entry has been activated; `GrammarDetailScreen` passes one (grammar). The vocab page's Next Review list and mastery rings follow the same rule: production shows a date once activated and the literal text **"Not started"** before that, rather than being hidden. An absent row reads as the feature being broken, which is exactly how the first release was reported.

### Statistics Screen (`pages/stats/StatsScreen.tsx`)

- `StatsOverview` - headline counters (including Kanji Coverage)
- `KnowledgeCurveChart` - cumulative knowledge held over time (steady growth vs. plateau); see `utils/knowledge.utils.ts`
- `JlptCoverageChart` - five stacked bars (N5 at top → N1), each showing mastered / in-progress / untouched against that level's total, off `index/jlpt.json`. "Mastered" uses `isVocabFullyMastered` so the split matches the scheduler's definition rather than reimplementing it. Rendering (headline, legend, bars, `<details>` table) lives in a shared `JlptCoverageBars` component (`pages/stats/components/JlptCoverageBars.tsx`, issue #32 follow-up) taking `rows: JlptLevelRow[]` + an `itemLabel` string - `JlptCoverageChart` only computes `rows` from vocab-shaped data (`learningQueue` + `isVocabFullyMastered`). One hue in two steps (solid accent + 35% accent) rather than two hues, since the segments are ordinal stages and the design system reserves the secondary accent for errors; a legend and direct `n / total` labels carry the distinction so it never rests on color alone
- `GrammarJlptCoverageChart` (issue #32 follow-up) - grammar's equivalent, same `JlptCoverageBars` renderer, computing `rows` from `grammarQueue` + `grammar/index/jlpt.json` (`GrammarService.loadJlptIndex()`) + `isGrammarFullyMastered` instead. Kept as a separate component rather than folded into `JlptCoverageChart` since the index shape (no `containedKanji`) and mastery predicate (no `settings` param) genuinely differ between the two activities - only the bar/legend/table rendering is shared
- `DailyProgressionChart` - per-day review activity (correct/incorrect), last 14 days, built on the shared `buildDailyActivity` helper (`utils/activity.utils.ts`) also used by the Main hub's `DailyActivityCard`. Since issue #32's follow-up, `buildDailyActivity` folds in `entry.history` off `grammarQueue` alongside `reading.history`/`meaning.history` off `learningQueue`, so both this chart and the daily activity card reflect grammar reviews too, not just vocab ones - there is no separate grammar-only variant
- `ReviewForecast` - upcoming review load
- `SmartVocabList` - searchable/sortable/paginated vocabulary list. Fully-mastered items are **hidden by default** (via `isVocabFullyMastered`) behind a "Show mastered (N)" checkbox; search/sort/page/showMastered all persist in `sessionStorage` so returning from a vocab detail page restores the list
- `SmartGrammarList` (`pages/stats/components/SmartGrammarList.tsx`, issue #32 follow-up) - grammar's equivalent, same interaction model (search, sort, paginate, "Show mastered (N)" hidden by default via `isGrammarFullyMastered`, `sessionStorage`-persisted controls under a separate key) driven by `grammarQueue` instead of `learningQueue`. Simpler than `SmartVocabList` since a `GrammarProgress` has one `SRSEntry` (no reading/meaning split) and grammar has no frequency data to sort by (JLPT level stands in for that column instead). Renders `GrammarCard` (`components/GrammarCard.tsx`, mirrors `VocabCard.tsx`) for loaded rows and reuses `VocabCardSkeleton` (`components/VocabCardLoader.tsx`) as the loading placeholder - purely generic gray-bar filler, not vocab-specific despite the name, so not worth a duplicate. Each row navigates to `/grammar/:grammarId`

---

## gokan-dictionary App

`apps/gokan-dictionary` is a separate, standalone Svelte + Vite app (own `package.json`, own tests) implementing [issue #19](https://github.com/gokan-dev/gokan-srs/issues/19): SEO-crawlable static pages for every kanji and vocabulary entry in the compiled dataset, for visitors who just want to look something up without going through gokan-srs's setup flow. It shares no code or runtime with gokan-srs beyond the duplicated model files (see Project Structure) and the dataset submodule both consume - no gokan-srs UI, routing, or quiz logic is reachable from it. Covers kanji, vocabulary, and grammar.

### Deployment and the base path

The dictionary is served as a **subfolder of the gokan-srs site**, at `gokan-srs.com/dictionary/`, not as its own subdomain. With no established domain authority yet, consolidating every link and ranking signal onto one hostname is worth more than the operational tidiness of a separate host, and the dictionary's whole purpose is to accumulate authority that also lifts the app.

- `src/lib/site.ts` owns both `SITE_ORIGIN` and `BASE_PATH` (default `/dictionary`). Setting `VITE_BASE_PATH=''` builds for a bare origin instead, which is the only source change a move to a subdomain would need. Both are read via `import.meta.env`, **not** `process.env`: Vite statically replaces `VITE_`-prefixed reads in the client bundle (`src/client/search.ts` reaches `site.ts` through `urls.ts`), while Bun resolves the same expression at prerender time, so one declaration serves both contexts without a `typeof process` guard.
- `BASE_PATH` affects **generated URLs only, never the on-disk layout** under `dist/`. `prerender.ts` still writes `dist/vocab/{id}/index.html`; the prefix is supplied by the deploy step, which syncs `dist/` into the `dictionary/` key prefix of the app's S3 bucket. Everything that builds an href, canonical, or sitemap entry goes through `src/lib/urls.ts` so the two can never disagree.
- **No `robots.txt` is generated in subfolder mode** (`sitemap.ts`'s `shouldEmitRobotsTxt()`). Crawlers only ever fetch `robots.txt` from a host root, so a file at `/dictionary/robots.txt` would never be read by anything. `apps/gokan-srs/public/robots.txt` is the authoritative file for the whole host and declares both sitemaps.
- Both apps deploy from **one shared workflow** (`.github/workflows/deploy-site.yml`) - see Build & Development below for why, and for the `--delete` hazard that shared bucket creates.

### Static generation model

There is no client-side router or SSR framework (SvelteKit, Next.js, etc.) - the resolved decision on issue #19 was "build-time pre-rendering... kept deliberately lightweight". Every page is a plain static `index.html` file, generated once at build time by `scripts/prerender.ts` and served by any static host with no server runtime.

- `scripts/svelte-ssr-loader.ts` registers a Bun runtime plugin that compiles `.svelte` files with `svelte/compiler`'s `generate: 'server'` mode directly - independent of the Vite build entirely, since Svelte's own `svelte/server` `render()` only turns a component into an HTML *fragment*, and normally you'd reach that via a framework's build integration. This runs standalone via Bun (not `vite build --ssr`) so `bun run scripts/prerender.ts` can directly `import()` the page components after the plugin registers - it must be imported for its side effect *before* any `.svelte` import, so those imports are dynamic (`await import(...)`), never static top-of-file ones.
- `scripts/prerender.ts` (the actual generator): resolves the compiled dataset (via `dataset.server.ts`, auto-initializing the `gokan-dataset` submodule if it hasn't been checked out - see Dataset Consumption below), renders the page components in `src/pages/` per entry with `svelte/server`'s `render()`, wraps each fragment in a full HTML document via `documentShell.ts` (SEO meta, canonical link, JSON-LD, asset links), and writes `dist/vocab/{id}/index.html`, `dist/kanji/{character}/index.html`, `dist/grammar/{id}/index.html`, the browse indexes (`dist/vocab/index.html`, `dist/vocab/jlpt-n{5..1}/index.html`, `dist/kanji/index.html`, `dist/grammar/index.html`), `dist/index.html`, `dist/sitemap.xml`, and `dist/data/search.json`. Generates 35,814 vocab + 2,300 kanji + 755 grammar pages + 8 index pages (38,878 sitemap URLs) in about 80 seconds locally.
  - **Kanji directory names are the raw UTF-8 character, never percent-encoded** - static hosts decode a request URL's percent-escapes before resolving a file on disk, so writing `dist/kanji/%E6%80%9D/` instead of `dist/kanji/思/` would break navigation from a real percent-encoded href like `/kanji/%E6%80%9D/`. `urls.ts`'s `kanjiPath()` percent-encodes for embedding in href/canonical/sitemap strings; the filesystem write path uses the raw character directly. Verified against Vite's own preview server - both URL forms resolve to the identical file.
  - Cross-page links (a word's kanji breakdown, "used in"/"made of" related words, a kanji's vocab list) are resolved through a one-pass `Map<id, VocabSummary>` built by `vocabSummary.ts` before the main per-page loop, rather than re-reading each referenced vocab file on demand - keeps memory bounded to lightweight summaries instead of every full parsed `Vocabulary` object, while still avoiding N+1 re-reads for popular vocab referenced from many kanji pages. A kanji's vocab list is capped at 50 entries (with a "Showing N of total" note) since some common kanji appear in 100+ words. Components/parents ids that don't resolve to a summary (e.g. stale references) are dropped from the page rather than failing the build, with a single aggregate warning logged - not treated as the kind of fatal data-integrity error gokan-srs's own Error Handling policy describes, since this is a best-effort batch generator over ~38k pages, not an interactive app serving one user's data.
  - **Grammar pages** blank nothing and hide nothing (unlike the SRS's `GrammarQuizCard`): they show `title`, `romaji`, `formation`, both explanations, `usageNote`/`formalityLevel` when present, and every example. This is a study/reference page, not a recall test, so there is no answer to leak. Example sentences render **word-by-word** rather than as `example.jp`, so every word the dataset resolved to a `vocabId` becomes a link to its vocab page - this is what makes the ~36k vocab pages reachable by a crawler at all, and it relies on the dataset's guarantee that concatenating every word's `surface` reconstructs `jp` exactly. A point's `family.relatedPoints` render as a related-points card using `family.name` as the header, mirroring the SRS's `GrammarRelatedPointsCard`.
  - **`dist/grammar/index.html` is a real page, not a redirect**: it lists all 755 points grouped by JLPT level (N5 first). It exists as its own page rather than 755 links on the home page so every grammar page sits at **crawl depth 2** from the site root instead of being reachable only through the sitemap - orphan pages (sitemap-listed but linked from nowhere) are consistently indexed worse. It is also a plausible ranking target in its own right for "JLPT N5 grammar list"-shaped queries.
- `vite.config.ts`'s only production-relevant job is building the two browser-facing assets every static page links to: the global stylesheet (`src/app.css`) and the search script (`src/client/search.ts`), listed as explicit `build.rollupOptions.input` entries so Vite content-hashes and manifests them (`dist/.vite/manifest.json`, read by `prerender.ts`). `index.html`/`App.svelte` are a `vite dev`-only placeholder explaining the static-generation model - there's no production SPA shell for them to belong to.
- Page components (`src/pages/*.svelte`) deliberately have **no `<style>` blocks**: component CSS extraction cannot work for components compiled outside Vite's own module graph (see the SSR loader above). Styling instead lives in `src/styles/`, as SCSS, split one stylesheet per page type. See Styling conventions below.

### Styling conventions

**SCSS, split per page, no duplication.** These are project guidelines, not incidental structure.

```
src/styles/
├── _tokens.scss              # variables + mixins ONLY, emits no CSS
├── app.scss                  # :root theme tokens + every rule shared by 2+ page types
└── pages/
    ├── home.scss             kanji.scss        grammar.scss
    ├── vocab.scss            kanji-index.scss  grammar-index.scss
```

Every page links `app.scss` plus, if it has one, its own page stylesheet (`documentShell.ts`'s `pageStylesheetHref`). The vocabulary hub and the JLPT list pages are built entirely from shared rules and link nothing extra.

**Why per page, beyond tidiness:** the stylesheet's content hash is embedded in every page's `<link>`, so a rule added to `app.scss` changes the bytes of all ~38k pages and re-uploads the entire site (see Deployment). A rule added to `pages/vocab.scss` re-uploads only the vocab pages. Keeping a rule shared when only one page uses it silently taxes every future deploy.

**Where a rule belongs:** in `app.scss` only if two or more page types genuinely use it. If two pages look similar because they copied each other, fix the duplication rather than promoting the copy.

**`_tokens.scss` emits no CSS.** It holds only Sass variables and mixins, so the seven stylesheets that `@use` it do not each ship a copy of its output. Two kinds of token live there, and the split is deliberate:
- **Sass variables** (`$space-2`, `$bp-wide`, `$font-mincho`) for values needed at *build* time. Media query conditions are the load-bearing case: a CSS custom property cannot be used in one, so a breakpoint must be a Sass variable or it gets retyped in every file that responds to it.
- **CSS custom properties** (`--accent`, `--surface`) for values that must change at *runtime*. The dark theme swaps them under `prefers-color-scheme`, which build-time variables cannot express. They are declared once, in `app.scss`'s `:root`.

**TypeScript everywhere, always typed.** No `.js`/`.jsx` files anywhere in this app, and no implicit `any`. `bun run --cwd apps/gokan-dictionary typecheck` (svelte-check) must report 0 errors and 0 warnings; it covers `.svelte` files as well as `.ts`.

### Browse indexes and internal linking

Four index pages exist so that **every** page type has a short path from the site root, rather than being reachable only through the sitemap. Orphan pages (sitemap-listed, linked from nowhere) are consistently indexed worse, and this is also simply how a reader browses a dictionary.

- `dist/index.html` (home) routes rather than duplicating search: the box is in the header on every page, so a second large one here would be redundant. It carries the three browse tiles (vocabulary / kanji / grammar), JLPT quick links, a short list of common words as a concrete entry point, and the dataset/SRS attribution.
- `dist/kanji/index.html` lists all 2,300 kanji as a glyph grid grouped by JLPT level (with an "Outside the JLPT lists" group for the 285 that carry none). Before it existed, kanji pages were linked only from whichever vocab pages happened to contain them, which left the rarer characters effectively orphaned.
- `dist/vocab/index.html` is a hub linking one page per JLPT level, and `dist/vocab/jlpt-n{5..1}/index.html` lists that level's words, frequency-ordered. Split per level rather than one page for everything because only ~6,400 of the ~36,000 entries carry a JLPT level at all, and even those would make a single page unreasonably long. The other ~30,000 stay reachable through search, through the kanji pages that contain them, and through example sentences. `jlpt-n5` and friends cannot collide with a vocab id, which is always numeric.
- `dist/grammar/index.html` lists all 755 points grouped by JLPT level (see the grammar note above).

**Example sentences are the largest source of internal links.** On grammar pages this comes from `GrammarExample.words[]`, a full build-time tokenization. On vocab pages it comes from a different shape: the compiled dataset gives each sentence a `matches` map of `vocabId -> [{start, length, reading}]` offsets into `original`, covering every vocab the sentence contains (commonly 5-15, not just the word the sentence is filed under). `lib/sentenceSegments.ts`'s `segmentSentence()` turns those offsets into alternating plain/linked runs - the static equivalent of gokan-srs's `InteractiveSentence` component. Overlapping matches are resolved by earliest-start-then-longest, skipping anything beginning before the previous match ended, and out-of-range offsets are dropped rather than allowed to truncate the sentence; the unit tests assert that re-joining the segments always reproduces the original text exactly.

### Vocab page layout

The vocab page is a two-column layout on wide viewports (`.entry-layout`, collapsing to one column below 56rem), split by importance rather than convenience. The **definition and example sentences** stay in the primary column because they are what the page is for; the relationship lists (kanji breakdown, "made of", "used in") are navigation aids and move to the aside. The word's leading glosses are lifted into the page header directly beneath the word itself (`.entry-gloss`), so a reader who searched for the word gets their answer immediately.

This replaced a layout of five identical full-width cards stacked vertically, which gave a word's meaning exactly the same visual weight as the list of words it happens to appear inside, buried the definition below the fold, and pushed the example sentences far down the page.

### Client-side interactivity

Two client scripts, and nothing else: the site-wide search box, and the grammar browser.

**The grammar browser** (`src/pages/GrammarBrowser.svelte` + `src/client/grammarBrowser.ts`) is the only Svelte component compiled for the *browser* rather than server-rendered, which is why it is a Vite rollup entry rather than something `prerender.ts` touches. It is written with Svelte 5 runes (`$props`/`$state`/`$derived`): filtering 755 rows across a query, three filter groups and two grouping modes is derived state, and runes express it directly instead of recomputing groups by hand.

It uses `mount()`, **not** `hydrate()`. `GrammarIndexPage.svelte` server-renders the complete list (family-grouped, all 755 points linked), and the client script fetches `data/grammar-browse.json` and mounts the interactive component over it, removing the static list. Because the static markup is a *fallback* rather than the same tree the component would produce, there is no hydration contract to satisfy and no mismatch to get wrong; if the fetch or the script fails, the static list simply stays and the page still works. Crawlers and no-JS readers get the full list either way.

`src/lib/grammarBrowse.ts` holds the row shape plus `filterRows`/`groupRows`, kept out of the component so the logic deciding what a reader sees is unit-testable without mounting anything. Search covers the family *name* as well as each point's own fields, which is the main thing making 755 points navigable: no individual point contains the word "contradiction", but that is what someone looking for でも/しかし/けれど types.

**The search box** lives in the shared header (`SiteHeader.svelte`) and is therefore present on **every** page, mirroring gokan-srs's own always-available `SearchBar` - looking a word up is the whole point of the site, so it should never cost a trip back to the home page. It's plain DOM/TS progressive enhancement in `src/client/search.ts`, not a hydrated Svelte island: fetches `/data/search.json` (copied from the compiled dataset's `index/search.json`, ~3MB) lazily on **first focus**, so pages that are never searched from pay nothing for it, then filters and ranks client-side, debounced. Results render into a panel that overlays the page (absolute-positioned) rather than pushing content down, with arrow-key navigation, Escape to close, and outside-click to dismiss. Enter with nothing highlighted deliberately does nothing, so a stray Enter never navigates somewhere the user did not choose.

`scoreEntry()` ranks results rather than returning them in index order. This matters more than it sounds: a bare substring filter over ~36k entries buried the obvious answer, so typing a common kanji returned the compounds containing it ahead of the word itself. Exact written-form/reading hits outrank prefix hits, which outrank substrings; Japanese fields outrank the English gloss (someone typing kana wants that word, not every definition mentioning it); an exact *sense* within the gloss ("to think") outranks a mention buried in a longer definition; and shorter entries break ties as a cheap proxy for "more basic word", since the compact search index carries no frequency data. `matches()`/`scoreEntry()`/`filterEntries()` are pure and unit-tested; the DOM wiring (`init()`) is thin glue and untested, consistent with this repo's general pure-logic/thin-glue testing split.

### Dataset consumption

Reads the same `gokan-dataset` submodule as gokan-srs (see gokan-srs's Dataset Consumption section above), but resolved independently: `src/lib/dataset.server.ts`'s `resolveCompiledDir()` walks up to the shared `apps/gokan-srs/dataset/compiled` path and auto-runs `git submodule update --init` if it's missing, since gokan-dictionary's own CI (`ci-gokan-dictionary.yml`) does not check out submodules (`submodules: true` was gokan-srs's own deploy workflow's fix, and editing workflow files is out of scope for automated changes here) - this is the one remaining place that can fetch it before a build needs real data. Node-only (`node:fs`/`node:child_process`) and never imported from a `.svelte` component - see that file's own header comment. `src/models/*.ts` are a second, independent copy of the same 5 shared model files gokan-srs has (see that repo's Project Structure note), trimmed to what this app actually reads (no `VocabProgress`/`SRSEntry`/learning-order fields) plus `isCommon`, a field the compiled dataset always emits that gokan-srs's own copy of `Vocabulary` still omits.

### Tests

Vitest, same as gokan-srs. Pure logic is unit-tested directly; `scripts/prerender.ts` and `scripts/svelte-ssr-loader.ts` themselves are thin I/O orchestration and are not unit-tested - verified instead by actually running `bun run build` against the real dataset and inspecting `dist/` output plus a full in-browser QA pass (search → vocab page → kanji page navigation, screenshots, zero console errors).

- `src/lib/dataset.server.test.ts` - loader tests against small fixture files under `src/lib/__fixtures__/compiled/` (not the real ~1.1GB submodule checkout).
- `src/lib/urls.test.ts`, `seo.test.ts`, `documentShell.test.ts`, `vocabSummary.test.ts`, `sitemap.test.ts`, `sentenceSegments.test.ts`, `deployManifest.test.ts`, `grammarBrowse.test.ts` - pure helper tests. `grammarBrowse.test.ts` covers the grammar browser's filtering and grouping (including that searching a family *name* finds its members, and that both grouping modes show the same total). `deployManifest.test.ts` covers the deploy diff (see Deployment above), including the `--size-only` regression it exists to prevent: a stylesheet hash change must re-upload every page that embeds it. `sentenceSegments.test.ts`'s load-bearing assertion is that re-joining the emitted segments reproduces the sentence exactly, across overlapping matches, same-offset matches, and out-of-range offsets: a segmentation bug there would silently drop or duplicate text inside example sentences on ~36k pages. The URL tests interpolate `BASE_PATH` rather than hardcoding `/dictionary`, so flipping the env var for a subdomain build doesn't turn every assertion into a false failure: the invariant under test is "every path carries the base prefix exactly once". `absoluteUrl` has an explicit regression guard for resolving against the bare origin rather than `SITE_URL` (resolving an absolute path against a base that itself has a path silently drops that path, which would emit canonicals missing `/dictionary`).
- `src/client/search.test.ts` - `matches()`/`filterEntries()` only (DOM wiring untested).

---

## Build & Development

### Commands

Run from the **monorepo root** (`bun install` there installs deps for every workspace app). The root `package.json` proxies the common `gokan-srs` commands directly; anything else runs via `--cwd apps/gokan-srs` (or `--cwd apps/gokan-dictionary`).

**Development:**
```bash
bun run dev                              # Start gokan-srs dev server (Vite)
bun run typecheck                        # gokan-srs TypeScript type checking
bun run lint                             # gokan-srs ESLint
bun run dictionary:dev                   # Start gokan-dictionary dev server
```

**Build:**
```bash
bun run build                            # gokan-srs production build
bun run --cwd apps/gokan-srs preview     # Preview gokan-srs production build
bun run dictionary:build                 # gokan-dictionary production build
```

**Testing:**
```bash
bun run test                             # Run all gokan-srs tests (Vitest)
bun run --cwd apps/gokan-srs test:watch  # Run gokan-srs tests in watch mode
bun run --cwd apps/gokan-dictionary test # Run gokan-dictionary tests
```

### Deployment

Both apps ship to one environment from **one reusable workflow**, `.github/workflows/deploy-site.yml`, called by `deploy.yml` (production, gated on both test suites) and `deploy-staging.yml` (staging, on any `*-rc*` tag or a manual dispatch of any ref, deliberately ungated). gokan-srs lands at the bucket root; gokan-dictionary lands under the `dictionary/` key prefix, matching the `/dictionary/*` CloudFront behavior in `apps/gokan-srs/terraform/`.

**One workflow, not one per app**: both apps read the same compiled dataset from the same submodule checkout, so a single checkout guarantees they ship from one dataset version. Two workflows could deploy the app from one commit and the dictionary from another, leaving an environment serving two apps built off different datasets. **One workflow, not one per environment**: staging and production would otherwise hold two copies of this logic and drift the same way, one level up. Callers pass only what differs (bucket, distribution, origin).

> [!WARNING]
> **`--exclude "dictionary/*"` on gokan-srs's `--delete` sync pass is load-bearing.** `aws s3 sync --delete` removes everything in the destination absent from the source, and the dictionary lives under that prefix in the *same* bucket. Without the exclude, every app deploy would prune all ~39k dictionary pages and still report success. (The exclude works precisely because `aws s3 sync` applies its filters to the destination listing as well as the source: an excluded destination key is skipped for deletion, not treated as absent.)

**The dictionary does not use `aws s3 sync` at all.** It is deployed by `apps/gokan-dictionary/scripts/deploy-s3.ts`, which hashes every built file, compares against a manifest stored at `dictionary/.build-manifest.json`, and uploads only what differs.

The reason is that `aws s3 sync`'s default comparison uploads a file whose local mtime is newer than the S3 object's, and CI rebuilds from a fresh checkout every run: every one of the ~38k generated pages looked new on every deploy, so even a deploy touching only the SRS app re-uploaded the entire dictionary, roughly 20 minutes each time. A dataset change touching 200 entries now uploads 200 pages.

> [!IMPORTANT]
> **`--size-only` is not a safe substitute, and this is the trap worth remembering.** Asset filenames are content-hashed to a fixed length, so `styles-AAAAAAAA.css` and `styles-BBBBBBBB.css` are the same number of bytes: a CSS-only change produces page HTML of *identical byte length*. `--size-only` would skip all ~38k pages, leaving every one of them pointing at a stylesheet filename that the same deploy just pruned. Comparing content hashes handles this correctly by construction, since a page embedding a new asset name has different content. `deployManifest.test.ts` carries this as an explicit regression case.

This approach depends on the build being reproducible, which it is: two consecutive full rebuilds of `dist/` produce byte-for-byte identical output across all 38,885 files, so a rebuild with no source or dataset change yields zero uploads. If a future change introduces a timestamp, a build id, or any other nondeterminism into the generated HTML, this optimization silently degrades back to re-uploading everything.

Operational details worth knowing:
- The manifest is uploaded **last**, only after every upload and delete has succeeded. An interrupted deploy therefore leaves the previous manifest in place and the next run redoes the work, rather than believing files it never uploaded are present.
- A missing or unreadable manifest (first deploy to a bucket) falls back to uploading everything.
- Changed files are hardlinked into a staging tree (`.deploy-stage/`) so one recursive CLI upload moves exactly the intended set; per-file `aws` invocations would take hours on a full run.
- Cache-control is applied per file class, same as the old three passes: HTML always revalidates, `data/search.json` and `sitemap.xml` get a 1-hour TTL, everything else is immutable for a year.
- The manifest lives under `dictionary/` so gokan-srs's root `--delete` pass cannot prune it.
- `--dry-run` reports what would be uploaded and deleted without touching S3.

Environment-specific details worth knowing:

- `VITE_SITE_ORIGIN` is passed per environment, so staging emits staging canonicals rather than claiming to be production.
- `NODE_ENV: production` is set **inside** `deploy-site.yml`, because a called workflow does not inherit the caller's `env` and `apps/gokan-srs/vite.config.ts` keys off it to skip the `vite-plugin-checker` pass.
- Staging's CloudFront distribution attaches an `X-Robots-Tag: noindex, nofollow` response headers policy to the whole site. `staging.gokan-srs.com` serves the same built `robots.txt` as production, so `robots.txt` alone cannot keep crawlers out, and a second complete crawlable copy of ~39k pages would compete with production for the same content.
- Two unhashed dictionary files (`data/search.json`, `sitemap.xml`) are re-uploaded with a 1-hour TTL after the immutable pass, so a dataset change actually reaches search and crawlers.

**CloudFront directory-index rewrite**: the `/dictionary/*` behavior carries a CloudFront Function that appends `index.html` to directory-style URLs. This is load-bearing, not cosmetic. The dictionary emits one `<path>/index.html` per entry, and the OAC origin reaches S3 through the **REST** endpoint, which - unlike the S3 *website* endpoint - performs no directory-index resolution. Without the rewrite, `/dictionary/vocab/1589350/` looks up a key that does not exist, 404s, and is swallowed by the SPA `custom_error_response`, so every dictionary page would quietly serve the SRS app. `default_root_object` does not cover this; it only applies to `/`.

**Known limitation**: `custom_error_response` is distribution-wide in CloudFront, so a genuinely missing `/dictionary/*` URL still returns the SPA shell with a 200 (a soft 404). Every dictionary URL is generated and sitemap-listed, so this should only be reachable through a stale link after a dataset change. Fixing it properly means moving the SPA fallback off `custom_error_response` and into a function on the default behavior, a riskier change to live app routing than the problem currently warrants.

**Dataset** (delegates into the `gokan-dataset` submodule - see below):
```bash
bun run dataset:sync                      # Copy dataset/compiled/ -> public/data/compiled/ (also runs automatically before dev/build)
bun run dataset:build                     # Regenerate the dataset from raw sources, then sync (~1-2 min)
bun run --cwd apps/gokan-srs build:kanji  # Compile KKLC kanji only (delegates into the submodule)
bun run --cwd apps/gokan-srs build:jlpt   # Rebuild only index/jlpt.json (delegates into the submodule)
bun run --cwd apps/gokan-srs build:grammar # Rebuild compiled/grammar/ from the vendored hanabira snapshot (delegates into the submodule; see Grammar Dataset below)
```

### Dataset Consumption

The compiled dataset (kanji/vocab/sentences/indexes) is **not owned by this repo**. It lives in the separate [`gokan-dataset`](https://github.com/gokan-dev/gokan-dataset) repo - raw sources, the build pipeline (Kuromoji tokenization, JMDict/KKLC/JPDB/JLPT processing), and the compiled output all live there, documented for third-party consumption independent of this app in that repo's `docs/SCHEMA.md`.

`gokan-srs` consumes it as a **git submodule** at `apps/gokan-srs/dataset/` (a public repo, so CI needs no extra credentials to check it out - `submodules: true` on `actions/checkout` is sufficient):

- `apps/gokan-srs/scripts/sync-dataset.ts` copies `dataset/compiled/` → `public/data/compiled/` via a plain `fs.cpSync` - no transformation, since both sides agree on the shape. This runs automatically before `dev` and `build` (chained in `package.json`'s scripts), so `public/data/compiled/` is **no longer committed** to this repo (`.gitignore`'d) - it's purely a synced build artifact, regenerated on demand.
- `apps/gokan-srs/package.json`'s `build:data`/`build:kanji`/`build:jlpt`/`build:jpdb` scripts delegate into the submodule (`bun --cwd dataset build:data`, no `run` keyword - `bun --cwd <dir> run <script>` doesn't reliably execute the script, it's `--cwd`'s own flag scoped to `run`, not a global one composable this way) so the dataset can still be rebuilt from raw sources without leaving the monorepo, then re-sync automatically (`build:data` chains the sync at the end).
- The submodule is **outside** the root workspace glob (`apps/*` only matches direct children of `apps/`), so the root `bun install` does not install its dependencies. Run `bun install --cwd apps/gokan-srs/dataset` once before `build:data`/`build:kanji`/`build:jlpt`/`build:jpdb` will work (not needed for plain `dev`/`build`, which only read the already-committed `compiled/` output via the sync step, never execute anything inside the submodule).
- After cloning fresh, run `git submodule update --init --recursive` (or clone with `--recurse-submodules`) before `bun install`/`bun run dev` - otherwise `sync-dataset.ts` fails fast with a clear error rather than silently serving stale/missing data.
- Vitest's config (`vite.config.ts`) explicitly excludes `dataset/**` from its test glob, since the submodule has its own independent test suite and CI (would otherwise get picked up and double-run as part of `bun run test` here).
- Bumping which `gokan-dataset` commit this repo points to is a normal two-step submodule workflow: commit + push inside `apps/gokan-srs/dataset/` first (a separate repo), then commit the resulting pointer change here.

### Grammar Dataset

The grammar dataset (issue #17) follows the same split as vocab/kanji/sentences: raw source, build pipeline, and compiled output all live in the **`gokan-dataset`** submodule, synced into `public/data/compiled/grammar/` by the normal `sync-dataset.ts` step - there is no `gokan-srs`-side data or build script for it.

- **Source**: [hanabira.org-japanese-content](https://github.com/tristcoil/hanabira.org-japanese-content) (Creative Commons, attribution required - see the credit link on the About page), vendored as a frozen snapshot at `dataset/data/raw/grammar/grammar_ja_{N5,N4,N3,N2,N1}_full_alphabetical_0001.json` (828 grammar points total: N5 136, N4 124, N3 132, N2 191, N1 245). "Vendored snapshot vs. periodic re-sync" was the one ingestion detail issue #17 left open at implementation time; a vendored snapshot was chosen (re-running `build:grammar` against a manually-refreshed `raw/` snapshot is the update path if hanabira's content ever needs a refresh), matching every other raw source in the dataset repo.
- **`dataset/scripts/build-grammar.ts`**: reads the raw JSON, assigns stable ids (`${level}-${index}`, e.g. `"n5-001"` - the upstream dataset has no ids of its own, and since the snapshot is frozen these stay stable across rebuilds), and tokenizes every example sentence to resolve each content word (`名詞`/`動詞`/`形容詞`/`副詞` POS tags only; particles/symbols always stay literal) against the already-compiled `compiled/index/search.json`, capturing each word's `baseForm` (kuromoji's dictionary form) alongside `surface`/`reading`. **Word matching reuses the submodule's own `SentenceTokenizer`** (the same compound/deinflection-aware matcher `build-data.ts` uses for vocab sentences), rather than a lighter grammar-only pass - an earlier design choice (see the removed `[2026-02-28]`-era rationale, now reversed for consistency: every sentence in the app, vocab or grammar, is tokenized identically, so clicking a word behaves and matches the same way in both places). This resolves 42.1% of tokenized words to a vocab id as of the last build (up from 39.5% under the old per-token matcher), since compounds/conjugated forms now merge into one `GrammarExampleWord` (e.g. `通っている` → `通う`, `早かろうが` → `早い`) instead of splitting into unmatched fragments. Needs `build:data` to have run first (so `compiled/index/search.json` exists); not chained into `build:data` itself, since it's a small, independently-runnable pass, not another walk over the full sentence corpus.
- **`dataset/scripts/grammar-pattern-matcher.ts`**: for each example, matches `formation`'s literal Japanese against `words[]` (surface, `baseForm`, and reading, trying multiple formation-alternative variants and multi-token spans) to precompute `patternWordIndices` - which words are the point's literal grammar-pattern markers, as opposed to vocabulary filling its slots. Runs at build time specifically so `gokan-srs` never has to re-derive this at runtime; 99.9% of points have it located in at least one example as of the last build (one documented exception - see `gokan-dataset`'s pattern-location issue for the full methodology and the exception's rationale). Because `SentenceTokenizer`'s merging (above) can absorb a formation's literal marker into the middle of a merged conjugated word, `build-grammar.ts` runs `locatePattern` against a separate, fine-grained one-word-per-kuromoji-token array (never exposed in the compiled output) and maps the result back onto the merged `words[]` actually shipped - this is what keeps the 99.9%/98.1% pattern-location rate exactly at its pre-merge baseline despite the word-matching upgrade.
- **Output**: `compiled/grammar/points/{id}.json` (one `GrammarPoint` per file, mirroring `vocab/{id}.json`) and `compiled/grammar/index/jlpt.json` (level → ordered id list, mirroring `index/jlpt.json`'s shape). Synced into `public/data/compiled/grammar/` exactly like vocab/kanji/sentences - gitignored in `gokan-srs`, regenerated on demand.
- **History**: the initial issue #17 implementation vendored this data directly into `gokan-srs` instead, because the autonomous agent's per-repo GitHub App installation token only had push access to `gokan-srs`, not the separate `gokan-dataset` repo - it had no way to open a PR there itself. Fixed by moving the raw data, build script, and compiled output into `gokan-dataset` (PR opened and merged by a maintainer working across both repos) and repointing `gokan-srs` at the updated submodule commit, consuming the output the same way as every other dataset. If a future agent needs to add data to `gokan-dataset`, it needs credentials scoped to that repo too (a broader GitHub App token or a PAT) - this hasn't been set up, so cross-repo dataset changes currently need a human/maintainer step.

### Test Infrastructure

**Test Framework**: Vitest

**Test Files:**
- `src/services/srs.service.test.ts` - SRS algorithm unit tests
  - Formula verification tests (8 test cases covering different scenarios)
  - Minor error classification tests (Levenshtein distance validation)
  - Alternative reading matching tests
  - Per-quiz-type retry flag behavior tests
  - A correct reading answer no longer pushes a due meaning's `dueDate` forward (regression guard for the removed stagger - see State Management → Session quiz cap)
  - Meaning-quiz-disabled scheduling tests (graduation on reading mastery alone)
  - JLPT learning-order tests: N5→N1 walk order, kanji filtering on by default (and disabled via `ignoreKnownKanjiRequirement`), already-queued exclusion, frequency fallback once the lists run dry (without re-serving a JLPT word, and respecting the same toggle), and the matching `countLearnableVocabulary` counts
- `src/services/scheduling.test.ts` - `vocabNextReviewAt`/`isVocabFullyMastered`/`isVocabDue` unit tests
- `src/services/grammarScheduling.test.ts` - `grammarNextReviewAt`/`isGrammarFullyMastered`/`isGrammarDue` unit tests (grammar's single-entry equivalent)
- `src/services/grammarSrs.service.test.ts` - `GrammarSRSService` tests: intro choice (learn/skip), `applyAnswer` (correct/wrong/retry/graduation, mirroring vocab's retry-is-training-only invariant; a reduced `strengthDeltaModifier` earning a smaller-but-positive gain than a full one), `applyVocabReinforcement` (boosts a credited word's reading entry, leaves other words reference-equal, never touches the meaning entry, no-op on empty credits or a word absent from the queue), and JLPT-order candidate finding/counting
- `src/services/migration.service.test.ts` - Data migration tests
  - Old format (mastery) to new format (memoryStrength/interval) conversion
  - Edge cases (mastery 0, mastery 100)
  - Idempotency (already-migrated data not re-migrated)
  - Real production data samples
  - `needsRetry` boolean→object normalization
  - Two-tier version regression guards (sync pass never pre-empts the async pass)
  - `grammarQueue` defaulting to `[]` when absent, defaults filled into a partial `GrammarProgress` item, and a graduated item's `nextReviewAt` staying `null` rather than re-deriving from a stale `dueDate`
- `src/services/migration.roundtrip.test.ts` - Golden round-trip test: a realistic snapshot spanning old/mixed/current-format items pushed through the full migrate→hydrate→serialize→reparse pipeline, asserting zero data loss (no vocab dropped, no history lost, no due date nulled)
- `src/context/quiz/quizReducer.test.ts` - Reducer unit tests (every action, including `RECONCILE_REMOTE`, `SESSION_START`/`SESSION_END`, and `VOCAB_INTRO_CHOICE` extending the session's committed task set on "Learn")
- `src/context/quiz/quizSelectors.test.ts` - `selectNextView` across all session states + the meaning-disabled edge case, `selectCurrentProgress`, `selectCurrentSentence`, `selectSessionStats` (stable `total`, `done` on de-actioned tasks, the pending-retry regression that no longer shrinks the total, mid-session arrivals counted as `waiting` not total, `moreNew`, and - reflecting the post-dedup commit shape - a reading-only commit resolving `done` by exactly 1 once answered without touching an uncommitted, genuinely-due meaning), `selectNextSessionPreview` (mutually exclusive buckets, retries taking precedence over new/review, meaning-disabled ignoring meaning due dates, graduated vocab excluded, at most one card per word across all three quiz types, cap overflow reporting, and that the preview matches what the session's dedup+cap pipeline actually commits to), `dedupTaskKeysByVocab` (priority order, multi-vocab independence, input-order preservation, empty input), and a cross-session regression test asserting a vocab with reading+meaning both due commits only reading one session and meaning the next (once reading is no longer due)
- `src/context/quiz/grammarReducer.test.ts` - Reducer unit tests for every `GRAMMAR_` action (load lifecycle, set/submit answer, update-after-answer plus its optional `grammarSessionHistory` push, advance queue, `GRAMMAR_SESSION_START`/`GRAMMAR_SESSION_END`, intro choice's learn/skip/detail-page-insert paths including the "learn" path extending `grammarSession.committed`), dispatched through the shared `quizReducer`
- `src/context/quiz/grammarSelectors.test.ts` - `selectNextGrammarView` across all session states + `shouldShowIntro`; `computeBlankPlan` (blanks only known vocab, accept-list construction including a failed-fetch fallback and vocab writtenForm/reading/mergedVocabs variants, gloss resolution, a queued-but-never-introduced vocab entry does not count as known, preferring a different example with a known word over an example with none - issue #32 item 5.1, the single-most-frequent-word fallback when nothing is known anywhere - item 5.2, skipping a zero-candidate example in favor of another in the same point and the read-only plan when literally none qualify - item 6, deterministic example selection, no-examples edge case); `gradeGrammarAnswers` (kanji/variant/reading forms all grading `correct` against the same accept-list, an unrelated answer grading `wrong`, a revealed (`hintLevel >= 2`) blank always grading `minor_error` regardless of input - RC3 item 3, previously `pass` - the worst-of precedence `wrong > pass > minor_error > correct` on the no-pattern fallback path, including that a literal typed "pass" is still reachable independently of the hint system; and the issue #33 pattern-decides behaviour: pattern-correct + vocab-wrong stays `correct`, pattern-wrong stays `wrong` even with all vocab right, and the `strengthDeltaModifier` floor/linear-scaling by vocab-correct ratio); `computeBlankPlan`'s `isPatternBlank` classification (pattern + secondary-vocab blanks flagged, all-false on the no-pattern fallback); `selectCurrentGrammarProgress`; `selectNextGrammarSessionPreview`; `collectActionableGrammarIds` (due-or-retry inclusion, not-yet-due and graduated exclusion); and `selectGrammarSessionStats` (mirrors `quizSelectors.test.ts`'s `selectSessionStats` coverage - stable `total`, `done` on de-actioned points, `retriesPending`, mid-session arrivals counted as `waiting` not `total`)
- `src/services/sync/mergeProgress.test.ts` - Per-entry merge tests, including the core fix: a device that only reviewed reading can never clobber another device's meaning review; plus `mergeGrammarProgress`/`mergeGrammarQueues` tests and a top-level `mergeProgress` assertion that `grammarQueue` merges as a pure union
- `src/services/sync/driveClient.test.ts` - Drive REST wrapper tests (auth-error translation)
- `src/services/sync/googleDriveSync.test.ts` - CAS retry-on-conflict, duplicate-file reconciliation, write-once remote backup
- `src/utils/knowledge.utils.test.ts` - Knowledge-points model tests: mastery-curve normalisation (a vocab mastered in reading + meaning is worth exactly 200), the interval→strength inversion (including undoing the `wrong`/`minor_error` post-processing multipliers and the frequency modifier), and curve construction (per-day bucketing, pre-window baseline collapsing, skipped-vocab crediting, knowledge loss after a failure, future-dated-log rejection)
- `src/utils/activity.utils.test.ts` - `buildDailyActivity` tests: zeroed buckets with no history, correct/minor_error grouped as correct and wrong as incorrect with pass excluded, reading + meaning history aggregated together, calendar-day bucketing (not exact timestamp), and logs outside the requested window dropped
- `src/utils/grammarSentence.utils.test.ts` - `grammarExampleToSentence` tests: `jp`/`en` carried over unchanged, cumulative-offset match derivation (not a hand-tracked index), particle/unresolved words excluded from `matches`/`vocabIds`, repeated occurrences of the same vocabId accumulating into one match list, and a stable per-example `id`
- Data-pipeline tests (tokenizer/Kuromoji integration, data-integrity checks) now live in the `gokan-dataset` submodule's own test suite, not here - `vite.config.ts` explicitly excludes `dataset/**` so they aren't double-run as part of this repo's `bun run test`.

**CI/CD Integration:**
- GitHub Actions workflow (`.github/workflows/deploy.yml`) includes test stage
- Tests run automatically on push to main branch
- Deployment only proceeds if all tests pass
- Uses Bun as the test runner for consistency with development environment

---

## Functional Workflows

### Learning Queue Logic

The SRS study session follows a **stateless** priority system with natural buffering:

1. **Old Reviews + Retry Items (Priority 1)**:
   - Items with `totalReviews > 0` and `nextReviewAt <= now`
   - Items with `needsRetry === true` (wrong answer in current session)
   - These are mixed randomly together
   - Order: Random selection from the pool (to prevent interference effects)
   - **Reading and meaning quizzes are batched, and the active batch is sticky**: `getNextVocabToStudy(queue, settings, now, preferredType)` takes an optional `preferredType` hint (the `quizType` of the card currently on screen, threaded in by `selectNextView` from `state.currentQuizItem`). While that type still has actionable work, it keeps being served - even if an item of the *other* type becomes actionable mid-batch (a retry flag flipping, or a review simply coming due while the user studies). Only once the active type's pool runs dry does selection fall back to the reading > meaning > production priority. Production is served last because it is the hardest direction and reads better once the word has already been seen in the easier ones this session. Without this, a reading item becoming due partway through a run of meaning quizzes would hijack the very next card - see the `[2026-07-24]` changelog entry for the bug this fixes and `QuizTypeIndicator` (`VocabBaseQuizCard.tsx`) for the accompanying on-screen "Reading"/"Meaning" phase label.

2. **New Intros (Priority 2)**:
   - Items with `introductionAt === null` and `stage !== 'graduated'`
   - When queue runs out of reviewable items, **3 new vocab are introduced at once**
   - All get `nextReviewAt = now` when user chooses "Learn"

3. **First Reviews (Priority 3)**:
   - Items with `totalReviews === 0`, `introductionAt !== null`, and `nextReviewAt <= now`
   - These are introduced vocab that haven't been tested yet
   - Lower priority than new intros ensures buffering

4. **User Actions on Introduction**:
   - **Learn**: Item activates with base memory strength. `nextReviewAt` set to `now` (becomes immediately reviewable)
   - **Skip**: Item is marked as **Fully Mastered** (`maxMemoryStrength`). Stage set to `graduated`. It will not appear in reviews
   - **Mastery**: If `memoryStrength >= maxMemoryStrength` after a review, item graduates. `nextReviewAt` is cleared

5. **Retry Mechanism (Wrong Answers)**:
   - `needsRetry` is **per quiz type** (`{ reading?: boolean; meaning?: boolean; production?: boolean }`): a wrong reading answer sets `needsRetry.reading` and never blocks a due meaning or production review (and vice versa).
   - When user gives wrong answer: `needsRetry.<type> = true` is set. Item review schedule is updated based on the failure.
   - Item appears in current session (mixed with old reviews)
   - On retry attempt:
     - If Correct: `needsRetry.<type> = false`. **SRS state is NOT updated** (training only). Original failure scheduling stands.
     - If Wrong: `needsRetry.<type> = true` (loop until correct). SRS state is NOT updated (prevent double penalty).
   - This ensures retries help user learn correct answer without artificially inflating memory strength after a failure.

6. **Queue Refill**:
   - Triggered automatically in `useQuizOrchestration` when `selectNextView`'s `queueItem` is null and `sessionState` is 'learn'
   - Adds 3 new vocab at once (batch size = 3)
   - Respects daily limits and kanji knowledge constraints

7. **Completion**:
   - Session ends when: No Due Reviews AND (Daily Limit Reached OR No More Learnable Content)

**Natural Flow Example**: 
- Introduce 3 vocab → All 3 get `nextReviewAt = now`
- Priority shows 3 more new intros (if available)
- After 3 more intros, no more new intros available
- System shows 6 pending first reviews
- Pattern: Intro × 3 → Intro × 3 → Quiz × 6 → Intro × 3 → ...
- If wrong answer: Item gets `needsRetry = true` → Appears again in current session

### Session State Computation

Implemented in `quizSelectors.ts` via `selectNextView()` - the single function that also decides the queue item to load and whether to show the intro card (see State Management above):

```typescript
if (hasDueReviews) return 'review'
if (canIntroduceNew && hasLearnableVocab) return 'learn'
if (hasUnlockedKanjiPending) return 'learn-kanji'
if (hasUpcomingReviews) return 'waiting'
return 'exhausted'
```

### Answer Evaluation Flow

1. User types answer (hiragana for reading, english for meaning)
2. `submitAnswer()` called in `QuizContext`
3. Determine `quizType` (`'reading'` | `'meaning'` | `'production'`) and `quizMode` (`'base'` | `'context'`) from `currentQuizItem`
4. Base Evaluation:
   - For **Reading**: `SRSService.evaluateAnswer()` checks against all readings (always `base` mode)
   - For **Production**: the same `SRSService.evaluateAnswer()` call against the same readings - the answer is a reading either way, only the prompt differs (English glosses instead of the written form)
   - For **Meaning (`base` mode)**: `SRSService.evaluateMeaning()` checks strictly against all dictionary glosses
   - For **Meaning (`context` mode)**: First evaluates strictly with `evaluateMeaning()`, then:
     - If `enableGeminiContext` is enabled (the Settings master toggle) AND `geminiApiKey` is configured AND a sentence is available:
       - If `alwaysUseAiForMeaningContext` is `true` (default), AI validates ALL answers (including strict-correct ones)
       - If `alwaysUseAiForMeaningContext` is `false`, AI only validates answers that were strict-wrong or strict-minor_error
       - On AI network error (400, 500, etc.): silently falls back to the strict evaluation result
     - Note: `enableGeminiContext` gating was previously missing from this check - a `geminiApiKey` left over from before the user disabled the feature would silently keep triggering AI calls. Fixed so the toggle is actually authoritative.
5. Feedback shown (correct/incorrect + matched answer + optional AI note)
6. `continueToNext()` applies SRS update via `SRSService.applyAnswer()` passing both `quizType` and `quizMode`. Both `meaning_base` and `meaning_context` update the same `vocab.meaning` SRSEntry internally, but use different `expectedLatency` values (10s vs 15s) for the latency multiplier calculation.

### Grammar Quiz Flow (issue #17, blank-selection/grading revised for issue #32, made pattern-primary for issue #33)

1. `useGrammarOrchestration`'s load effect resolves a `GrammarPoint` and `await`s `computeBlankPlan` for a fixed `{ exampleIndex, blankWordIndices, isPatternBlank, acceptLists, glosses, readOnly }` for this turn - see State Management → Grammar Activity State for the four-pass selection rule (prefer an example with a located grammar pattern, blanking it plus any known vocab as reinforcement; else fall back to known-vocab-only, then a single most-frequent candidate, then read-only)
2. If `readOnly`, the card renders as study material with a Continue-only button and steps 2-4 below don't apply - see Application Pages → Grammar Screen
3. Otherwise, the user types into each blank's discrete input (one per `blankWordIndices` entry, live-sized to what's typed); non-blank words are shown as plain literal text. Each blank also has a "?" hint control (gloss, then reveal - see State Management)
4. `submitGrammarAnswer()` delegates to `gradeGrammarAnswers(blankPlan, answers, hintLevels)`: matches each answer against its blank's accept-list via `SRSService.evaluateAnswer` (a revealed blank always grades `'minor_error'` regardless of input), then decides the grammar point's `overall` result from the **pattern-marker blanks alone** (a missed vocab blank never makes a demonstrated grammar core `wrong`) and returns a `strengthDeltaModifier` scaling the reward by the vocab-correct ratio; it also builds the positive-only `vocabCredits` list. Auto-advance fires only when *every* blank was strictly correct, so a pattern-correct card with a missed vocab blank pauses for review instead of skipping past it. (Fallback examples with no located pattern keep the original worst-of-all grading at full strength.)
5. Feedback shown per-blank (each input's border reflects its own result) plus the combined message; non-correct blanks reveal the accepted form they actually matched
6. `continueGrammarToNext()` applies the combined result (scaled by `strengthDeltaModifier`) to the grammar point's single SRS entry via `GrammarSRSService.applyAnswer()`, applies positive-only vocab credit to the correctly-answered reinforcement words via `GrammarSRSService.applyVocabReinforcement()` (or, for a `readOnly` plan, `GrammarSRSService.deferWithoutCredit()` instead - no grading happened, so no SRS credit), then advances to the next queued grammar point

### Daily Reset Logic

- `stats.newLearnedToday` resets at midnight
- Implemented via `RESET_DAILY_STATS` action
- Triggered by date change detection

---

## Constants & Configuration

### Key Constants (`commons/constants.ts`)

**Knowledge points (`utils/knowledge.utils.ts`):**
- `KNOWLEDGE_POINTS_PER_ENTRY`: 200. **One knowledge point is one mastery point**: `entryKnowledgePoints` returns `calculateMasteryPercentage` unchanged, which already spans 0..200 across the MasteryRing's two visual loops. A fully mastered entry is 200 and a word mastered in reading + meaning is 400.
- The scale is arbitrary, so it is set to the one value that removes every conversion. It was 100 per entry, normalising the 0..200 mastery curve by half, which meant the ring advanced 6, the session ticker printed "+6%" and the session total moved by 3: one quantity, three places, two units, and arithmetic the user could not check by eye. Changing the ring to 0..100 instead would unify equally well but would destroy the deliberate two-loop design, so the scale moved rather than the ring.
- Consequence worth knowing: the Stats knowledge curve's absolute numbers are **twice** what they were. The curve's shape, and every comparison drawn from it, is unchanged.
- Production **counts** in the curve alongside reading and meaning, so a word studied in all three directions is worth 600 and a production answer moves the session total and the curve alike. Its no-history entries are the one asymmetry: see Production quiz rollout.
**SRS Limits:**
- `dailyNewLimit`: 20 new vocab per day
- `newVocabBatchSize`: 3 (introduce three at a time for buffered learning)
- `maxReviewsPerDay`: 150
- `sessionQuizCap`: 200 (maximum quiz tasks one study session commits to; unlike the two per-day limits above, which are effectively disabled, this one is real)
- `production.seedStrengthRatio`: 0.4 (fraction of a word's meaning strength its production entry starts from when activated)
- `production.seedDelayHours`: 24 (delay before the first production review, so it lands outside the session that activated it)
- `production.reinforcementStrengthRatio`: 0.5 (fraction of a full production gain a grammar answer's vocab reinforcement earns; right direction, easier conditions)

**Quiz Timing:**
- `correctAnswerAutoAdvanceDelay`: 1800ms
- `incorrectAnswerRevealDelay`: 400ms

**Storage Keys:**
- `progressStorageKey`: "GOKAN_SRS_PROGRESS"
- `settingsStorageKey`: "GOKAN_SRS_SETTINGS"
- `googleDriveFileName`: "kanji-progress.json"

**Setup Defaults:**
- `defaultKanjiCount`: "10"
- `defaultKanjiLearningMethod`: 'kklc'
- `minimumKanjiCount`: 0
- `maximumKanjiCount`: 2300

---

## Error Handling

### Fatal Errors

**Data Integrity**: If a vocabulary file fails to load, the application must **suspend operation** (Critical Error). Silent skipping is not permitted as it masks fundamental data corruption.

**Error Display**: `App.tsx` checks `state.fatalError` and shows full-screen error with reload button.

**Error Sources:**
- Vocabulary file not found
- Index corruption
- Invalid data format

---

## Modification Log

The detailed, dated modification log lives in [docs/MODIFICATION_LOG.md](docs/MODIFICATION_LOG.md), so this file stays focused on current-state documentation. That file is shared by both `CLAUDE.md` and `GEMINI.md` and is not auto-loaded into agent context: read it on demand when you need the history or reasoning behind a decision.

> [!IMPORTANT]
> **`git log` is the primary record of what changed; the log file is not.** Add a `docs/MODIFICATION_LOG.md` entry only when a change carries reasoning the diff alone does not convey: the result of an investigation, why a non-obvious approach was chosen over the obvious one, or a subtle behavioral interaction a future agent could otherwise reintroduce. Do not log routine, mechanical, or self-evident changes: git history already covers those. When you do add an entry, add it to `docs/MODIFICATION_LOG.md` (once), not here.
