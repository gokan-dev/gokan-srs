# Gokan SRS: Architecture Audit

> Snapshot audit performed 2026-07-18. See the Modification Log in [CLAUDE.md](CLAUDE.md) for
> the remediation work that followed (tracked against this document's findings).

## Verdict up front

The SRS learning *formula* isn't the problem, it's small, well-isolated, and covered by 49 tests.
What's become hard to maintain is everything **around** it: a 1,017-line "god context" that owns
state, side effects, sync, and scheduling all at once; three different places that each decide
"what should the user see next"; and a sync layer that can silently lose data. The complexity is
real but localized, which is good news, it's fixable without rewriting the study algorithm.

The single deepest issue: **there is no one source of truth for scheduling or for session state.**
The same question ("is anything due? what do I show?") is answered by different fields and
different functions that must be kept in agreement by hand.

---

## 1. Codebase map

| Area | File | Size | Health |
|---|---|---|---|
| State + effects + orchestration | `src/context/QuizContext.tsx` | 1017 lines, 11 effects, ~18 actions, 18 console logs | 🔴 hotspot |
| SRS formula (pure) | `src/services/srs.service.ts` | 869 lines | 🟡 good core, some cruft |
| Queue selection | `src/utils/srs.utils.ts` | 144 lines | 🟡 untested |
| Session-state derivation | `src/utils/quiz.utils.ts` | 52 lines | 🟡 untested |
| Drive sync | `src/services/google.service.ts` | 493 lines | 🔴 data-loss vectors |
| Sync ↔ app glue | `src/context/GoogleDriveContext.tsx` | - | 🔴 coupling |
| Migration | `src/services/migration.service.ts` | 273 lines | 🟡 fragile versioning |

**Tests:** 76 total, but distribution is lopsided, SRS formula 49, migration 14, adaptive 7,
intro 3, google 3. **Zero tests for `QuizContext`, `srs.utils`, or `quiz.utils`**, the exact
orchestration layer where bugs live is the only part with no safety net.

**Repo hygiene noise:**
- `apps/` was abandoned monorepo scaffolding (untracked, no real source, ~146k node_modules files), removed.
- `vite.config.js` and `vite.config.ts` were byte-identical duplicates. Vite resolves `.js` first,
  so any edit to `vite.config.ts` was silently ignored, the `.js` was removed.
- 18 `console.log`/`debug` calls in `QuizContext` alone, several inside `useMemo`/render paths.

---

## 2. State management: the core complexity

### A1. Three uncoordinated sources of truth for "what to show next"
The decision of "intro vs review vs nothing" was computed independently in three places that had
to agree but shared no code:
- `nextDue` memo, prioritized `introCandidates`, then `getNextVocabToStudy` (QuizContext.tsx:440)
- `computeSessionView`, derived `sessionState` from `nextReviewAt` (quiz.utils.ts:19)
- `QuizScreen`, decided intro-vs-quiz from `currentProgress.introductionAt`, **not** from `sessionState`

`QuizScreen` only branched on 3 of the 5 `SessionState` values, `'review'` and `'learn'` were
never referenced and silently fell through the same path.

### A2. Dual/triple source of truth for scheduling
Every item carried **three** scheduling fields that had to be manually kept in sync on every
mutation: `VocabProgress.nextReviewAt` (top-level), `reading.dueDate`, `meaning.dueDate`.
`applyAnswer` recomputed `nextReviewAt = min(reading, meaning)` by hand (srs.service.ts:240-256).
Latent bug: disabling meaning quizzes while `meaning.dueDate` was due but `reading.dueDate` wasn't
could strand the UI on a review state with no reviewable item.

### A3. A dead subsystem: the "frozen sessionQueue"
`sessionQueue`, `sessionBuiltAt`, and the actions `BUILD_SESSION_QUEUE` / `SHIFT_SESSION_QUEUE` /
`APPEND_TO_SESSION_QUEUE` existed, were written to, sliced, and appended to, but nothing ever
read `sessionQueue` to decide what to display. The real "next item" was the `nextDue` memo.
`buildSessionQueue` even dispatched `{ queue: [] }` (always empty). This was documented in
CLAUDE.md as the core "Session Orchestration" model but was never actually wired up.

### A4. QuizContext did too much
One component owned: reducer (~18 actions), vocab loading, AI evaluation, SRS application, Google
Drive auto-upload, download-reactivity, migration triggering, daily-reset, and auto-advance timers
(11 `useEffect`s). Several effects keyed off string hacks like
`[state.progress ? 'loaded' : 'loading']` to fake "run once." `continueToNext` called
`SRSService.applyAnswer` **twice** for the same item.

### A5. `needsRetry` was a single boolean the code admitted should be per-type
A comment-essay in srs.service.ts conceded `needsRetry` ought to be `{reading, meaning}` but "for
now" was one flag, skipping *all* SRS updates for a vocab regardless of quiz type when set.

---

## 3. UI / consumer layer

- **Mastery formula implemented twice**, `MasteryRing.tsx` reimplemented the exact log-curve of
  `calculateMasteryPercentage` (srs.utils.ts:121). The visual ring could drift from the numeric
  mastery the engine stores.
- **`SessionProgress.tsx` recomputed session/due/daily-limit bookkeeping from raw state** (~35
  lines), using `CONSTANTS.srs.dailyNewLimit` as a denominator, a concept removed everywhere else
  (set to `999999`).
- **`quizMode` ('base' vs 'context') was guessed from data, not read from state.** `MeaningQuizCard`
  inferred context mode from whether a sentence loaded, ignoring the authoritative
  `state.currentQuizItem.quizMode`.
- **All 9 `useQuiz()` consumers reached deep into `state.*`** and re-`find` things the context
  already computed, because the context under-exposed derived values.
- **Auto-advance was split-brain:** one timer in the context plus four `setTimeout`/focus effects
  in `BaseQuizCard`, coordinated only by a duplicated `quizType==='meaning'` check. Three of the
  four card timers had no cleanup → stale-card focus races on rapid transitions.
- Repeated presentational logic: POS-tag dedup ×3, "+N more definitions" ×2, reading-string
  formatting ×3.

---

## 4. Reliability: the sync layer

1. **Background merges were invisible to React and got overwritten.** `sync()` fetched remote,
   merged in another device's data, wrote it to localStorage, but deliberately skipped the
   `lastDownloadTime` signal, so QuizContext never reloaded it. The next reducer action then wrote
   stale React state back over that localStorage key. Cross-device changes pulled during a
   background upload could be lost before they were ever seen.
2. **No optimistic concurrency on Drive.** `uploadEnvelope` PATCHed the whole file with no
   ETag/`If-Match`; `modifiedTime` was fetched but unused. Two devices' read-modify-write races
   could silently clobber each other, the test suite even documented a known lost write
   (google.service.test.ts:78).
3. **Silent upload failure on expired token.** The auth-error branch in the upload path was
   commented out while the UI still showed "synced."
4. **The `_sync.version` counter was a change-counter, not a vector clock**, it couldn't detect
   concurrent divergence; equal-version ties discarded remote edits.
5. **Duplicate-file split-brain:** blind `POST` + `files[0]` selection meant two devices could bind
   to different physical files and never converge.
6. **Divergent serialization:** three separate `Set`-replacers and two non-equivalent `Date`
   deserializers, so identical stored bytes could hydrate into two different in-memory shapes.

---

## 5. Migration fragility

Two unrelated counters were both called "version" (`_formatVersion` for schema, `_sync.version`
for sync). The **synchronous** `migrateUserProgress` unconditionally stamped `_formatVersion = 7`
on every load, while the **async** homograph-merge migration was guarded by
`currentVersion >= CURRENT_FORMAT_VERSION`. So the cheap sync pass reached the terminal version
first and could pre-empt the async pass, and a stale comment ("we now bump to V6 locally") showed
the code had drifted from the intent of keeping sync one step behind.

---

## 6. What was already good (kept as-is)

- The **SRS formula core** (`calculateNextState`), clean, pure, parameterized, genuinely well-tested.
- **Data-integrity-fails-loudly** policy (fatal error gate), the right call for a study tool.
- Services mostly static/pure and dependency-light.
- Lazy-loaded routes and the compiled-data-in-`public` approach.

---

## 7. Remediation

See the Modification Log in [CLAUDE.md](CLAUDE.md) / [GEMINI.md](GEMINI.md) for the phased fix
that followed this audit: dead-code removal, a single `scheduling.ts` source of truth for due
dates, a modular `quizReducer`/`quizSelectors`/`useQuizOrchestration` split replacing the god
context, a redesigned lossless/concurrency-safe Drive sync, corrected migration versioning, and
new tests covering the previously-untested orchestration layer.
