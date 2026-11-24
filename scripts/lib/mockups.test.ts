import { describe, expect, it } from 'vitest';
import { escapeHtml, fontLinksOf, gallery, mockupPage, readMockup, shotsOf } from './mockups';

const SRS = '<!-- app: srs -->\n<!-- title: Search row -->\n<main class="p-4">水</main>\n';

describe('readMockup', () => {
    it('reads the app and title a fragment names, and keeps its body', () => {
        expect(readMockup('search-row', SRS)).toEqual({ name: 'search-row', app: 'srs', title: 'Search row', body: '<!-- title: Search row -->\n<main class="p-4">水</main>' });
        expect(readMockup('word', '<!-- app: dictionary -->\n<p>x</p>')).toMatchObject({ app: 'dictionary', title: 'word' });
    });

    it('refuses a fragment that does not say which app it is for', () => {
        expect(() => readMockup('x', '<main></main>')).toThrow(/first line must be/);
    });
});

describe('mockupPage', () => {
    const links = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">';

    it('dresses a gokan-srs fragment as the app: its fonts, its stylesheet, and the dark class for dark', () => {
        const light = mockupPage(readMockup('row', SRS), 'light', links);
        expect(light).toContain('<html lang="en">');
        expect(light).toContain(links);
        expect(light).toContain('href="../srs.css"');
        expect(light).toContain('<body class="bg-background text-primary font-sans">');
        expect(mockupPage(readMockup('row', SRS), 'dark', links)).toContain('<html lang="en" class="dark">');
    });

    it('leaves the dictionary\'s theme to the emulated colour scheme', () => {
        const page = mockupPage(readMockup('w', '<!-- app: dictionary -->\n<p>x</p>'), 'dark', links);
        expect(page).toContain('href="../dictionary.css"');
        expect(page).not.toContain('class="dark"');
        expect(page).not.toContain(links);
    });
});

describe('fontLinksOf', () => {
    it('keeps only the font links of the app\'s index.html', () => {
        const html = '<head>\n  <link rel="preconnect" href="https://fonts.googleapis.com" />\n  <link rel="icon" href="/favicon.svg" />\n  <link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />\n</head>';
        expect(fontLinksOf(html).split('\n')).toEqual(['<link rel="preconnect" href="https://fonts.googleapis.com" />', '<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />']);
    });
});

describe('shots and gallery', () => {
    it('takes a narrow phone, a phone and a desktop shot, light and dark, and shows only the last two', () => {
        expect(shotsOf('row').map(s => s.file)).toEqual(['shots/row-narrow-light.png', 'shots/row-narrow-dark.png', 'shots/row-phone-light.png', 'shots/row-phone-dark.png', 'shots/row-desktop-light.png', 'shots/row-desktop-dark.png']);
        expect(gallery([readMockup('row', SRS)], 'https://x')).not.toContain('narrow');
    });

    it('escapes a title in the page and in the gallery', () => {
        const mockup = readMockup('q', '<!-- app: srs -->\n<!-- title: Tabs <phone> & "desk" -->\n<p>x</p>');
        expect(mockupPage(mockup, 'light', '')).toContain('<title>Tabs &lt;phone&gt; &amp; &quot;desk&quot;</title>');
        expect(gallery([mockup], 'https://x')).toContain('alt="Tabs &lt;phone&gt; &amp; &quot;desk&quot;, phone, light"');
        expect(escapeHtml('a<b')).toBe('a&lt;b');
    });

    it('shows each screen as a table of its four shots, served from the commit', () => {
        const md = gallery([readMockup('row', SRS)], 'https://raw.githubusercontent.com/o/r/abc/mockups/issue-1');
        expect(md).toContain('### Search row');
        expect(md).toContain('<img src="https://raw.githubusercontent.com/o/r/abc/mockups/issue-1/shots/row-phone-dark.png"');
        expect(md.split('\n').filter(line => line.startsWith('| light') || line.startsWith('| dark'))).toHaveLength(2);
    });
});
