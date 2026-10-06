import { DEFAULT_SRS_ENTRY, DEFAULT_VOCABULARY_PROGRESS, type ReviewLog } from "../models/vocabulary.model";
import type { StoredProgress } from "./progressHydration";

/**
 * The compact form progress takes in localStorage, which caps an origin at about 5 MB
 * (Firefox and Safari count the whole origin). A year of reviews in the readable JSON
 * filled it and every save threw. The code never sees this form: StorageService
 * compacts right before writing and expands right after reading, so field names in
 * the app stay readable. Google Drive keeps the readable form, which another device on
 * an older build must still be able to read.
 *
 * Every rule is lossless once hydrated (progressHydration.ts restores what is left out):
 *  - field names become short codes (KEY_CODES);
 *  - dates become epoch milliseconds, and review logs become tuples whose dates are
 *    stored as deltas from the previous log;
 *  - nulls, values equal to their hydration default and the derived `nextReviewAt`
 *    of a non-graduated item (recomputed on every load) are left out;
 *  - `stage` becomes 0/1, a boolean history a 0/1 string, the kanji set one string.
 *
 * Floats are deliberately NOT rounded: the Drive copy keeps full precision, and a local
 * copy that differs from it by rounding would read as a change to merge on every load.
 */

/** Marks a compact payload; the readable form never has this key. */
const MARKER = '~';
const CODEC_VERSION = 1;

const KEY_CODES = {
    kanjiKnowledge: 'k', method: 'km', step: 'ks', kanjiSet: 'kj',
    learningQueue: 'q', grammarQueue: 'gq', completedChapters: 'cc', retiredVocabIds: 'rv',
    watchedEpisodes: 'we', watched: 'w', updatedAt: 'ua', coverageAtWatch: 'cw',
    stats: 'st', newLearnedToday: 'nl', totalLearned: 'tl', totalReviews: 'tr',
    dailyOverride: 'do', adaptive: 'ad', calibration: 'cb', level: 'l', history: 'h',
    reading: 'r', meaning: 'mn', production: 'p', grammar: 'g',
    _sync: 'sy', lastModified: 'lm', version: 'v', _formatVersion: 'fv',
    vocabId: 'i', grammarId: 'gi', stage: 's', introductionAt: 'ia', nextReviewAt: 'na',
    lastReviewedAt: 'lr', consecutiveFailures: 'cf', needsRetry: 'nr', entry: 'e',
    memoryStrength: 'ms', interval: 'iv', difficulty: 'd', dueDate: 'dd',
    date: 'dt', result: 'rs', latency: 'lt', source: 'so',
} as const satisfies Record<string, string>;

const CODE_KEYS: ReadonlyMap<string, string> = new Map(Object.entries(KEY_CODES).map(([key, code]) => [code, key]));
const KEY_TO_CODE: ReadonlyMap<string, string> = new Map(Object.entries(KEY_CODES));

/** Prefix for a field this build does not know whose name would read as a code. */
const ESCAPE = '!';

const DATE_KEYS: ReadonlySet<string> = new Set(['introductionAt', 'nextReviewAt', 'lastReviewedAt', 'dueDate']);
const STAGES = ['learning', 'graduated'] as const;
const RESULTS = ['correct', 'minor_error', 'wrong', 'pass'] as const satisfies readonly ReviewLog['result'][];
const SOURCES = ['reinforcement'] as const satisfies readonly NonNullable<ReviewLog['source']>[];
const LOG_FIELDS: ReadonlySet<string> = new Set(['date', 'result', 'interval', 'latency', 'source']);

/** Values hydration puts back when the field is missing (DEFAULT_SRS_ENTRY / DEFAULT_*_PROGRESS spreads). */
const HYDRATION_DEFAULTS: ReadonlyMap<string, number> = new Map([
    ['memoryStrength', DEFAULT_SRS_ENTRY.memoryStrength],
    ['interval', DEFAULT_SRS_ENTRY.interval],
    ['difficulty', DEFAULT_SRS_ENTRY.difficulty],
    ['consecutiveFailures', DEFAULT_VOCABULARY_PROGRESS.consecutiveFailures],
    ['totalReviews', DEFAULT_VOCABULARY_PROGRESS.totalReviews],
]);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function indexOfValue<T extends string>(list: readonly T[], value: unknown): number {
    return list.findIndex(entry => entry === value);
}

// ---------------------------------------------------------------------------- compact

/** A review log as a tuple [date delta, result, interval, latency, source?], or null when it does not fit one. */
function logTuple(log: unknown, previousDate: number): number[] | null {
    if (!isRecord(log) || typeof log.date !== 'number') return null;
    if (Object.keys(log).some(key => !LOG_FIELDS.has(key))) return null;
    const result = indexOfValue(RESULTS, log.result);
    if (result < 0) return null;
    const interval = log.interval ?? 0;
    const latency = log.latency ?? 0;
    if (typeof interval !== 'number' || typeof latency !== 'number') return null;
    const tuple = [log.date - previousDate, result, interval, latency];
    if (log.source === undefined) return tuple;
    const source = indexOfValue(SOURCES, log.source);
    return source < 0 ? null : [...tuple, source];
}

