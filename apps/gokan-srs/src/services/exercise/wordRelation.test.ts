import { describe, it, expect } from 'vitest';
import { headwordOf } from '@gokan/dataset-schema';
import type { VocabSynonym } from '@gokan/dataset-schema';
import type { ProductionCue } from '../../utils/synonymContext.utils';
import { gradeSlot } from './grading';
import { wordSlot } from './slots';
import type { SynonymCandidate } from './types';
import { OUTCOME_LOOK, orderSynonymsForCue, outcomeOf, pairWith, relationOf, synonymNote, synonymsOf } from './wordRelation';
import type { WordPair } from './wordRelation';

const candidateOf = (entry: VocabSynonym): SynonymCandidate => synonymsOf({ synonyms: [entry] })[0];
const outcome = (pair: WordPair, cue: ProductionCue) => outcomeOf(relationOf(pair, cue));

/** The candidate a production card for 玄関 would identify `input` as, if any. */
function identified(input: string, candidate: SynonymCandidate): string | undefined {
    const genkan = wordSlot(
        { reading: { primary: 'げんかん', alternatives: [] }, writtenForm: { kanji: '玄関', alternatives: [], containedKanji: ['玄', '関'] } },
        { otherForm: 'correct', role: 'core', candidates: [candidate] },
    );
    return gradeSlot(genkan, input, 0, {}).synonym?.vocabId;
}

describe('relationOf', () => {
    it('reads the tier, whether it was curated, and which shared meaning the cue uses', () => {
        expect(relationOf({ relation: 'interchangeable', shared: ['little', 'small'] }, { sentence: 'Japan is a small country.' }))
            .toEqual({ tier: 'interchangeable', curated: false, shared: ['little', 'small'], meaning: 'small' });
        expect(relationOf({ relation: 'confusable', shared: ['little'], curated: true }, { sentence: 'Japan is a small country.' }))
            .toEqual({ tier: 'confusable', curated: true, shared: ['little'], meaning: null });
    });
});

describe('outcomeOf: the one table', () => {
    const inCue = { sentence: 'Japan is a small country.' };
    const outOfCue = { sentence: 'The street is narrow.' };

    it('is correct in context, whatever the out-of-context tier', () => {
        expect(outcome({ relation: 'confusable', shared: ['small'] }, inCue)).toBe('correct');
        expect(outcome({ relation: 'interchangeable', shared: ['small'] }, inCue)).toBe('correct');
    });

    it('lets the auto tier decide out of context (restored, issue #150)', () => {
        expect(outcome({ relation: 'interchangeable', shared: ['small'] }, outOfCue)).toBe('minor_error');
        expect(outcome({ relation: 'confusable', shared: ['small'] }, outOfCue)).toBe('confusable');
    });

    // The reported case: 止む shares "stop" with 埋める ("to stop (a gap)"). The pair is
    // curated confusable in the dataset, so restoring the auto tier does not bring it back.
    it('gives 止む no credit on a "fill" card for 埋める, as the curated pair it is', () => {
        const yamu = { relation: 'confusable' as const, shared: ['stop'], curated: true };
        expect(outcome(yamu, { sentence: 'Fill in the blanks.' })).toBe('confusable');
        expect(outcome(yamu, { sentence: 'Stop the gap with cloth.' })).toBe('confusable');
    });

    it('keeps a curated interchangeable pair a minor error out of context', () => {
        expect(outcome({ relation: 'interchangeable', shared: ['small'], curated: true }, outOfCue)).toBe('minor_error');
    });

    it('never upgrades a curated confusable pair (必ず / 常に share "always")', () => {
        expect(outcome({ relation: 'confusable', shared: ['always'], curated: true }, { sentence: 'He is always late.' })).toBe('confusable');
        expect(outcome({ relation: 'interchangeable', shared: ['all'], curated: true }, { sentence: 'I ate it all.' })).toBe('correct');
    });

    it('reads data built before `shared` existed as out of context', () => {
        expect(outcome({ relation: 'interchangeable' }, inCue)).toBe('minor_error');
    });
});

