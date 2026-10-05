import { describe, it, expect } from 'vitest';
import {
    aggregateEpisodeWords,
    buildWordKnowledge,
    computeCoverage,
    countWatchedEpisodes,
    episodeKey,
    filterLibrary,
    libraryGenres,
    rankLibrary,
    isEpisodeWatched,
    knownRatio,
    mergeWatchedEpisodes,
    speechSpeedLabel,
    unknownWords,
} from './mediaCoverage.utils';
import type { WordKnowledge } from './mediaCoverage.utils';
import type { VocabProgress } from '../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../models/vocabulary.model';
import { CONSTANTS } from '../commons/constants';
import type { MediaEpisode } from '../models/media.model';

const MASTERED = { ...DEFAULT_VOCABULARY_PROGRESS.reading, memoryStrength: CONSTANTS.srs.formula.mastery.maxMemoryStrength };

function vocab(vocabId: string, overrides: Partial<VocabProgress> = {}): VocabProgress {
    return { ...DEFAULT_VOCABULARY_PROGRESS, vocabId, introductionAt: new Date('2026-01-01'), ...overrides };
}

const knowledge = new Map<string, WordKnowledge>([['a', 'mastered'], ['b', 'learning']]);

describe('buildWordKnowledge', () => {
    it('splits introduced words into mastered and learning', () => {
        const result = buildWordKnowledge([
            vocab('a', { reading: MASTERED, meaning: MASTERED, production: MASTERED, stage: 'graduated' }),
            vocab('b'),
        ], { enableMeaningQuiz: true });
        expect(result.get('a')).toBe('mastered');
        expect(result.get('b')).toBe('learning');
    });

    it('leaves out a word that is queued but was never introduced', () => {
        expect(buildWordKnowledge([vocab('c', { introductionAt: null })]).has('c')).toBe(false);
    });
});

describe('computeCoverage', () => {
    it('weights by occurrences and also counts distinct words', () => {
        const coverage = computeCoverage([['a', 6], ['b', 3], ['c', 1]], knowledge);
        expect(coverage.occurrences).toEqual({ mastered: 6, learning: 3, total: 10 });
        expect(coverage.unique).toEqual({ mastered: 1, learning: 1, total: 3 });
        expect(knownRatio(coverage.occurrences)).toBeCloseTo(0.9);
        expect(knownRatio(coverage.unique)).toBeCloseTo(2 / 3);
    });

    it('reads 0 for an empty word list rather than dividing by zero', () => {
        expect(knownRatio(computeCoverage([], knowledge).occurrences)).toBe(0);
    });
});

describe('aggregateEpisodeWords', () => {
    it('sums each word across episodes, most frequent first', () => {
        const episodes = [
            { number: 1, words: [['a', 2], ['c', 5]] },
            { number: 2, words: [['a', 4], ['d', 1]] },
        ] as MediaEpisode[];
        expect(aggregateEpisodeWords(episodes)).toEqual([['a', 6], ['c', 5], ['d', 1]]);
    });
});

describe('unknownWords', () => {
    it('keeps only the words not known yet, in their original order', () => {
        expect(unknownWords([['a', 9], ['c', 2], ['b', 7], ['e', 7]], knowledge)).toEqual([['c', 2], ['e', 7]]);
    });
});

describe('speechSpeedLabel', () => {
    it('bands morae per minute into plain labels', () => {
        expect(speechSpeedLabel(220)).toBe('Slow');
        expect(speechSpeedLabel(294)).toBe('Moderate');
        expect(speechSpeedLabel(332)).toBe('Brisk');
        expect(speechSpeedLabel(420)).toBe('Fast');
    });

    it('has no label when the speed is unknown', () => {
        expect(speechSpeedLabel(0)).toBeNull();
    });
});

