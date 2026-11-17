import { describe, expect, it } from 'vitest';
import { APP_LINK_EVENT } from './appLinks';
import { renderedRuns } from './linkedText';
import type { LinkedText } from './messages';

describe('renderedRuns', () => {
    const toEnglish = (href: string) => (href.startsWith('/k/') ? 'en' : undefined);

    it('keeps a run\'s language and its link together, the app link counted', () => {
        const parts: LinkedText = ['See ', { text: '学', lang: 'ja', href: '/k/学/' }, ' or ', { text: 'Gokan SRS', href: 'https://gokan-srs.com/', placement: 'footer' }];
        expect(renderedRuns(parts, toEnglish)).toEqual([
            'See ',
            { text: '学', lang: 'ja', href: '/k/学/', hreflang: 'en', event: undefined, placement: undefined },
            ' or ',
            { text: 'Gokan SRS', lang: undefined, href: 'https://gokan-srs.com/', hreflang: undefined, event: APP_LINK_EVENT, placement: 'footer' },
        ]);
    });

    it('leaves a run with no href a span in its language', () => {
        expect(renderedRuns([{ text: '学生', lang: 'ja' }], toEnglish)).toEqual([{ text: '学生', lang: 'ja' }]);
    });
});
