import { describe, it, expect } from 'vitest';
import { sessionRouteRole } from './sessionRoutes';

describe('sessionRouteRole', () => {
    it("is the activity on the activity's own page only", () => {
        expect(sessionRouteRole('/quiz', 'vocab')).toBe('activity');
        expect(sessionRouteRole('/grammar', 'grammar')).toBe('activity');
        expect(sessionRouteRole('/grammar', 'vocab')).toBe('leave');
        expect(sessionRouteRole('/quiz', 'grammar')).toBe('leave');
    });

    it('treats word, kanji, grammar point and grammar family pages as consult, for either activity', () => {
        for (const activity of ['vocab', 'grammar'] as const) {
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
    });

    it('ends the session everywhere else', () => {
        for (const path of ['/', '/stats', '/settings', '/profile', '/about', '/vocab', '/kanji']) {
            expect(sessionRouteRole(path, 'vocab')).toBe('leave');
        }
    });
});
