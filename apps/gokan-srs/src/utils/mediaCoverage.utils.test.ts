import { describe, it, expect } from 'vitest';
import { aggregateEpisodeWords, buildWordKnowledge, computeCoverage, computeJlptCoverageMarks, countWatchedEpisodes, episodeKey, filterLibrary, isEpisodeWatched, jlptLevelIndex, knownRatio, libraryGenres, mergeWatchedEpisodes, rankLibrary, speechSpeedLabel, titleSearchKey, unknownWords, watchingByTitle, watchingFirst, watchStatus } from './mediaCoverage.utils';
import type { WordKnowledge } from './mediaCoverage.utils';
import type { VocabProgress } from '../models/vocabulary.model';
import { DEFAULT_VOCABULARY_PROGRESS } from '../models/vocabulary.model';
import { CONSTANTS } from '../commons/constants';
import type { JlptIndex, MediaEpisode } from '@gokan/dataset-schema';

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

describe('jlptLevelIndex', () => {
    it('maps each vocab id to its JLPT level', () => {
        const index: JlptIndex = {
            5: [{ id: 'a', containedKanji: [] }],
            4: [{ id: 'b', containedKanji: [] }],
            3: [],
            2: [],
            1: [{ id: 'c', containedKanji: [] }],
        };
        const map = jlptLevelIndex(index);
        expect(map.get('a')).toBe(5);
        expect(map.get('b')).toBe(4);
        expect(map.get('c')).toBe(1);
        expect(map.has('z')).toBe(false);
    });

    it('keeps the easier level when an id is listed under two', () => {
        const index: JlptIndex = { 5: [{ id: 'a', containedKanji: [] }], 4: [], 3: [{ id: 'a', containedKanji: [] }], 2: [], 1: [] };
        expect(jlptLevelIndex(index).get('a')).toBe(5);
    });
});

