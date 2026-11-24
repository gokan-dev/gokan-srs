import { describe, it, expect } from 'vitest';
import { drillRouteRole, sessionRouteRole } from './sessionRoutes';

describe('sessionRouteRole', () => {
    it("is the activity on the activity's own page only", () => {
        expect(sessionRouteRole('/quiz', 'vocab')).toBe('activity');
        expect(sessionRouteRole('/grammar', 'grammar')).toBe('activity');
        expect(sessionRouteRole('/grammar', 'vocab')).toBe('leave');
        expect(sessionRouteRole('/quiz', 'grammar')).toBe('leave');
    });

    it('treats word, kanji, grammar point and grammar family pages as consult, for either activity', () => {
        for (const activity of ['vocab', 'grammar'] as const) {
            // Also where a quiz's synonym note opens the word's Synonyms card: looked up, then back.
            expect(sessionRouteRole('/vocab/1263400', activity)).toBe('consult');
            expect(sessionRouteRole('/kanji/%E7%8E%84', activity)).toBe('consult');
            expect(sessionRouteRole('/grammar/n5-001', activity)).toBe('consult');
            expect(sessionRouteRole('/grammar/family/contradiction', activity)).toBe('consult');
        }
    });

    it('does not mistake the grammar list pages for grammar points', () => {
        expect(sessionRouteRole('/grammar/browse', 'vocab')).toBe('leave');
        expect(sessionRouteRole('/grammar/chapters', 'grammar')).toBe('leave');
        expect(sessionRouteRole('/grammar/family', 'grammar')).toBe('leave');
        expect(sessionRouteRole('/grammar/drill', 'grammar')).toBe('leave');
    });

    it('pauses a session for a contrast drill: practice outside the SRS, come back from', () => {
        for (const activity of ['vocab', 'grammar'] as const) {
            expect(sessionRouteRole('/grammar/drill/lesson/causality/reason-core', activity)).toBe('consult');
            expect(sessionRouteRole('/grammar/drill/point/n4-110', activity)).toBe('consult');
        }
    });

    it('ends the session on the Vocabulary list and the Kanji page, but not on a word or kanji', () => {
        for (const activity of ['vocab', 'grammar'] as const) {
            expect(sessionRouteRole('/vocab', activity)).toBe('leave');
            expect(sessionRouteRole('/kanji', activity)).toBe('leave');
            expect(sessionRouteRole('/vocab/1263400', activity)).toBe('consult');
            expect(sessionRouteRole('/kanji/%E5%AD%A6', activity)).toBe('consult');
        }
    });

    it('ends the session everywhere else', () => {
        for (const path of ['/', '/stats', '/settings', '/profile', '/about', '/vocab', '/kanji']) {
            expect(sessionRouteRole(path, 'vocab')).toBe('leave');
        }
    });
});

describe('drillRouteRole', () => {
    const drill = '/grammar/drill/lesson/causality/reason-core';
    it('keeps a drill on its page and on a lookup, and ends it anywhere else', () => {
        expect(drillRouteRole(drill, drill)).toBe('activity');
        expect(drillRouteRole('/vocab/1263400', drill)).toBe('consult');
        expect(drillRouteRole('/grammar/n4-110', drill)).toBe('consult');
        expect(drillRouteRole('/stats', drill)).toBe('leave');
        expect(drillRouteRole('/grammar', drill)).toBe('leave');
    });
});