function compactHistory(history: unknown[]): unknown {
    if (history.every(item => typeof item === 'boolean')) return history.map(item => (item ? '1' : '0')).join('');
    let previousDate = 0;
    return history.map(item => {
        const tuple = logTuple(item, previousDate);
        if (!tuple || !isRecord(item) || typeof item.date !== 'number') return compactValue(null, item);
        previousDate = item.date;
        return tuple;
    });
}

function compactKey(key: string): string {
    const code = KEY_TO_CODE.get(key);
    if (code) return code;
    return CODE_KEYS.has(key) || key.startsWith(ESCAPE) ? ESCAPE + key : key;
}

function compactObject(source: object): Record<string, unknown> {
    const entries: [string, unknown][] = Object.entries(source);
    const stage = entries.find(([key]) => key === 'stage')?.[1];
    const out: Record<string, unknown> = {};
    for (const [key, value] of entries) {
        if (value === null || value === undefined) continue;
        if (HYDRATION_DEFAULTS.get(key) === value) continue;
        if (key === 'nextReviewAt' && stage !== 'graduated') continue;
        out[compactKey(key)] = compactValue(key, value);
    }
    return out;
}

function compactValue(key: string | null, value: unknown): unknown {
    if (key !== null && DATE_KEYS.has(key) && typeof value === 'string') {
        const time = Date.parse(value);
        return Number.isNaN(time) ? value : time;
    }
    if (key === 'stage') {
        const stage = indexOfValue(STAGES, value);
        return stage < 0 ? value : stage;
    }
    if (key === 'kanjiSet' && Array.isArray(value) && value.every(item => typeof item === 'string' && [...item].length === 1)) {
        return value.join('');
    }
    if (key === 'history' && Array.isArray(value)) return compactHistory(value);
    if (Array.isArray(value)) return value.map(item => compactValue(null, item));
    if (isRecord(value)) return compactObject(value);
    return value;
}

/** The compact payload for a readable stored progress (as toPlainProgressJSON produces it). */
export function compactProgress(stored: StoredProgress): Record<string, unknown> {
    return { [MARKER]: CODEC_VERSION, ...compactObject(stored) };
}

// ---------------------------------------------------------------------------- expand

function expandLog(tuple: unknown[], previousDate: number): ReviewLog | null {
    const [delta, result, interval, latency, source] = tuple;
    if (typeof delta !== 'number' || typeof result !== 'number' || typeof interval !== 'number' || typeof latency !== 'number') return null;
    const resultName = RESULTS[result];
    if (resultName === undefined) return null;
    const log: ReviewLog = { date: previousDate + delta, result: resultName, interval, latency };
    if (typeof source === 'number' && SOURCES[source] !== undefined) log.source = SOURCES[source];
    return log;
}

function expandHistory(history: unknown): unknown {
    if (typeof history === 'string') return [...history].map(flag => flag === '1');
    if (!Array.isArray(history)) return expandValue(null, history);
    let previousDate = 0;
    const out: unknown[] = [];
    for (const item of history) {
        if (Array.isArray(item)) {
            const log = expandLog(item, previousDate);
            if (!log) continue; // a malformed tuple cannot be placed; hydration drops bad logs the same way
            previousDate = log.date;
            out.push(log);
        } else {
            out.push(expandValue(null, item));
        }
    }
    return out;
}

function expandKey(code: string): string {
    if (code.startsWith(ESCAPE)) return code.slice(ESCAPE.length);
    return CODE_KEYS.get(code) ?? code;
}

function expandValue(key: string | null, value: unknown): unknown {
    if (key !== null && DATE_KEYS.has(key) && typeof value === 'number') return new Date(value).toISOString();
    if (key === 'stage' && typeof value === 'number') return STAGES[value] ?? value;
    if (key === 'kanjiSet' && typeof value === 'string') return [...value];
    if (key === 'history') return expandHistory(value);
    if (Array.isArray(value)) return value.map(item => expandValue(null, item));
    if (isRecord(value)) {
        const out: Record<string, unknown> = {};
        for (const [code, item] of Object.entries(value)) {
            const name = expandKey(code);
            out[name] = expandValue(name, item);
        }
        return out;
    }
    return value;
}

/** Whether a parsed localStorage value is in the compact form. */
export function isCompactProgress(parsed: unknown): boolean {
    return isRecord(parsed) && parsed[MARKER] === CODEC_VERSION;
}

/**
 * The readable stored shape for a parsed localStorage value: compact payloads are
 * expanded, anything else (progress saved before compaction) is returned as is.
 */
export function expandProgress(parsed: unknown): unknown {
    if (!isRecord(parsed) || !isCompactProgress(parsed)) return parsed;
    const { [MARKER]: _version, ...rest } = parsed;
    return expandValue(null, rest);
}
