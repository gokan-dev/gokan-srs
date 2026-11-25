import { describe, expect, it } from 'vitest';
import type { FrequencyIndex } from '@gokan/dataset-schema';
import { alsoReadTerms, firstGloss, glossTerm, ROMAJI_FREQUENCY_FLOOR, ROMAJI_PAGE_CAP, romajiGroups, romajiKey, romajiOf, romajiParts, romajiSpoken } from './romaji';
import type { VocabSummary } from './types';

/** Summaries and a frequency index in the order given, most frequent first. */
function world(words: VocabSummary[]): { frequency: FrequencyIndex; summaries: Map<string, VocabSummary> } {
    return {
        frequency: words.map(word => ({ id: word.id, containedKanji: [] })),
        summaries: new Map(words.map(word => [word.id, word])),
    };
}

describe('romajiOf', () => {
    it('writes Hepburn, as a word page shows it', () => {
        expect(romajiOf('べんきょう')).toBe('benkyou');
        expect(romajiOf('こんな')).toBe('konna');
        expect(romajiOf('きんえん')).toBe("kin'en");
        expect(romajiOf('たべました')).toBe('tabemashita');
    });
});

describe('romajiKey', () => {
    it('is what a learner types: no apostrophe, katakana as hiragana', () => {
        expect(romajiKey('きんえん')).toBe('kinen');
        expect(romajiKey('パン')).toBe('pan');
    });

    it('is null for a reading that does not spell to letters', () => {
        expect(romajiKey('〇')).toBeNull();
    });
});

describe('romajiGroups', () => {
    const bridge = { id: '1', word: '橋', reading: 'はし' };
    const edge = { id: '2', word: '端', reading: 'はし' };
    const rain = { id: '3', word: '雨', reading: 'あめ' };
    const chopsticks = { id: '4', word: '箸', reading: 'はし' };

    it('groups the words a romaji is shared by, most frequent first', () => {
        const { frequency, summaries } = world([edge, rain, bridge, chopsticks]);
        const groups = romajiGroups(frequency, summaries);
        expect([...groups.byRomaji]).toEqual([['hashi', ['2', '1', '4']]]);
        expect(groups.groupOf.get('4')).toBe('hashi');
    });

    it('has no group for a romaji with one word', () => {
        const { frequency, summaries } = world([rain, bridge]);
        expect(romajiGroups(frequency, summaries).byRomaji.size).toBe(0);
        expect(romajiGroups(frequency, summaries).groupOf.has('3')).toBe(false);
    });

    it('reads a word learned in kana by its headword', () => {
        const { frequency, summaries } = world([{ id: '5', word: 'さる' }, { id: '6', word: '猿', reading: 'さる' }]);
        expect(romajiGroups(frequency, summaries).byRomaji.get('saru')).toEqual(['5', '6']);
    });

    it('counts only frequent words, or words with a JLPT level, so no group is one word and the rare', () => {
        const filler = Array.from({ length: ROMAJI_FREQUENCY_FLOOR }, (_, at) => ({ id: `f${at}`, word: `語${at}`, reading: `ぬ${'ぬ'.repeat(at % 7)}${at}` }));
        const rare = { id: '7', word: '飴', reading: 'あめ' };
        const { frequency, summaries } = world([rain, ...filler, rare]);
        expect(romajiGroups(frequency, summaries).byRomaji.has('ame')).toBe(false);
        const leveled = world([rain, ...filler, { ...rare, jlpt: 3 }]);
        expect(romajiGroups(leveled.frequency, leveled.summaries).byRomaji.get('ame')).toEqual(['3', '7']);
    });

    it('never has more groups than the cap, and every group has two words or more', () => {
        const pairs = Array.from({ length: ROMAJI_PAGE_CAP + 10 }, (_, at) => {
            // A distinct romaji per pair: the number written in kana digits of か, き, く...
            const reading = [...String(at)].map(digit => 'かきくけこさしすせそ'[Number(digit)]).join('');
            return [{ id: `a${at}`, word: `甲${at}`, reading }, { id: `b${at}`, word: `乙${at}`, reading }];
        }).flat();
        const { frequency, summaries } = world(pairs);
        const groups = romajiGroups(frequency, summaries);
        expect(groups.byRomaji.size).toBe(ROMAJI_PAGE_CAP);
        expect([...groups.byRomaji.values()].every(ids => ids.length >= 2)).toBe(true);
        // The groups kept are those of the most frequent words.
        expect(groups.groupOf.has('a0')).toBe(true);
        expect(groups.groupOf.has(`a${ROMAJI_PAGE_CAP + 9}`)).toBe(false);
    });
});

describe('firstGloss', () => {
    it('is the first of a short gloss, or nothing', () => {
        expect(firstGloss('end; edge; tip')).toBe('end');
        expect(firstGloss(undefined)).toBe('');
    });
});

