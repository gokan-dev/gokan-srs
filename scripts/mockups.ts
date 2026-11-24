/**
 * The mockup stage's renderer (claude-mockups.yml): `bun scripts/mockups.ts render <dir>` turns the
 * designer agent's fragments in `<dir>/*.html` into pages styled by the apps' own stylesheets and
 * screenshots each at 375px and 1280px, light and dark (`<dir>/shots/`); `gallery <dir> <rawBase>`
 * prints the comment's images. The agent runs `render` itself to look at its work before it ends.
 *
 * gokan-srs's stylesheet is its `index.css` compiled by Tailwind with the mockups as an extra source,
 * so every class the fragment uses exists and every token resolves as in the app. The dictionary's is
 * its SCSS, `app.scss` and every page stylesheet, compiled by Sass.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchChrome } from './lib/chrome';
import { type Mockup, fontLinksOf, gallery, mockupPage, readMockup, SCHEMES, shotsOf } from './lib/mockups';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function readMockups(dir: string): Mockup[] {
    const files = readdirSync(dir).filter(file => file.endsWith('.html')).sort();
    if (files.length === 0) throw new Error(`No mockup in ${dir}: write one <name>.html fragment per screen.`);
    return files.map(file => readMockup(file.slice(0, -'.html'.length), readFileSync(join(dir, file), 'utf8')));
}

function run(command: string[], cwd: string): void {
    const [cmd, ...args] = command;
    const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) throw new Error(`${command.join(' ')} exited with ${String(result.status)}.`);
}

function compileStyles(dir: string, mockups: readonly Mockup[]): void {
    if (mockups.some(m => m.app === 'srs')) {
        const indexCss = relative(dir, join(ROOT, 'apps/gokan-srs/src/index.css')).replaceAll('\\', '/');
        writeFileSync(join(dir, 'srs.entry.css'), `@import "${indexCss}";\n@source "./";\n`);
        // The repository's pinned @tailwindcss/cli (bunx outside the repository fetches the latest),
        // run from the mockup folder: Tailwind detects sources from its working directory, and from
        // the repository root it would scan the whole dataset.
        run(['bun', join(ROOT, 'node_modules/@tailwindcss/cli/dist/index.mjs'), '-i', 'srs.entry.css', '-o', 'srs.css'], dir);
    }
    if (mockups.some(m => m.app === 'dictionary')) {
        const styles = join(ROOT, 'apps/gokan-dictionary/src/styles');
        const sheets = ['app.scss', ...readdirSync(join(styles, 'pages')).filter(f => f.endsWith('.scss')).map(f => `pages/${f}`)];
        const out: string[] = [];
        for (const sheet of sheets) {
            const css = join(dir, `dictionary-${sheet.replaceAll('/', '-')}.css`);
            run(['bunx', 'sass', '--no-source-map', `--load-path=${styles}`, join(styles, sheet), css], ROOT);
            out.push(readFileSync(css, 'utf8'));
        }
        writeFileSync(join(dir, 'dictionary.css'), out.join('\n'));
    }
}

async function render(dir: string): Promise<void> {
    const mockups = readMockups(dir);
    compileStyles(dir, mockups);
    const fontLinks = fontLinksOf(readFileSync(join(ROOT, 'apps/gokan-srs/index.html'), 'utf8'));
    mkdirSync(join(dir, 'pages'), { recursive: true });
    mkdirSync(join(dir, 'shots'), { recursive: true });
    for (const mockup of mockups) {
        for (const scheme of SCHEMES) writeFileSync(join(dir, 'pages', `${mockup.name}-${scheme}.html`), mockupPage(mockup, scheme, fontLinks));
    }
    const chrome = await launchChrome();
    try {
        for (const mockup of mockups) {
            for (const shot of shotsOf(mockup.name)) {
                const tab = await chrome.openTab(shot.viewport.width, shot.viewport.height);
                await tab.colorScheme(shot.scheme);
                // Fonts come from the network: wait for them, or the shot shows the fallback face.
                await tab.goto(pathToFileURL(join(dir, 'pages', `${mockup.name}-${shot.scheme}.html`)).href, '');
                await tab.until('document.fonts.status === "loaded"', 'the fonts', 15000);
                writeFileSync(join(dir, shot.file), await tab.screenshot());
                await tab.close();
                console.log(`${shot.file}`);
            }
        }
    } finally {
        await chrome.kill();
    }
}

const [command, dirArg, rawBase] = process.argv.slice(2);
if (!dirArg) throw new Error('Usage: bun scripts/mockups.ts render <dir> | gallery <dir> <rawBase>');
const dir = resolve(dirArg);
switch (command) {
    case 'render':
        await render(dir);
        break;
    case 'gallery':
        if (!rawBase) throw new Error('gallery needs the raw URL base the shots are served from.');
        console.log(gallery(readMockups(dir), rawBase));
        break;
    default:
        throw new Error(`Unknown command: ${command ?? '(none)'}. Use render or gallery.`);
}
