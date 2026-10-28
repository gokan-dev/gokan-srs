import { describe, expect, it } from 'vitest';
import { sentence } from '../test/fixtures';
import { indexLearnerVocab } from './sentenceRanking';
import { pickWordExamples } from './wordExamples.utils';

const learner = indexLearnerVocab([]);
const GLOSSES = ['to take', 'to pick up'];
const en = (text: string) => [{ id: 'en', text }];

describe('pickWordExamples', () => {
    it('puts a sentence whose English uses the first sense first, even a longer one', () => {
        const short = sentence({ id: 'short', original: 'とる。', en: en('He got it.') });
        const long = sentence({ id: 'long', original: 'それを手にとってください。ありがとう。', en: en('Please pick up that one for me.') });
        expect(pickWordExamples('v1', [short, long], GLOSSES, learner).map(s => s.id)).toEqual(['long', 'short']);
    });

    it('prefers the shorter of two that both use it', () => {
        const short = sentence({ id: 'short', original: 'とって。', en: en('Take it.') });
        const long = sentence({ id: 'long', original: 'あのとき、あれをとってくれたのはだれでしたか。', en: en('Who was it that took that for me back then?') });
        expect(pickWordExamples('v1', [long, short], GLOSSES, learner, 1).map(s => s.id)).toEqual(['short']);
    });

    it('leaves out a sentence with no English line, and shows at most two', () => {
        const sentences = [
            sentence({ id: 'a', original: 'あ', en: [] }),
            sentence({ id: 'b', original: 'い', en: en('Take one.') }),
            sentence({ id: 'c', original: 'う', en: en('Take two.') }),
            sentence({ id: 'd', original: 'え', en: en('Take three.') }),
        ];
        const picked = pickWordExamples('v1', sentences, GLOSSES, learner);
        expect(picked).toHaveLength(2);
        expect(picked.map(s => s.id)).not.toContain('a');
    });

    it('picks the same two on every visit, whatever order they load in', () => {
        const sentences = ['a', 'b', 'c', 'd'].map(id => sentence({ id, original: id, en: en('Take it.') }));
        const once = pickWordExamples('v1', sentences, GLOSSES, learner).map(s => s.id);
        expect(pickWordExamples('v1', [...sentences].reverse(), GLOSSES, learner).map(s => s.id)).toEqual(once);
    });

    it('shows nothing for a word with no sentence', () => {
        expect(pickWordExamples('v1', [], GLOSSES, learner)).toEqual([]);
    });
});
