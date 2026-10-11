import { describe, expect, it } from 'vitest';
import { conjugate, deinflect, wordClassOf, type FormLabel, type WordClass } from './conjugation';

function formsOf(word: string, wordClass: WordClass): Partial<Record<FormLabel, string>> {
    return Object.fromEntries(conjugate(word, wordClass).map(({ label, form }) => [label, form]));
}

describe('conjugate', () => {
    it('conjugates an ichidan verb', () => {
        expect(formsOf('食べる', 'ichidan')).toMatchObject({
            polite: '食べます', negative: '食べない', past: '食べた', 'past-negative': '食べなかった',
            'polite-past-negative': '食べませんでした', te: '食べて', potential: '食べられる',
            passive: '食べられる', causative: '食べさせる', 'causative-passive': '食べさせられる',
            volitional: '食べよう', imperative: '食べろ', ba: '食べれば', tara: '食べたら',
        });
    });

    it('conjugates godan verbs by their ending', () => {
        expect(formsOf('書く', 'godan')).toMatchObject({ te: '書いて', past: '書いた', negative: '書かない', potential: '書ける', volitional: '書こう' });
        expect(formsOf('泳ぐ', 'godan')).toMatchObject({ te: '泳いで', ba: '泳げば' });
        expect(formsOf('話す', 'godan')).toMatchObject({ te: '話して', polite: '話します' });
        expect(formsOf('待つ', 'godan')).toMatchObject({ te: '待って', imperative: '待て' });
        expect(formsOf('死ぬ', 'godan')).toMatchObject({ te: '死んで', causative: '死なせる' });
        expect(formsOf('遊ぶ', 'godan')).toMatchObject({ past: '遊んだ' });
        expect(formsOf('読む', 'godan')).toMatchObject({ passive: '読まれる' });
        expect(formsOf('帰る', 'godan')).toMatchObject({ te: '帰って', negative: '帰らない' });
        expect(formsOf('買う', 'godan')).toMatchObject({ negative: '買わない', te: '買って' });
    });

    it('conjugates the irregular verbs', () => {
        expect(formsOf('する', 'suru')).toMatchObject({ negative: 'しない', potential: 'できる', ba: 'すれば' });
        expect(formsOf('勉強する', 'suru')).toMatchObject({ past: '勉強した', causative: '勉強させる' });
        expect(formsOf('来る', 'kuru')).toMatchObject({ negative: '来ない', imperative: '来い' });
        expect(formsOf('くる', 'kuru')).toMatchObject({ negative: 'こない', polite: 'きます', ba: 'くれば' });
        expect(formsOf('行く', 'godan-iku')).toMatchObject({ te: '行って', past: '行った', negative: '行かない' });
        expect(formsOf('ある', 'godan-aru')).toMatchObject({ negative: 'ない', 'past-negative': 'なかった', polite: 'あります' });
        expect(formsOf('問う', 'godan-tou')).toMatchObject({ te: '問うて', past: '問うた' });
        expect(formsOf('請う', 'godan-tou')).toMatchObject({ te: '請うて' });
    });

    it('leaves out the forms ある does not use', () => {
        expect(formsOf('ある', 'godan-aru').potential).toBeUndefined();
    });

    it('conjugates i-adjectives, いい on よ', () => {
        expect(formsOf('高い', 'i-adj')).toMatchObject({
            negative: '高くない', past: '高かった', 'past-negative': '高くなかった', te: '高くて', ba: '高ければ', polite: '高いです',
        });
        expect(formsOf('いい', 'i-adj-ii')).toMatchObject({ plain: 'いい', negative: 'よくない', past: 'よかった' });
        expect(formsOf('かっこいい', 'i-adj-ii')).toMatchObject({ past: 'かっこよかった' });
        expect(formsOf('良い', 'i-adj-ii')).toMatchObject({ past: '良かった' });
        expect(formsOf('高い', 'i-adj').potential).toBeUndefined();
    });

    it('returns nothing for a word that does not fit its class', () => {
        expect(conjugate('本', 'godan')).toEqual([]);
    });
});

describe('deinflect', () => {
    const CASES: [string, WordClass][] = [
        ['食べる', 'ichidan'], ['たべる', 'ichidan'], ['書く', 'godan'], ['泳ぐ', 'godan'], ['話す', 'godan'],
        ['待つ', 'godan'], ['死ぬ', 'godan'], ['遊ぶ', 'godan'], ['読む', 'godan'], ['帰る', 'godan'],
        ['買う', 'godan'], ['する', 'suru'], ['勉強する', 'suru'], ['来る', 'kuru'], ['くる', 'kuru'],
        ['行く', 'godan-iku'], ['いく', 'godan-iku'], ['ある', 'godan-aru'], ['問う', 'godan-tou'],
        ['請う', 'godan-tou'], ['高い', 'i-adj'], ['いい', 'i-adj-ii'], ['よい', 'i-adj'],
    ];

    it.each(CASES)('finds %s from every form conjugate builds', (word, wordClass) => {
        for (const { form, label } of conjugate(word, wordClass)) {
            if (label === 'plain') continue;
            const candidates = deinflect(form).filter(c => c.wordClass === wordClass).map(c => c.form);
            expect(candidates, `${form} (${label})`).toContain(word);
        }
    });

    it('reads a form of a derived form in two steps', () => {
        expect(deinflect('食べられなかった')).toContainEqual({ form: '食べる', wordClass: 'ichidan', label: 'past-negative' });
        expect(deinflect('行きたくない')).toContainEqual({ form: '行く', wordClass: 'godan-iku', label: 'negative' });
    });

    it('names the form the query was read as', () => {
        expect(deinflect('食べた')).toContainEqual({ form: '食べる', wordClass: 'ichidan', label: 'past' });
    });

    it('does not read a bare ending as a whole word of a regular class', () => {
        expect(deinflect('た').some(c => c.form === 'る')).toBe(false);
    });
});

describe('wordClassOf', () => {
    it('maps JMdict verb and adjective tags', () => {
        expect(wordClassOf(['v1', 'vt'])).toBe('ichidan');
        expect(wordClassOf(['v5k-s', 'vi'])).toBe('godan-iku');
        expect(wordClassOf(['adj-ix'])).toBe('i-adj-ii');
        expect(wordClassOf(['vs-i'])).toBe('suru');
    });

    it('returns null for words that do not conjugate', () => {
        expect(wordClassOf(['n', 'adj-no'])).toBeNull();
        expect(wordClassOf(['adj-na'])).toBeNull();
    });
});
