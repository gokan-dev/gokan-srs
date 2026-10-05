import type { UserProgress, UserSettings } from "../models/user.model";
import { MigrationService } from "./migration.service";
import { parseStoredProgress, type StoredProgress } from "./progressHydration";
import type { ProgressWithMetadata } from "./sync/types";

/**
 * Single source of truth for progress (de)serialization, shared by localStorage
 * persistence and Google Drive sync so a stored payload always hydrates into the
 * exact same in-memory shape regardless of which channel it came from. The stored
 * shape itself, and its hydration, live in progressHydration.ts.
 */

/** JSON-safe plain object: Sets become arrays, Dates become ISO strings (via JSON.stringify). */
export function toPlainProgressJSON(progress: UserProgress): StoredProgress {
    return parseStoredProgress(JSON.stringify(progress, (_key, value: unknown) => (value instanceof Set ? [...value] : value)));
}

/** Runs migration then hydration - the full raw-JSON -> UserProgress pipeline.
 *  Settings must be passed whenever they are known: the migration pass re-derives
 *  nextReviewAt, and doing so without settings assumes meaning quizzes are enabled,
 *  which diverges from the settings-aware derivation used everywhere else. */
export function migrateAndHydrateProgress(stored: StoredProgress, settings?: Pick<UserSettings, 'enableMeaningQuiz'>): UserProgress {
    return MigrationService.migrateUserProgress(stored, settings);
}

/**
 * Canonical JSON stringification: object keys are sorted recursively, Dates
 * become ISO strings, Sets become sorted arrays. Two structurally-equal values
 * always produce the same string, regardless of key insertion order - which
 * differs between hydrated-from-storage objects and merge-produced objects.
 */
export function stableStringify(value: unknown): string {
    return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
    if (value instanceof Date) return value.toISOString();
    if (value instanceof Set) return [...(value as Set<unknown>)].sort();
    if (Array.isArray(value)) return value.map(sortDeep);
    if (value && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const sorted: Record<string, unknown> = {};
        for (const key of Object.keys(source).sort()) sorted[key] = sortDeep(source[key]);
        return sorted;
    }
    return value;
}

/**
 * Derive a stable content signature from the progress object, ignoring the
 * _sync metadata (which bumps on every merge even when nothing changed).
 */
export function progressUploadSignature(p: ProgressWithMetadata | null): string | null {
    if (!p) return null;
    const { _sync, ...rest } = p;
    void _sync;
    return stableStringify(rest);
}
