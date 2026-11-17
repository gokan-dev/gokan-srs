import { describe, expect, it } from 'vitest';
import { sectionSearchMessagesFor } from './sectionSearch';

describe('sectionSearchMessagesFor', () => {
    it('says how many rows of a section match, in each locale', () => {
        expect(sectionSearchMessagesFor('en').matches(3, 1030, 'eat')).toBe('3 of 1,030 match “eat”');
        expect(sectionSearchMessagesFor('en').matches(1, 15, 'eat')).toBe('1 of 15 matches “eat”');
        expect(sectionSearchMessagesFor('zh-hans').matches(3, 15, '吃')).toBe('15 项中有 3 项匹配“吃”');
    });
});
