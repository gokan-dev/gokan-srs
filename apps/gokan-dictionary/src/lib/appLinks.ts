// Every link from the dictionary into the SRS app (#244): one builder, so no page writes a query
// string by hand. Each link opens the app's onboarding filled in from what the page was about (the
// order and kanji count gokan-srs #243 reads) and names the placement it sat in, both for Umami's
// UTM report (where the visit landed) and for the click itself (`APP_LINK_EVENT`, counted by the
// Umami script every production page already loads, with no script of ours: static attributes, so
// pages stay byte-identical between builds).

import { DICTIONARY_SOURCE, SETUP_LINK_PARAMS, type DictionaryPlacement } from '@gokan/analytics';
import type { KanjiOrderId } from '@gokan/dataset-schema';
import { SITE_ORIGIN } from './site';

/** The Umami event a link into the app carries (`data-umami-event`), its placement beside it. */
export const APP_LINK_EVENT = 'app_link';

/** A link into the app: where it leads, and the placement its click is counted under. */
export interface AppLink {
    href: string;
    placement: DictionaryPlacement;
}

export interface AppLinkTarget {
    placement: DictionaryPlacement;
    /** The app's page to open once setup is done (`/vocab/1358280`): the app's root without one. */
    path?: string;
    /** The kanji order onboarding opens on. */
    order?: KanjiOrderId;
    /** How many kanji of that order onboarding starts the visitor knowing. */
    known?: number;
}

/** The link into the app for a placement, with the setup it opens on. */
export function appUrl({ placement, path = '/', order, known }: AppLinkTarget): AppLink {
    const url = new URL(path, SITE_ORIGIN);
    if (order !== undefined) url.searchParams.set(SETUP_LINK_PARAMS.order, order);
    if (known !== undefined) url.searchParams.set(SETUP_LINK_PARAMS.known, String(known));
    url.searchParams.set('utm_source', DICTIONARY_SOURCE);
    url.searchParams.set('utm_content', placement);
    return { href: url.toString(), placement };
}
