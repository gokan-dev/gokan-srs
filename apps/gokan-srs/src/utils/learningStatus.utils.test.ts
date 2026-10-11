import { describe, expect, it } from 'vitest';
import { STATUS_LABEL } from './learningStatus.utils';

describe('STATUS_LABEL', () => {
    it('names every learning status', () => {
        expect(STATUS_LABEL).toEqual({ new: 'New', learning: 'Learning', mastered: 'Mastered' });
    });
});
