import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Vocabulary } from '@gokan/dataset-schema';
import { userProgress, vocabulary } from '../../../test/fixtures';
import type { MixupGroup, MixupPair } from '../../../utils/mixupGroups.utils';
import type { Mixups } from './useMixups';
import { MixupGroupCard } from './MixupGroupCard';
import { MixupsScreen } from './MixupsScreen';
import { OftenMixedUpWith } from './OftenMixedUpWith';

let mixups: Mixups;

vi.mock('../../../context/useQuiz', () => ({
    useQuiz: () => ({ state: { progress: userProgress(), settings: null }, actions: {} }),
}));
vi.mock('./useMixups', () => ({ useMixups: () => mixups }));

// A word learned in kana, and a word whose file has not loaded (only its id is known).
const KOKO = vocabulary({ id: 'koko', usuallyKana: true, writtenForm: { kanji: '此処', alternatives: [], containedKanji: ['此', '処'] }, reading: { primary: 'ここ', alternatives: [] } });
const MISSING = '1272820';

const pair = (): MixupPair => ({
    words: ['1272820', 'koko'], tier: 'unrelated', curated: false, shared: [],
    directions: [{ asked: 'koko', typed: MISSING, count: 2 }], count: 2, weight: 2,
});
const group = (): MixupGroup => ({ id: 'g', words: ['koko', MISSING], pairs: [pair()], meanings: [], asked: 'koko', weight: 2 });
const loaded = (words: Vocabulary[]): ReadonlyMap<string, Vocabulary> => new Map(words.map(v => [v.id, v]));
// The text a learner reads, without markup: a link's URL carries the id, and should.
const render = (node: ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>).replace(/<[^>]*>/g, ' ');

describe('MixupGroupCard', () => {
    it('shows a word learned in kana with its kanji spelling beside it, never the kana twice', () => {
        const html = render(<MixupGroupCard group={group()} vocabById={loaded([KOKO])} />);
        expect(html).toContain('此処');
    });

    it('never shows the raw id of a word that has not loaded', () => {
        const html = render(<MixupGroupCard group={group()} vocabById={loaded([KOKO])} />);
        expect(html).not.toContain(MISSING);
    });
});

describe('OftenMixedUpWith', () => {
    it('shows a word learned in kana with its kanji spelling, and never a raw id', () => {
        mixups = { pairs: [{ ...pair(), words: ['koko', 'other'] }], groups: [], vocabById: loaded([KOKO]), loading: false, failed: { words: 0, index: false } };
        const shown = render(<OftenMixedUpWith vocabId="other" />);
        expect(shown).toContain('此処');

        mixups = { ...mixups, pairs: [pair()] };
        expect(render(<OftenMixedUpWith vocabId="koko" />)).not.toContain(MISSING);
    });
});

describe('MixupsScreen', () => {
    it('keeps its subtitle when empty, so the tab row stays put between the tabs', () => {
        mixups = { pairs: [], groups: [], vocabById: new Map(), loading: false, failed: { words: 0, index: false } };
        expect(render(<MixupsScreen />)).toContain('0 groups · 0 mix-ups');
    });
});
