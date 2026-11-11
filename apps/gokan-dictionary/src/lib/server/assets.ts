// The browser-facing assets every page links (the stylesheets and the two plain TypeScript
// scripts), resolved through the asset build's manifest (vite.assets.config.ts), since Vite
// content-hashes their names. That build runs before SvelteKit's, so the manifest is bundled
// into the server here rather than read from disk at run time: the server then carries what its
// pages link wherever it runs.

import { DEFAULT_LOCALE, type ServedLocale } from '../locale';
import { assetPath } from '../urls';

interface ViteManifestEntry {
    file: string;
}

type ViteManifest = Record<string, ViteManifestEntry>;

// A glob, not an import: a missing manifest (the asset build has not run) is then the clear
// error below rather than an unresolved import, and typechecking needs no build.
const found = Object.values(import.meta.glob<ViteManifest>('/dist/.vite/manifest.json', { eager: true, import: 'default' }));

function manifest(): ViteManifest {
    const [only] = found;
    if (found.length !== 1 || only === undefined) {
        throw new Error('[assets] dist/.vite/manifest.json not found: run the asset build (vite build --config vite.assets.config.ts) first.');
    }
    return only;
}

/**
 * assetPath, not a bare '/' + file: in subfolder mode every href on the page has to carry
 * BASE_PATH, and a stylesheet 404 is the one breakage that still renders a plausible-looking
 * (unstyled) page rather than failing loudly.
 */
function asset(entry: string): string {
    const resolved = manifest()[entry] as ViteManifestEntry | undefined;
    if (resolved === undefined) throw new Error(`[assets] ${entry} is not in the asset build's manifest.`);
    return assetPath(resolved.file);
}

/**
 * One stylesheet per page type, so a rule change on one page does not alter the bytes of every
 * other page (which would re-upload the whole site). Pages built purely from shared rules link
 * none.
 */
const PAGE_STYLES = {
    home: 'src/styles/pages/home.scss',
    vocab: 'src/styles/pages/vocab.scss',
    kanji: 'src/styles/pages/kanji.scss',
    kanjiIndex: 'src/styles/pages/kanji-index.scss',
    kanjiOrders: 'src/styles/pages/kanji-orders.scss',
    grammar: 'src/styles/pages/grammar.scss',
    grammarIndex: 'src/styles/pages/grammar-index.scss',
    grammarChapters: 'src/styles/pages/grammar-chapters.scss',
    grammarFamily: 'src/styles/pages/grammar-family.scss',
    grammarConjugations: 'src/styles/pages/grammar-conjugations.scss',
} as const;

export type PageStyle = keyof typeof PAGE_STYLES;

/**
 * A locale's own stylesheet, linked by every page in it after the shared one: its faces, and what
 * only its pages show. English has none, so its pages link what they always have.
 */
const LOCALE_STYLES: Record<Exclude<ServedLocale, typeof DEFAULT_LOCALE>, string> = {
    'zh-hans': 'src/styles/locales/zh-hans.scss',
};

export const localeStylesheetHref = (locale: ServedLocale): string | undefined => (locale === DEFAULT_LOCALE ? undefined : asset(LOCALE_STYLES[locale]));

/** A second script, beside the search one every page links: only the grammar index's filter. */
const PAGE_SCRIPTS = {
    grammarFilter: 'src/client/grammarFilter.ts',
} as const;

export type PageScript = keyof typeof PAGE_SCRIPTS;

export const pageStylesheetHref = (style: PageStyle): string => asset(PAGE_STYLES[style]);
export const pageScriptHref = (script: PageScript): string => asset(PAGE_SCRIPTS[script]);
export const stylesheetHref = (): string => asset('src/styles/app.scss');
/** Linked from every page: the header's search field and the furigana toggle live there. */
export const searchScriptHref = (): string => asset('src/client/search.ts');
