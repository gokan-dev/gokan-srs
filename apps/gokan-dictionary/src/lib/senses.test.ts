import { describe, expect, it } from 'vitest';
import type { Sense } from '@gokan/dataset-schema';
import { wordText } from '../test/fixtures';
import { LOCAL_GLOSS_LENGTH, meaningsOf, shortWordTextSummary, VISIBLE_SENSES, wordTextSummary } from './senses';

function sense(glosses: string[], pos: string[] = ['n'], rawTags: string[] = []): Sense {
    return { pos, misc: { rawTags, isArchaic: rawTags.includes('arch') }, glosses, related: { compounds: [] } };
}

describe('meaningsOf', () => {
    it('labels the part of speech in plain English, only when it changes', () => {
        const { visible } = meaningsOf([sense(['to eat'], ['v1', 'vt']), sense(['to live on'], ['v1', 'vt']), sense(['meal'], ['n'])]);
        expect(visible.map(v => v.pos)).toEqual(['Ichidan verb, Transitive', undefined, 'Noun']);
    });

    it('shows usage labels after the glosses, leaving "usually kana" to the header', () => {
        const { visible } = meaningsOf([sense(['honourable'], ['suf'], ['hon', 'uk'])]);
        expect(visible[0]).toEqual({ number: 1, pos: 'Suffix', glosses: 'honourable', labels: ['Honorific'] });
    });

    it('shows the first five common senses, the rest behind a disclosure, rare ones last', () => {
        const senses = [
            sense(['archaic one'], ['n'], ['arch']),
            ...Array.from({ length: 7 }, (_, i) => sense([`common ${i + 1}`])),
            sense(['dated one'], ['n'], ['dated']),
        ];
        const { visible, more, rare } = meaningsOf(senses);
        expect(visible).toHaveLength(VISIBLE_SENSES);
        expect(visible.map(v => v.glosses)).toEqual(['common 1', 'common 2', 'common 3', 'common 4', 'common 5']);
        expect(more.map(v => [v.number, v.glosses])).toEqual([[6, 'common 6'], [7, 'common 7']]);
        expect(rare.map(v => [v.number, v.glosses])).toEqual([[8, 'archaic one'], [9, 'dated one']]);
    });

    it('has nothing behind the disclosure when a word has few senses', () => {
        const { visible, more, rare } = meaningsOf([sense(['a']), sense(['b'])]);
        expect([visible.length, more.length, rare.length]).toEqual([2, 0, 0]);
    });
});

describe('wordTextSummary', () => {
    it('names the first two equivalents, with the enumeration comma', () => {
        expect(wordTextSummary(wordText())).toBe('想、认为');
    });

    it('falls back to the first definition\'s first sense, its glosses joined by the semicolon', () => {
        expect(wordTextSummary(wordText({ equivalents: [] }))).toBe('想；认为');
    });

    it('is empty for a word with neither', () => {
        expect(wordTextSummary(wordText({ equivalents: [], definitions: [] }))).toBe('');
    });
});

describe('shortWordTextSummary', () => {
    const definition = (glosses: string[]) => wordText({ equivalents: [], definitions: [{ ...wordText().definitions[0], senses: [{ glosses }] }] });

    it('keeps a summary that fits as it is', () => {
        expect(shortWordTextSummary(wordText())).toBe('想、认为');
    });

    it('keeps whole glosses up to the last separator inside the limit', () => {
        const short = shortWordTextSummary(definition(['表示动作的方向', '表示状态的变化或结果', '用于句末表示强调的语气']));
        expect(short).toBe('表示动作的方向；表示状态的变化或结果');
        expect(short.length).toBeLessThanOrEqual(LOCAL_GLOSS_LENGTH);
    });

    it('cuts one long gloss with an ellipsis', () => {
        const short = shortWordTextSummary(definition(['用于名词之后表示所属关系或者表示动作的对象以及其他种种用法']));
        expect(short).toHaveLength(LOCAL_GLOSS_LENGTH);
        expect(short.endsWith('…')).toBe(true);
    });
});
