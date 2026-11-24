// The mockup stage's pure half (scripts/mockups.ts runs the browser): which app a mockup belongs to,
// the page each fragment becomes, and the screenshots taken of it. A mockup is a body fragment the
// designer agent writes with the app's own classes and tokens; the page around it (fonts, the
// compiled stylesheet, the theme) is assembled here, so every mockup is rendered the same way.

export type MockupApp = 'srs' | 'dictionary';
export type Scheme = 'light' | 'dark';

export interface Viewport {
    name: string;
    width: number;
    height: number;
    /** Shown in the comment's gallery; the rest are rendered for the designer to check. */
    shown: boolean;
}

/**
 * A phone and a desktop, the widths the maintainer looks at (AGENTS.md: 375px and 1280px), and the
 * narrowest phone `check:layout` holds (320px), which the designer checks but the gallery leaves out.
 */
export const VIEWPORTS: readonly Viewport[] = [
    { name: 'narrow', width: 320, height: 640, shown: false },
    { name: 'phone', width: 375, height: 812, shown: true },
    { name: 'desktop', width: 1280, height: 800, shown: true },
];
export const SCHEMES: readonly Scheme[] = ['light', 'dark'];

/** A title the designer wrote, safe in an element and in an attribute. */
export function escapeHtml(text: string): string {
    return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const APP_LINE =/^\s*<!--\s*app:\s*(srs|dictionary)\s*-->/;
const TITLE_LINE = /<!--\s*title:\s*(.+?)\s*-->/;

export interface Mockup {
    /** The fragment's file name without `.html`: its screenshots' prefix. */
    name: string;
    app: MockupApp;
    /** What the screen shows, for the comment; the file name when the fragment names none. */
    title: string;
    body: string;
}

/** A fragment as written: its first line names its app (`<!-- app: srs -->`), a `<!-- title: ... -->` names the screen. */
export function readMockup(name: string, text: string): Mockup {
    const app = APP_LINE.exec(text);
    if (!app) throw new Error(`${name}.html: the first line must be <!-- app: srs --> or <!-- app: dictionary -->.`);
    const title = TITLE_LINE.exec(text)?.[1] ?? name;
    return { name, app: app[1] === 'srs' ? 'srs' : 'dictionary', title, body: text.replace(APP_LINE, '').trim() };
}

/**
 * The page a fragment is rendered in: the app's font links (gokan-srs's index.html; the dictionary
 * serves its own faces from its stylesheet), its compiled stylesheet, and the page colours each app's
 * root sets. gokan-srs's dark theme is the `dark` class on the root, so a dark shot carries it; the
 * dictionary's follows `prefers-color-scheme`, which the browser emulates.
 */
export function mockupPage(mockup: Mockup, scheme: Scheme, fontLinks: string): string {
    const srs = mockup.app === 'srs';
    const root = srs && scheme === 'dark' ? ' class="dark"' : '';
    const head = srs ? fontLinks : '';
    const stylesheet = srs ? 'srs.css' : 'dictionary.css';
    const body = srs ? ' class="bg-background text-primary font-sans"' : '';
    return `<!doctype html>
<html lang="en"${root}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(mockup.title)}</title>
${head}
<link rel="stylesheet" href="../${stylesheet}">
</head>
<body${body}>
${mockup.body}
</body>
</html>
`;
}

/** The `<link>` tags of gokan-srs's index.html that load its fonts, copied so a mockup uses the same faces. */
export function fontLinksOf(indexHtml: string): string {
    return indexHtml.split('\n').map(line => line.trim()).filter(line => line.startsWith('<link') && /fonts\.(googleapis|gstatic)\.com/.test(line)).join('\n');
}

export interface Shot {
    mockup: string;
    viewport: Viewport;
    scheme: Scheme;
    /** Relative to the mockup directory. */
    file: string;
}

/** Every screenshot of a mockup, phone then desktop, light then dark. */
export function shotsOf(mockup: string): Shot[] {
    return VIEWPORTS.flatMap(viewport => SCHEMES.map(scheme => ({ mockup, viewport, scheme, file: `shots/${mockup}-${viewport.name}-${scheme}.png` })));
}

/**
 * The comment's gallery: for each screen, a table of its four shots, each image linked from the commit
 * that holds it (raw.githubusercontent.com serves it as an image to the issue page).
 */
export function gallery(mockups: readonly Mockup[], rawBase: string): string {
    return mockups.map(mockup => {
        const shots = shotsOf(mockup.name).filter(shot => shot.viewport.shown);
        const cell = (shot: Shot): string => `<img src="${rawBase}/${shot.file}" alt="${escapeHtml(mockup.title)}, ${shot.viewport.name}, ${shot.scheme}" width="${shot.viewport.name === 'phone' ? 240 : 480}">`;
        const row = (scheme: Scheme): string => `| ${scheme} | ${shots.filter(s => s.scheme === scheme).map(cell).join(' | ')} |`;
        return [`### ${mockup.title}`, '', '| | Phone (375px) | Desktop (1280px) |', '|---|---|---|', row('light'), row('dark')].join('\n');
    }).join('\n\n');
}
