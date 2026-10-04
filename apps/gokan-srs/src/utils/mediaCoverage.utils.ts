import type { MediaEpisode, MediaWordCount, WatchedEpisode } from '../models/media.model';
import type { VocabProgress } from '../models/vocabulary.model';
import type { UserSettings } from '../models/user.model';
import { isVocabFullyMastered } from '../services/scheduling';

/**
 * Pure logic behind the listening library: how much of an anime episode's
 * vocabulary the learner already knows, which words would help most, and the
 * per-episode "watched" marks.
 *
 * Every figure is over the episode's GOKAN vocabulary only (kanji words; no
 * particles, kana-only words or loanwords yet), so the UI must say so rather
 * than present it as comprehension of everything said.
 */

/** How well the learner knows a word: fully mastered, or introduced and still being learned. */
export type WordKnowledge = 'mastered' | 'learning';

/** Introduced words only: a word queued but never introduced is not known yet. */
export function buildWordKnowledge(
    learningQueue: VocabProgress[],
    settings?: Pick<UserSettings, 'enableMeaningQuiz' | 'enableProductionQuiz'>
): Map<string, WordKnowledge> {
    const knowledge = new Map<string, WordKnowledge>();
    for (const item of learningQueue) {
        if (!item.introductionAt) continue;
        knowledge.set(item.vocabId, isVocabFullyMastered(item, settings) ? 'mastered' : 'learning');
    }
    return knowledge;
}

/** The same three-way shape ChapterProgressBar takes: mastered and learning out of total. */
export interface KnowledgeCounts {
    mastered: number;
    learning: number;
    total: number;
}

export interface MediaCoverage {
    /** Weighted by occurrences: how much of what is SAID uses words the learner knows. */
    occurrences: KnowledgeCounts;
    /** Each distinct word counted once. */
    unique: KnowledgeCounts;
}

export function computeCoverage(words: MediaWordCount[], knowledge: Map<string, WordKnowledge>): MediaCoverage {
    const occurrences: KnowledgeCounts = { mastered: 0, learning: 0, total: 0 };
    const unique: KnowledgeCounts = { mastered: 0, learning: 0, total: 0 };
    for (const [vocabId, count] of words) {
        occurrences.total += count;
        unique.total += 1;
        const known = knowledge.get(vocabId);
        if (known) {
            occurrences[known] += count;
            unique[known] += 1;
        }
    }
    return { occurrences, unique };
}

/** Known (mastered + learning) share, 0..1; 0 for an empty list. */
export function knownRatio(counts: KnowledgeCounts): number {
    return counts.total > 0 ? (counts.mastered + counts.learning) / counts.total : 0;
}

export function formatPercent(ratio: number): string {
    return `${Math.round(ratio * 100)}%`;
}

/** A whole series' word list: every episode's counts summed, most frequent first. */
export function aggregateEpisodeWords(episodes: MediaEpisode[]): MediaWordCount[] {
    const counts = new Map<string, number>();
    for (const episode of episodes) {
        for (const [vocabId, count] of episode.words) counts.set(vocabId, (counts.get(vocabId) ?? 0) + count);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * The words not yet known, most frequent first. Learning the most frequent
 * unknown words raises an episode's coverage fastest, so these are the ones
 * worth learning before watching.
 */
export function wordsToLearn(words: MediaWordCount[], knowledge: Map<string, WordKnowledge>, limit: number): MediaWordCount[] {
    const unknown = words.filter(([vocabId]) => !knowledge.has(vocabId));
    return [...unknown].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

/**
 * A plain-language band for a speech rate in morae per minute. Bands from the
 * spread across Jiten's data: learner-oriented channels sit around 180-220,
 * calm anime around 230-300, fast native talk at 400 and above.
 */
export function speechSpeedLabel(moraPerMinute: number): string | null {
    if (moraPerMinute <= 0) return null;
    if (moraPerMinute < 260) return 'Slow';
    if (moraPerMinute < 320) return 'Moderate';
    if (moraPerMinute < 380) return 'Brisk';
    return 'Fast';
}

export function episodeKey(mediaId: string, episodeNumber: number): string {
    return `${mediaId}:${episodeNumber}`;
}

export function isEpisodeWatched(
    watched: Record<string, WatchedEpisode> | undefined,
    mediaId: string,
    episodeNumber: number
): boolean {
    return watched?.[episodeKey(mediaId, episodeNumber)]?.watched === true;
}

export function countWatchedEpisodes(watched: Record<string, WatchedEpisode> | undefined, mediaId: string): number {
    if (!watched) return 0;
    const prefix = `${mediaId}:`;
    return Object.entries(watched).filter(([key, entry]) => key.startsWith(prefix) && entry.watched).length;
}

/**
 * Drive merge: per episode, the more recent mark wins (local on a tie), so
 * un-marking an episode on one device propagates instead of being undone by the
 * other device's older "watched". Returns undefined when neither side has any,
 * so progress that never used the library keeps no field at all.
 */
export function mergeWatchedEpisodes(
    local: Record<string, WatchedEpisode> | undefined,
    remote: Record<string, WatchedEpisode> | undefined
): Record<string, WatchedEpisode> | undefined {
    if (!local && !remote) return undefined;
    const merged: Record<string, WatchedEpisode> = { ...(remote ?? {}) };
    for (const [key, entry] of Object.entries(local ?? {})) {
        const other = merged[key];
        if (!other || entry.updatedAt >= other.updatedAt) merged[key] = entry;
    }
    return merged;
}