describe('OUTCOME_LOOK: how each outcome reads everywhere', () => {
    it('credits the typed word and draws as accepted whenever the synonym answers the card', () => {
        expect(OUTCOME_LOOK.correct).toEqual({ result: 'correct', neutral: false, creditsTyped: true, accepted: true });
        expect(OUTCOME_LOOK.minor_error).toEqual({ result: 'minor_error', neutral: false, creditsTyped: true, accepted: true });
    });

    it('makes a confusable synonym neutral: a miss left out of the result, crediting nobody', () => {
        expect(OUTCOME_LOOK.confusable).toEqual({ result: 'wrong', neutral: true, creditsTyped: false, accepted: false });
    });

    it('names both words in the note', () => {
        expect(synonymNote('correct', '小さい (ちいさい)', '狭い (せまい)', 'small')).toBe('小さい (ちいさい) also means "small" here. The word being tested was 狭い (せまい).');
        expect(synonymNote('minor_error', 'A', 'B', null)).toBe('A is also accepted here - the word being tested was B.');
        expect(synonymNote('confusable', 'A', 'B', null)).toBe('A is a close synonym but not interchangeable here - the word being tested was B.');
    });
});

describe('pairWith', () => {
    it('finds the pair a word forms with another, or null', () => {
        const entry: VocabSynonym = { id: 'b', relation: 'confusable', shared: ['x'], w: [], r: ['び'] };
        expect(pairWith({ synonyms: [entry] }, 'b')).toBe(entry);
        expect(pairWith({ synonyms: [entry] }, 'c')).toBeNull();
        expect(pairWith({}, 'b')).toBeNull();
    });
});

describe('orderSynonymsForCue', () => {
    it('puts entries whose shared meaning the cue uses first, keeping order otherwise', () => {
        const entries = [
            { id: 'a', relation: 'confusable' as const, shared: ['narrow'] },
            { id: 'b', relation: 'confusable' as const, shared: ['small'] },
            { id: 'c', relation: 'confusable' as const, shared: ['tiny'] },
        ];
        expect(orderSynonymsForCue(entries, { sentence: 'Japan is a small country.' }).map(e => e.id)).toEqual(['b', 'a', 'c']);
    });
});

describe('synonymsOf (grading without fetching the other word)', () => {
    // 玄関's entry for 登場, as the dataset embeds it.
    const toujou: VocabSynonym = { id: '1444800', relation: 'confusable', shared: ['entrance'], overlap: 0.17, w: ['登場'], r: ['とうじょう'], pos: ['vs'] };

    it('builds a candidate the production grader matches by reading or written form', () => {
        const candidate = candidateOf(toujou);
        expect(candidate.vocab.writtenForm.kanji).toBe('登場');
        expect(candidate.vocab.reading.primary).toBe('とうじょう');
        expect(identified('とうじょう', candidate)).toBe('1444800');
        expect(identified('登場', candidate)).toBe('1444800');
        expect(identified('ねこ', candidate)).toBeUndefined();
    });

    it('carries the shared glosses and tier through, so context grading is unchanged', () => {
        const candidate = candidateOf(toujou);
        expect(outcome(candidate, { sentence: "Let's take off our shoes at the entrance." })).toBe('correct');
        expect(outcome(candidate, { glosses: ['front door'] })).toBe('confusable');
    });

    it('keeps alternatives and the inflecting POS, so a conjugated synonym still matches', () => {
        const candidate = candidateOf({ id: 'x', relation: 'interchangeable', w: ['並べる', '列べる'], r: ['ならべる'], pos: ['v1'] });
        expect(identified('列べる', candidate)).toBe('x');
        expect(identified('並べた', candidate)).toBe('x');
    });

    it('marks a word learned in kana, so the feedback names it by its kana', () => {
        const kana = candidateOf({ id: 'x', relation: 'confusable', w: ['此処'], r: ['ここ'], u: true });
        expect(headwordOf(kana.vocab)).toBe('ここ');
        // Typing its rare kanji spelling still identifies it.
        expect(identified('此処', kana)).toBe('x');
        expect(headwordOf(candidateOf(toujou).vocab)).toBe('登場');
    });

    it('names a kana-only word by its reading', () => {
        const kitto = candidateOf({ id: 'k', relation: 'interchangeable', w: [], r: ['きっと'] });
        expect(kitto.vocab.writtenForm.kanji).toBe('きっと');
        expect(identified('きっと', kitto)).toBe('k');
    });
});
