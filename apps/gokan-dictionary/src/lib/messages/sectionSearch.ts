// What a detail page's section search says (client/detailTabs.ts), per locale: apart from the page
// catalog and the header search's words, so the detail script bundles these words alone and a word
// changed elsewhere does not rename it.

import type { Locale } from '../locale';

export interface SectionSearchMessages {
    /** The count line under a section's field while it is filtered: "3 of 15 match “eat”". */
    matches: (matched: number, total: number, query: string) => string;
}

const MESSAGES: Record<Locale, SectionSearchMessages> = {
    en: { matches: (matched, total, query) => `${matched.toLocaleString('en')} of ${total.toLocaleString('en')} match${matched === 1 ? 'es' : ''} “${query}”` },
    'zh-hans': { matches: (matched, total, query) => `${total.toLocaleString('en')} 项中有 ${matched.toLocaleString('en')} 项匹配“${query}”` },
};

export function sectionSearchMessagesFor(locale: Locale): SectionSearchMessages {
    return MESSAGES[locale];
}
