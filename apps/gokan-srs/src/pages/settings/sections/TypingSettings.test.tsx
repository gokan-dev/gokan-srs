import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { userSettings } from '../../../test/fixtures';
import { TypingSettings } from './TypingSettings';

const render = (romajiInput: boolean) =>
    renderToStaticMarkup(<TypingSettings settings={userSettings({ romajiInput })} onUpdateSettings={() => undefined} />);

describe('TypingSettings', () => {
    it('shows the romaji toggle as the setting stands', () => {
        expect(render(true)).toContain('Type romaji as kana');
        expect(render(true)).toMatch(/type="checkbox"[^>]*checked/);
        expect(render(false)).not.toMatch(/type="checkbox"[^>]*checked/);
    });

    it('keeps the kanji keyboard note collapsed', () => {
        const html = render(true);
        expect(html).toContain('Typing kanji');
        expect(html).toContain('aria-expanded="false"');
        expect(html).not.toContain('Windows');
    });
});
