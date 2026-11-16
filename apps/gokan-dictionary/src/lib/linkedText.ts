// A catalog's sentence (`LinkedText`) as the attributes each run renders with, for
// pages/LinkedText.svelte: one place that decides a run's lang, its link, the link's hreflang
// (lib/localeLinks.ts) and, for a link into the app, the click Umami counts (lib/appLinks.ts).

import { APP_LINK_EVENT } from './appLinks';
import type { LinkedText } from './messages';

/** A marked run, ready to render: a link when it has an href, else a span in its language. */
export interface RenderedRun {
    text: string;
    lang?: string;
    href?: string;
    hreflang?: string;
    event?: string;
    placement?: string;
}

/** Every run of a sentence, plain runs left as they are; `linkLang` is the page's (pageLocale). */
export function renderedRuns(parts: LinkedText, linkLang: (href: string) => string | undefined): (string | RenderedRun)[] {
    return parts.map(part => {
        if (typeof part === 'string') return part;
        const { text, lang, href, placement } = part;
        if (href === undefined) return { text, lang };
        return { text, lang, href, hreflang: linkLang(href), event: placement && APP_LINK_EVENT, placement };
    });
}
