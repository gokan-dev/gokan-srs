/**
 * Shared test fixtures. Every test builds its progress, settings and dataset objects here
 * rather than declaring its own copy: a model change then updates one factory instead of
 * a dozen drifting ones (AGENTS.md, No duplication).
 *
 * Every factory returns fresh nested objects. Spreading the DEFAULT_ constants directly
 * shares their `history` arrays between fixtures, so a test pushing a review log would
 * leak it into every other fixture built in the same file.
 */
import type { GrammarExample, GrammarPoint, Vocabulary } from '@gokan/dataset-schema';
import { DEFAULT_GRAMMAR_PROGRESS, type GrammarProgress } from '../models/grammar.model';
import { DEFAULT_SETTINGS, type UserSettings } from '../models/user.model';
import { DEFAULT_SRS_ENTRY, DEFAULT_VOCABULARY_PROGRESS, type ReviewLog, type SRSEntry, type VocabProgress } from '../models/vocabulary.model';
import type { ProgressWithMetadata } from '../services/sync/types';
import type { AnswerSlot } from '../services/exercise/types';

export function srsEntry(overrides: Partial<SRSEntry> = {}): SRSEntry {
    return { ...DEFAULT_SRS_ENTRY, history: [], ...overrides };
}

export function reviewLog(overrides: Partial<ReviewLog> = {}): ReviewLog {
    return { date: Date.UTC(2026, 5, 10), result: 'correct', interval: 1, latency: 1000, ...overrides };
}

/** A learning word with all three directions present (production inert until activated). */
export function vocabProgress(overrides: Partial<VocabProgress> = {}): VocabProgress {
    return {
        ...DEFAULT_VOCABULARY_PROGRESS,
        vocabId: 'v1',
        reading: srsEntry(),
        meaning: srsEntry(),
        production: srsEntry(),
        ...overrides,
    };
}

export function grammarProgress(overrides: Partial<GrammarProgress> = {}): GrammarProgress {
    return { ...DEFAULT_GRAMMAR_PROGRESS, grammarId: 'n5-001', entry: srsEntry(), ...overrides };
}

export function userProgress(overrides: Partial<ProgressWithMetadata> = {}): ProgressWithMetadata {
    return {
        kanjiKnowledge: { method: 'kklc', step: 10, kanjiSet: new Set(['日']) },
        learningQueue: [],
        grammarQueue: [],
        completedChapters: [],
        stats: { newLearnedToday: 0, totalLearned: 0, totalReviews: 0 },
        dailyOverride: false,
        adaptive: { level: 1.0, history: [] },
        ...overrides,
    };
}

export function userSettings(overrides: Partial<UserSettings> = {}): UserSettings {
    return { ...DEFAULT_SETTINGS, ...overrides };
}

export function vocabulary(overrides: Partial<Vocabulary> = {}): Vocabulary {
    return {
        id: 'v1',
        writtenForm: { kanji: '日本', alternatives: [], containedKanji: ['日', '本'] },
        reading: { primary: 'にほん', alternatives: [] },
        frequency: { kanjiRank: 1 },
        progression: { kklcStep: 1 },
        senses: [{ pos: ['n'], misc: { rawTags: [] }, glosses: ['Japan'], related: { compounds: [] } }],
        ...overrides,
    };
}

/** A deciding answer slot with no word: revealing it shows its first accepted form. */
export function answerSlot(overrides: Partial<AnswerSlot> = {}): AnswerSlot {
    const accept = overrides.accept ?? [];
    return { accept, near: [], leniency: 'standard', role: 'core', reveal: accept[0] ?? '', gloss: '', ...overrides };
}

export function grammarExample(overrides: Partial<GrammarExample> = {}): GrammarExample {
    return {
        jp: '寿司が一番好きです。',
        romaji: 'sushi ga ichiban suki desu',
        en: 'I like sushi the most.',
        patternWordIndices: [],
        words: [],
        ...overrides,
    };
}

export function grammarPoint(overrides: Partial<GrammarPoint> = {}): GrammarPoint {
    return {
        id: 'n5-001',
        title: 'A が いちばん～',
        jlptLevel: 5,
        shortExplanation: 'superlative',
        longExplanation: 'superlative, in detail',
        formation: 'Noun + が + いちばん',
        examples: [grammarExample()],
        ...overrides,
    };
}