describe('glossTerm', () => {
    it('names a word by its first gloss, its parenthesised notes dropped', () => {
        expect(glossTerm('to take (a photograph); to snap')).toBe('to take');
        expect(glossTerm('to adopt (a method, proposal, etc.)')).toBe('to adopt');
        expect(glossTerm('chopsticks')).toBe('chopsticks');
        expect(glossTerm('(polite)')).toBe('(polite)');
        expect(glossTerm(undefined)).toBe('');
    });
});

describe('alsoReadTerms', () => {
    const toru = { 取る: 'to take; to pick up', 撮る: 'to take (a photograph)', 執る: 'to take (trouble)', 採る: 'to adopt (a method, proposal, etc.)' };

    it('keeps the note where the short terms would name two words alike: 撮る and 執る on 取る\'s page', () => {
        const terms = alsoReadTerms(toru.取る, [toru.撮る, toru.執る, toru.採る]);
        expect(terms).toEqual(['to take (a photograph)', 'to take (trouble)', 'to adopt']);
        expect(terms).not.toContain('to take');
        expect(new Set(terms).size).toBe(terms.length);
    });

    it('tells 取る, 撮る and 執る apart on 採る\'s page', () => {
        const terms = alsoReadTerms(toru.採る, [toru.取る, toru.撮る, toru.執る]);
        expect(terms).toEqual(['to take', 'to take (a photograph)', 'to take (trouble)']);
    });

    it('names a word by its short term when nothing shares it: 箸 chopsticks, 端 edge', () => {
        expect(alsoReadTerms('bridge', ['chopsticks', 'end (e.g. of a street); edge'])).toEqual(['chopsticks', 'end']);
    });

    it('keeps the whole short gloss when the first glosses are one as well', () => {
        expect(alsoReadTerms('to take; to pick up', ['to take; to get', 'to take; to steal'])).toEqual(['to take; to get', 'to take; to steal']);
    });
});

describe('romajiSpoken', () => {
    it('says whether the accents differ, are the same, or are not all known', () => {
        expect(romajiSpoken(['はし', 'はし'], [{ downsteps: [2] }, { downsteps: [0] }])).toBe('differs');
        expect(romajiSpoken(['はし', 'はし'], [{ downsteps: [1] }, { downsteps: [1] }])).toBe('same');
        expect(romajiSpoken(['はし', 'はし'], [{ downsteps: [1] }, undefined])).toBe('unknown');
    });

    it('credits the kana first when they differ: 禁煙 and 記念 share "kinen", and sound apart even at one downstep', () => {
        expect(romajiSpoken(['きんえん', 'きねん'], [{ downsteps: [0] }, { downsteps: [0] }])).toBe('readings');
        expect(romajiSpoken(['きんえん', 'きねん'], [{ downsteps: [0] }, undefined])).toBe('readings');
    });

    it('credits the kana with only some words when two share theirs: 人員 じんいん, 辞任 and 自認 じにん', () => {
        const readings = ['じんいん', 'じにん', 'じにん'];
        expect(romajiSpoken(readings, [{ downsteps: [0] }, { downsteps: [1] }, { downsteps: [1] }])).toBe('partly-same');
        expect(romajiSpoken(readings, [{ downsteps: [1] }, { downsteps: [1] }, { downsteps: [0] }])).toBe('partly-differs');
        expect(romajiSpoken(readings, [{ downsteps: [0] }, { downsteps: [1] }, undefined])).toBe('partly-unknown');
        // The pitch of a word read its own way (じんいん) does not count: only within a shared reading.
        expect(romajiSpoken(readings, [undefined, { downsteps: [1] }, { downsteps: [1] }])).toBe('partly-same');
        // Two shared readings that disagree: no claim about the pitch.
        expect(romajiSpoken(['しない', 'しない', 'しんあい', 'しんあい'], [{ downsteps: [1] }, { downsteps: [1] }, { downsteps: [0] }, { downsteps: [1] }])).toBe('partly-unknown');
    });
});

describe('romajiParts', () => {
    it('cuts between morae, so a long form wraps at a syllable, and joins back to its romaji', () => {
        expect(romajiParts('とりませんでした')).toEqual(['to', 'ri', 'ma', 'se', 'n', 'de', 'shi', 'ta']);
        expect(romajiParts('べんきょう')).toEqual(['be', 'n', 'kyo', 'u']);
        for (const reading of ['とりませんでした', 'とらなかった', 'きんえん', 'べんきょうします']) expect(romajiParts(reading).join('')).toBe(romajiOf(reading));
    });

    it('never cuts after a っ, which doubles what follows, nor before the apostrophe of an n', () => {
        expect(romajiParts('とらなかった')).toEqual(['to', 'ra', 'na', 'ka', 'tta']);
        expect(romajiParts('きんえん')).toEqual(['ki', "n'e", 'n']);
    });
});
