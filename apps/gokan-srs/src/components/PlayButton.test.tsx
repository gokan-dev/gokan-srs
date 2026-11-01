import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayButton } from './PlayButton';

describe('PlayButton', () => {
    it('renders nothing, never a disabled button, for an item with no clip', () => {
        expect(renderToStaticMarkup(<PlayButton audio={undefined} label="Play sentence" />)).toBe('');
    });
});
