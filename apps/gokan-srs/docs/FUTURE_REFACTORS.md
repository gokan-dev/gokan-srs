# Future Refactors

Planned structural improvements identified during the sync-loop investigation
([2026-07-19], see `sync-loop-investigation.md` and the Modification Log in
docs/ARCHITECTURE.md). None of these are urgent, the current code is correct and
tested, but each one *removes* a class of bugs rather than guarding against it.
Ordered by leverage.

## 1. Stop persisting `nextReviewAt` (and likely `stage`): derive at read time

**The problem.** `VocabProgress.nextReviewAt` is a pure function of
`(reading, meaning, settings)`, `scheduling.ts` even documents it as "always
derived, never hand-set". But it is still *stored*, which forces every boundary
that touches stored data (migration on load, `mergeVocabProgress`, `applyAnswer`)
to re-derive and re-write it, and each of those call sites must agree on the
inputs. The 2026-07-19 infinite sync loop was exactly this failing: the migration
pass derived it without settings while the merge derived it with settings, so the
stored value flipped on every load→merge round trip.

**The fix.** Delete `nextReviewAt` from the persisted model (schema v9 migration:
drop the field on read). Expose it only through `vocabNextReviewAt(vocab,
settings)` / selectors. Everything currently reading `progress.learningQueue[i]
.nextReviewAt` (queue selection in `srs.utils.ts`, `advanceQueue`'s due-count,
stats/forecast components) switches to the selector.

`stage: 'graduated'` is probably derivable too: "Skip" sets
`memoryStrength = maxMemoryStrength`, so graduation ≡ `isVocabFullyMastered`.
Verify there is no non-derivable graduation path before folding it in.

**What this deletes:** the settings-threading through
`migrateUserProgress`/`migrateAndHydrateProgress` (and `loadProgress`'s hidden
`loadSettings()` call), the unconditional recompute pass in the migration
service, the `nextReviewAt`/`stage` re-derivation block in `mergeVocabProgress`,
and the entire "derived value drifted" bug class.

## 2. Extract the sync engine out of React (`SyncManager`)

**The problem.** A stateful sync engine (debounce timer, `GoogleDriveSync`
instance, in-flight flags) lives inside React state in `GoogleDriveContext`.
That forces workarounds against React's identity model: `useCallback([])` +
ref-mirroring (`syncServiceRef`, `isDownloadingRef`) so `uploadProgress` stays
referentially stable, and careful effect-dependency curation in
`useQuizOrchestration`. Both 2026-07-19 loop edges in the React layer came from
this friction.

**The fix.** A plain `SyncManager` class (no React) owning: the Drive client,
debounce/scheduling, fast-forward bookkeeping, and sync status. React consumes
it via `useSyncExternalStore` (status: isUploading/isDownloading/syncPaused) and
an event/callback for "remote changes arrived" (replacing the
`lastBackgroundMergeTime` counter). `GoogleDriveContext` shrinks to auth +
wiring; the ref-mirroring disappears.

## 3. Use Drive revision ids for fast-forward ancestry, not content signatures

`GoogleDriveSync.sync()` currently detects "remote is my own last write" by
comparing content signatures of the hydrated remote against the last-written
envelope. This works (and is regression-tested through the real
serialize→parse path), but it infers causality from content equality and
silently degrades to merge-every-upload if the round trip ever stops being
signature-stable (watch for the `Remote diverged from this client's last write`
console.info firing after every answer). Drive already provides a real
causality token: request `headRevisionId` (or `version`) in file metadata,
remember it after each write, and fast-forward when it is unchanged. Keep the
content signature only as the local dirty-check for the auto-upload effect.

## 4. Revisit `mergeEntry`'s `max(memoryStrength, interval)` policy

The max() "safety net" cannot distinguish "stale device" from "legitimate
regression after a failed review": on a genuine cross-device merge it partially
undoes the SRS penalty of whichever side failed a review more recently.
Fast-forward removed this for the single-device case, but real multi-device
merges still resurrect penalties. Preferred policy: the entry with the newer
`lastReviewedAt` wins memoryStrength/interval too (recency-per-entry, matching
how dueDate/difficulty already merge); keep max() only when recency ties.
Requires updating `mergeProgress.test.ts` expectations deliberately.

## 5. Settings version conflation (minor)

`mergeSettings` decides recency using the *progress* `_sync.version`, which
bumps for reasons unrelated to settings edits. Harmless today (settings rarely
conflict) but semantically wrong. Fix alongside #2 or #4: stamp settings with
their own `lastModified` on `SAVE_SETTINGS` and merge on that.
