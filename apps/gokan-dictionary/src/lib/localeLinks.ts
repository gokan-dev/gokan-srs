// The links a page in one locale writes, to the pages that exist. A locale's section serves some
// page types (today Chinese's word pages, its home, its vocabulary lists and its search, #170) and links those
// in its own language; a page type it does not serve yet (a kanji, a grammar point, a kanji order)
// is linked at English's page, and that link says so (`linkLang`: hreflang="en", and a mark a
// reader sees). A word the section has no page for is not linked from it: its page model leaves it
// out, or shows it unlinked (lib/server/pages.ts). This is the one place a locale's links are
// chosen, so no component decides; urls.ts stays a plain path builder.

import { DEFAULT_LOCALE, type Locale } from './locale';
import { localeUrls, type LocaleUrls } from './urls';

/**
 * Every path a page in `locale` links: the section's own for the page types it serves, English's
 * for the others. English's page links its own paths.
 */
export function linkUrls(locale: Locale): LocaleUrls {
    const english = localeUrls(DEFAULT_LOCALE);
    if (locale === DEFAULT_LOCALE) return english;
    const own = localeUrls(locale);
    return {
        ...english,
        homePath: () => own.homePath(),
        vocabIndexPath: () => own.vocabIndexPath(),
        vocabJlptPath: (level, page) => own.vocabJlptPath(level, page),
        vocabPath: id => own.vocabPath(id),
        // Its search page, over its own index (#228): the search field submits here.
        searchPath: query => own.searchPath(query),
    };
}

/** Whether `href` is a page of `locale`'s own section. */
export function inSection(locale: Locale, href: string): boolean {
    return href.startsWith(localeUrls(locale).homePath());
}

/**
 * The hreflang of a link on a page in `locale`: "en" for one that leaves a section other than
 * English's (an English page, the dataset's repository, the app), so a reader and a crawler are
 * told where it leads; none otherwise, and none on an English page, whose links are all English.
 */
export function linkLang(locale: Locale, href: string): 'en' | undefined {
    return locale === DEFAULT_LOCALE || inSection(locale, href) ? undefined : 'en';
}
