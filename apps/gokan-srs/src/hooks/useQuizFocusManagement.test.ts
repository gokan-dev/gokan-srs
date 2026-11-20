import { describe, expect, it } from 'vitest';
import { isReplayKey } from './useQuizFocusManagement';

const key = (overrides: Partial<Parameters<typeof isReplayKey>[0]> = {}) =>
    ({ altKey: true, ctrlKey: false, metaKey: false, shiftKey: false, code: 'KeyR', ...overrides });

describe('isReplayKey', () => {
    it('is Alt+R by key position, whatever character Option+R types', () => {
        expect(isReplayKey(key())).toBe(true);
    });

    it('is not R alone (typed into the answer), nor with another modifier (AltGr is Ctrl+Alt)', () => {
        expect(isReplayKey(key({ altKey: false }))).toBe(false);
        expect(isReplayKey(key({ ctrlKey: true }))).toBe(false);
        expect(isReplayKey(key({ metaKey: true }))).toBe(false);
        expect(isReplayKey(key({ shiftKey: true }))).toBe(false);
        expect(isReplayKey(key({ code: 'KeyT' }))).toBe(false);
    });
});
