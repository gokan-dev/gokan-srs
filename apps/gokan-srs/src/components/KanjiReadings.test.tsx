import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { kanji } from '../test/fixtures';
import { KanjiReadings } from './KanjiReadings';

describe('KanjiReadings', () => {
    it('lets a line break after each 、, so a reading starting with a hyphen can start a line', () => {
        // 回: a line may not break before a hyphen-minus, so without a break opportunity between
        // readings the row ran past its column (今回's Kanji tab at 320px, the side column at 1024px).
        const html = renderToStaticMarkup(<KanjiReadings kanji={kanji({ character: '回', readings: { on: ['カイ', 'エ'], kun: ['まわ.る', '-まわ.る', '-まわ.り'], nanori: [] } })} size="compact" />);
        const kun = /<dt[^>]*>Kun<\/dt><dd[^>]*>(.*?)<\/dd>/.exec(html)?.[1] ?? '';
        expect(kun.split('<wbr/>').map(part => part.replace(/<[^>]+>/g, ''))).toEqual(['まわ(る)、', '-まわ(る)、', '-まわ(り)']);
    });
});