describe('library filtering', () => {
    const library = [
        { title: { original: 'のんのんびより', romaji: 'Non Non Biyori' }, genres: ['Comedy', 'Slice of Life'], tags: ['Countryside'] },
        { title: { original: 'ガールズ&パンツァー', english: 'Girls und Panzer' }, genres: ['Action', 'Comedy'], tags: [] },
        { title: { original: '月がきれい' }, genres: ['Romance'], tags: ['School'] },
    ];

    it('lists genres by how many titles carry them, ties alphabetical', () => {
        expect(libraryGenres(library)).toEqual(['Comedy', 'Action', 'Romance', 'Slice of Life']);
    });

    it('keeps titles with any chosen genre, every title when none is chosen', () => {
        expect(filterLibrary(library, ['Romance', 'Action'], '').map(e => e.title.original)).toEqual(['ガールズ&パンツァー', '月がきれい']);
        expect(filterLibrary(library, [], '')).toHaveLength(3);
    });

    it('searches every title form and the tags, ignoring case', () => {
        expect(filterLibrary(library, [], 'panzer')).toHaveLength(1);
        expect(filterLibrary(library, [], 'のんのん')).toHaveLength(1);
        expect(filterLibrary(library, [], 'countryside')).toHaveLength(1);
        expect(filterLibrary(library, ['Romance'], 'panzer')).toHaveLength(0);
    });
});

describe('rankLibrary', () => {
    const index = [
        { id: 'x', title: { original: 'X' }, genres: ['Comedy'], tags: [] },
        { id: 'y', title: { original: 'Y' }, genres: ['Romance'], tags: [] },
        { id: 'z', title: { original: 'Z' }, genres: ['Comedy'], tags: [] },
    ];
    const words: Record<string, [string, number][]> = { x: [['a', 1], ['c', 9]], y: [['a', 5]], z: [['a', 1], ['b', 1]] };

    it('ranks the filtered titles by occurrence coverage, best fit first', () => {
        expect(rankLibrary(index, words, knowledge, [], '').map(r => r.entry.id)).toEqual(['y', 'z', 'x']);
        expect(rankLibrary(index, words, knowledge, ['Comedy'], '').map(r => r.entry.id)).toEqual(['z', 'x']);
    });

    it('treats a title missing from the word file as 0% rather than failing', () => {
        expect(rankLibrary([...index, { id: 'w', title: { original: 'W' }, genres: [], tags: [] }], words, knowledge, [], '').at(-1)!.entry.id).toBe('w');
    });
});

describe('watched episodes', () => {
    const watched = {
        [episodeKey('16685', 1)]: { watched: true, updatedAt: 1 },
        [episodeKey('16685', 2)]: { watched: false, updatedAt: 2 },
        [episodeKey('166850', 1)]: { watched: true, updatedAt: 3 },
    };

    it('reads a mark, treating an un-marked episode as not watched', () => {
        expect(isEpisodeWatched(watched, '16685', 1)).toBe(true);
        expect(isEpisodeWatched(watched, '16685', 2)).toBe(false);
        expect(isEpisodeWatched(undefined, '16685', 1)).toBe(false);
    });

    it('counts one title only, never a title whose id merely starts with the same digits', () => {
        expect(countWatchedEpisodes(watched, '16685')).toBe(1);
        expect(countWatchedEpisodes(undefined, '16685')).toBe(0);
    });

    it('merges per episode with the newer mark winning and local winning a tie', () => {
        const merged = mergeWatchedEpisodes(
            { '1:1': { watched: false, updatedAt: 5 }, '1:2': { watched: true, updatedAt: 3 } },
            { '1:1': { watched: true, updatedAt: 4 }, '1:2': { watched: false, updatedAt: 3 }, '1:3': { watched: true, updatedAt: 1 } },
        );
        expect(merged).toEqual({
            '1:1': { watched: false, updatedAt: 5 },
            '1:2': { watched: true, updatedAt: 3 },
            '1:3': { watched: true, updatedAt: 1 },
        });
    });

    it('stays undefined when neither side has any marks', () => {
        expect(mergeWatchedEpisodes(undefined, undefined)).toBeUndefined();
    });
});
