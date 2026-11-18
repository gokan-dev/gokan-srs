import { describe, expect, it } from 'vitest';
import { audioUrl } from './audio';

describe('audioUrl', () => {
    it('names a clip by its content key and extension, with no dataset version', () => {
        // A clip's key changes with its content, so a version would only stop browsers sharing a cached clip across datasets.
        expect(audioUrl('0123456789abcdef', 'opus')).toBe('/audio/0123456789abcdef.opus');
    });
});
