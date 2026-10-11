import { describe, expect, it } from 'vitest';
import { MORE_SENTENCES, orderSentences, VISIBLE_SENTENCES } from './sentenceOrder';
import { sentence } from '../test/fixtures';

const KOKO = '1288810';

/** A sentence containing ここ, written as `spelling` at the start. */
function koko(id: string, spelling: string, rest: string, translated = true) {
    return sentence({
        id,
        original: spelling + rest,
        en: translated ? [{ id: `${id}-en`, text: 'Here.' }] : [],
        vocabIds: [KOKO],
        matches: { [KOKO]: [{ start: 0, length: spelling.length, reading: 'ここ' }] },
    });
}

const ids = (sentences: { id: string }[]) => sentences.map(s => s.id);

describe('orderSentences', () => {
    it('puts translated sentences first', () => {
        const order = orderSentences([koko('a', 'ここ', 'はどこですか。', false), koko('b', 'ここ', 'はどこですか、教えて。')], KOKO, 'ここ');
        expect(ids(order)).toEqual(['b', 'a']);
    });

    it('puts the headword spelling before another one', () => {
        const order = orderSentences([koko('a', '此処', 'はどこ。'), koko('b', 'ここ', 'はどこですか。')], KOKO, 'ここ');
        expect(ids(order)).toEqual(['b', 'a']);
    });

    it('counts a conjugated form as the headword spelling', () => {
        const eat = (id: string, original: string) =>
            sentence({ id, original, vocabIds: ['t'], matches: { t: [{ start: 0, length: 2, reading: 'たべ' }] } });
        expect(ids(orderSentences([eat('a', 'たべたいですね。'), eat('b', '食べたいです。ね。')], 't', '食べる'))).toEqual(['b', 'a']);
    });

    it('orders by length, sentences under six characters last', () => {
        const order = orderSentences([koko('long', 'ここ', 'はとても静かな場所です。'), koko('tiny', 'ここ', '。'), koko('short', 'ここ', 'は静かだ。')], KOKO, 'ここ');
        expect(ids(order)).toEqual(['short', 'long', 'tiny']);
    });

    it('keeps at most the visible sentences plus the disclosure', () => {
        const many = Array.from({ length: 30 }, (_, i) => koko(`s${i}`, 'ここ', 'はどこですか。'));
        expect(orderSentences(many, KOKO, 'ここ')).toHaveLength(VISIBLE_SENTENCES + MORE_SENTENCES);
    });
});
