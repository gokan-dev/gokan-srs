import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TabNav } from './TabNav';

const tabs = [
    { key: 'dict' as const, label: 'Dict', id: 'tab-dict', controls: 'panel-dict' },
    { key: 'kanji' as const, label: 'Kanji', id: 'tab-kanji', controls: 'panel-kanji' },
];

describe('TabNav, page tabs', () => {
    const html = renderToStaticMarkup(<TabNav label="About this word" tabs={tabs} selected="kanji" onSelect={() => undefined} />);

    it('is an ARIA tab list of buttons, each naming its panel', () => {
        expect(html).toContain('role="tablist"');
        expect(html).toContain('aria-label="About this word"');
        expect(html.match(/role="tab"/g)).toHaveLength(2);
        expect(html).toContain('aria-controls="panel-dict"');
        expect(html).toContain('id="tab-kanji"');
    });

    it('selects one tab, the only one reached by Tab (the arrows move between them)', () => {
        expect(html).toMatch(/id="tab-kanji"[^>]*aria-selected="true"[^>]*tabindex="0"/);
        expect(html).toMatch(/id="tab-dict"[^>]*aria-selected="false"[^>]*tabindex="-1"/);
    });
});