describe('computeJlptCoverageMarks', () => {
    const levelOf = new Map<string, number>([['a', 5], ['b', 4], ['c', 3], ['d', 1]]);

    it('gives the cumulative occurrence share up to each level, easiest first', () => {
        // a(N5)=2, b(N4)=1, c(N3)=1, d(N1)=1, e(untagged)=5; total 10. N2 adds nothing.
        const marks = computeJlptCoverageMarks([['a', 2], ['b', 1], ['c', 1], ['d', 1], ['e', 5]], levelOf);
        expect(marks).toEqual([
            { level: 5, ratio: 0.2 },
            { level: 4, ratio: 0.3 },
            { level: 3, ratio: 0.4 },
            { level: 2, ratio: 0.4 },
            { level: 1, ratio: 0.5 },
        ]);
    });

    it('returns no marks when no word is JLPT-tagged', () => {
        expect(computeJlptCoverageMarks([['e', 3], ['f', 1]], levelOf)).toEqual([]);
    });

    it('returns no marks for an empty word list', () => {
        expect(computeJlptCoverageMarks([], levelOf)).toEqual([]);
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
        { title: { original: 'のんのんびより', reading: 'のんのんびより', romaji: 'Non Non Biyori' }, genres: ['Comedy', 'Slice of Life'], tags: ['Countryside'] },
        { title: { original: 'ガールズ&パンツァー', reading: 'がーるず&ぱんつぁー', english: 'Girls und Panzer' }, genres: ['Action', 'Comedy'], tags: [] },
        { title: { original: '月がきれい', reading: 'つきがきれい' }, genres: ['Romance'], tags: ['School'] },
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

describe('library search', () => {
    // Readings as kuromoji writes them at dataset build time, misreadings included (古見 as ふるみ, 干物妹 as ほしものいもうと).
    const title = (original: string, reading: string, romaji: string, english?: string, tags: string[] = []) =>
        ({ title: { original, reading, romaji, ...(english ? { english } : {}) }, genres: [], tags });
    const library = [
        title('からかい上手の高木さん', 'からかいじょうずのたかぎさん', 'Karakai Jouzu no Takagi-san', 'Teasing Master Takagi-san', ['School']),
        title('からかい上手の高木さん３', 'からかいじょうずのたかぎさん３', 'Karakai Jouzu no Takagi-san 3'),
        title('久保さんは僕を許さない', 'くぼさんはぼくをゆるさない', 'Kubo-san wa Mob wo Yurusanai'),
        title('天体のメソッド', 'てんたいのめそっど', 'Sora no Method'),
        title('ガールズ&パンツァー', 'がーるず&ぱんつぁー', 'Girls und Panzer'),
        title('ドラえもん のび太の恐竜', 'どらえもん のびたのきょうりゅう', 'Doraemon: Nobita no Kyouryuu'),
        title('ドラえもん のび太の恐竜2006', 'どらえもん のびたのきょうりゅう2006', 'Doraemon: Nobita no Kyouryuu (2006)'),
        title('映画ドラえもん のび太の新恐竜', 'えいがどらえもん のびたのしんきょうりゅう', 'Doraemon: Nobita no Shin Kyoryuu'),
        title('わんだふるぷりきゅあ！', 'わんだふるぷりきゅあ！', 'Wonderful Precure!'),
        title('ひろがるスカイ！プリキュア', 'ひろがるすかい！ぷりきゅあ', 'Hirogaru Sky! Precure'),
        title('映画　クレヨンしんちゃん　嵐を呼ぶモーレツ！オトナ帝国の逆襲', 'えいが　くれよんしんちゃん　あらしをよぶもーれつ！おとなていこくのぎゃくしゅう', 'Crayon Shin-chan: Arashi wo Yobu Mouretsu! Otona Teikoku no Gyakushuu'),
        title('古見さんは、コミュ症です。', 'ふるみさんは、こみゅしょうです。', 'Komi-san wa, Komyushou desu.'),
        title('干物妹! うまるちゃん R', 'ほしものいもうと! うまるちゃん R', 'Himouto! Umaru-chan R'),
        title('のんのんびより', 'のんのんびより', 'Non Non Biyori', undefined, ['Countryside']),
    ];
    const found = (query: string) => filterLibrary(library, [], query).map(entry => entry.title.original);

    it('finds a title written in kanji by its kanji, its kana in either script, or romaji', () => {
        const takagi = ['からかい上手の高木さん', 'からかい上手の高木さん３'];
        for (const query of ['高木', 'たかぎ', 'タカギ', 'takagi']) expect(found(query)).toEqual(takagi);
        expect(found('くぼさん')).toEqual(['久保さんは僕を許さない']);
        expect(found('くぼさんは')).toEqual(['久保さんは僕を許さない']);
        expect(found('そらの')).toEqual(['天体のメソッド']);
    });

    it('finds a katakana title by hiragana, and every title of a series whatever script it is written in', () => {
        expect(found('がーるず')).toEqual(['ガールズ&パンツァー']);
        expect(found('めそっど')).toEqual(['天体のメソッド']);
        expect(found('どらえもん')).toHaveLength(3);
        const precure = ['わんだふるぷりきゅあ！', 'ひろがるスカイ！プリキュア'];
        expect(found('ぷりきゅあ')).toEqual(precure);
        expect(found('プリキュア')).toEqual(precure);
        expect(found('precure')).toEqual(precure);
    });

    it('ignores spaces, hyphens, punctuation and long vowels', () => {
        expect(found('takagisan')).toHaveLength(2);
        expect(found('kubosan')).toEqual(['久保さんは僕を許さない']);
        expect(found('kubo san')).toEqual(['久保さんは僕を許さない']);
        expect(found('kubo san wa')).toEqual(['久保さんは僕を許さない']);
        expect(found('shin chan')).toEqual(['映画　クレヨンしんちゃん　嵐を呼ぶモーレツ！オトナ帝国の逆襲']);
        expect(found('karakai jozu')).toHaveLength(2);
        expect(found('sora no method')).toEqual(['天体のメソッド']);
        expect(found('garuzu')).toEqual(['ガールズ&パンツァー']);
        expect(found('takagi-san 3')).toEqual(['からかい上手の高木さん３']);
    });

    it('finds every spelling of a long vowel, AniList itself spelling one Kyoryuu and the others Kyouryuu', () => {
        expect(found('kyoryu')).toHaveLength(3);
        expect(found('kyouryuu')).toHaveLength(3);
        expect(found('きょうりゅう')).toHaveLength(3);
    });

    it('finds a title kuromoji misreads through AniList\'s romaji', () => {
        expect(found('こみさん')).toEqual(['古見さんは、コミュ症です。']);
        expect(found('ひもうと')).toEqual(['干物妹! うまるちゃん R']);
        expect(found('umaru')).toEqual(['干物妹! うまるちゃん R']);
    });

    it('matches the English title and the tags as Latin text', () => {
        expect(found('teasing master')).toEqual(['からかい上手の高木さん']);
        expect(found('Countryside')).toEqual(['のんのんびより']);
        expect(found('school')).toEqual(['からかい上手の高木さん']);
    });

    it('lists every title for a blank or punctuation-only search', () => {
        expect(found('  ')).toHaveLength(library.length);
        expect(found('!')).toHaveLength(library.length);
    });

    it('compares one key for every writing of a title', () => {
        expect(titleSearchKey('からかい上手の高木さん３')).toBe('karakai上手no高木san3');
        expect(titleSearchKey('Karakai Jouzu no Takagi-san')).toBe('karakaijozunotakagisan');
        expect(titleSearchKey('キョウリュウ')).toBe('kyoryu');
    });
});

describe('rankLibrary', () => {
    const index = [
        { id: 'x', title: { original: 'X', reading: 'X' }, genres: ['Comedy'], tags: [] },
        { id: 'y', title: { original: 'Y', reading: 'Y' }, genres: ['Romance'], tags: [] },
        { id: 'z', title: { original: 'Z', reading: 'Z' }, genres: ['Comedy'], tags: [] },
    ];
    const words: Record<string, [string, number][]> = { x: [['a', 1], ['c', 9]], y: [['a', 5]], z: [['a', 1], ['b', 1]] };

    it('ranks the filtered titles by occurrence coverage, best fit first', () => {
        expect(rankLibrary(index, words, knowledge, [], '').map(r => r.entry.id)).toEqual(['y', 'z', 'x']);
        expect(rankLibrary(index, words, knowledge, ['Comedy'], '').map(r => r.entry.id)).toEqual(['z', 'x']);
    });

    it('treats a title missing from the word file as 0% rather than failing', () => {
        expect(rankLibrary([...index, { id: 'w', title: { original: 'W', reading: 'W' }, genres: [], tags: [] }], words, knowledge, [], '').at(-1)!.entry.id).toBe('w');
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

describe('watching first', () => {
    const mark = (watched: boolean, updatedAt: number) => ({ watched, updatedAt });
    // Best fit first, as rankLibrary gives them: a 3 episodes, b 2, c 2, d 1, e 2.
    const ranked = [
        { entry: { id: 'a', episodeCount: 3 } },
        { entry: { id: 'b', episodeCount: 2 } },
        { entry: { id: 'c', episodeCount: 2 } },
        { entry: { id: 'd', episodeCount: 1 } },
        { entry: { id: 'e', episodeCount: 2 } },
    ];
    const order = (watched: Record<string, { watched: boolean; updatedAt: number }>, rows = ranked) =>
        watchingFirst(rows, watchingByTitle(watched)).map(row => row.entry.id);

    it('reads each title\'s watched count and latest watched mark, ignoring unmarked episodes', () => {
        const byTitle = watchingByTitle({
            [episodeKey('a', 1)]: mark(true, 5),
            [episodeKey('a', 2)]: mark(true, 3),
            [episodeKey('a', 3)]: mark(false, 9),
            [episodeKey('b', 1)]: mark(false, 4),
        });
        expect(byTitle.get('a')).toEqual({ watchedCount: 2, lastWatchedAt: 5 });
        expect(byTitle.has('b')).toBe(false);
        expect(watchingByTitle(undefined).size).toBe(0);
    });

    it('is watching from the first watched episode until every episode is, then completed', () => {
        expect(watchStatus(undefined, 3)).toBe('not-started');
        expect(watchStatus({ watchedCount: 1, lastWatchedAt: 1 }, 3)).toBe('watching');
        expect(watchStatus({ watchedCount: 3, lastWatchedAt: 1 }, 3)).toBe('completed');
    });

    it('puts the titles being watched first, the most recently marked first, the rest in ranking order', () => {
        expect(order({
            [episodeKey('c', 1)]: mark(true, 10),
            [episodeKey('e', 1)]: mark(true, 20),
            [episodeKey('c', 2)]: mark(false, 30),
        })).toEqual(['e', 'c', 'a', 'b', 'd']);
    });

    it('leaves a completed title, and one with every mark removed, in ranking order', () => {
        expect(order({
            [episodeKey('d', 1)]: mark(true, 50),
            [episodeKey('e', 1)]: mark(true, 40),
            [episodeKey('e', 2)]: mark(true, 41),
            [episodeKey('b', 1)]: mark(false, 60),
            [episodeKey('c', 2)]: mark(true, 1),
        })).toEqual(['c', 'a', 'b', 'd', 'e']);
    });

    it('orders only what the filters let through', () => {
        const comedy = [
            { entry: { id: 'x', title: { original: 'X', reading: 'X' }, genres: ['Comedy'], tags: [], episodeCount: 2 } },
            { entry: { id: 'y', title: { original: 'Y', reading: 'Y' }, genres: ['Romance'], tags: [], episodeCount: 2 } },
            { entry: { id: 'z', title: { original: 'Z', reading: 'Z' }, genres: ['Comedy'], tags: [], episodeCount: 2 } },
        ];
        const passing = filterLibrary(comedy.map(row => row.entry), ['Comedy'], '').map(entry => ({ entry }));
        expect(watchingFirst(passing, watchingByTitle({
            [episodeKey('y', 1)]: mark(true, 9),
            [episodeKey('z', 1)]: mark(true, 1),
        })).map(row => row.entry.id)).toEqual(['z', 'x']);
    });
});
