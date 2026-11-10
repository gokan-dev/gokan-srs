// The links a page in one locale writes, to the pages that exist: a page in another locale links
// to a page in its own language only when that page is served (#226: today a word with text shown
// in it, LocaleText.wordText), and to English's page otherwise, so no link on it leads to a 404.
// The page model says which linked words have a page (VocabPageProps.wordsInLocale); this is the
// one place a link is built from that, so no component decides. urls.ts stays a plain path builder.

import { DEFAULT_LOCALE, type ServedLocale } from './locale';
import { localeUrls, type LocaleUrls } from './urls';

/**
 * Every path a page in `locale` links: English's, but a word in `wordsWithPages` at its page in
 * the locale. A locale's kanji, grammar and list pages are not served yet (pages.ts,
 * pagesInEnglishOnly), so those links are English's; English's page links its own paths.
 */
export function linkUrls(locale: ServedLocale, wordsWithPages: ReadonlySet<string>): LocaleUrls {
    const english = localeUrls(DEFAULT_LOCALE);
    if (locale === DEFAULT_LOCALE) return english;
    const own = localeUrls(locale);
    return { ...english, vocabPath: id => (wordsWithPages.has(id) ? own.vocabPath(id) : english.vocabPath(id)) };
}
