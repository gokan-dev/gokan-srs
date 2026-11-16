import { isKanjiOrderId, type KanjiOrderId } from '@gokan/dataset-schema';
import { CONSTANTS } from '../commons/constants';
import type { AnalyticsEvent } from '../services/analytics';

/**
 * What a link into the app says about the visitor's setup (issue #243): the dictionary's range
 * and order pages link `/?order=kklc&known=300`, so onboarding opens on the book and count the
 * visitor was just reading. Only onboarding reads it: nothing is saved from the link alone, and a
 * learner who already finished setup never sees it.
 */
export interface SetupLink {
    order?: KanjiOrderId;
    /**
     * Kanji known, at least the setup minimum. Not capped at the order's length, which is known
     * only once its list loads: the kanji form caps it there (`countOf`, `SET_COUNT`).
     */
    known?: number;
    /** Where the visitor came from, for `setup_completed`: `dictionary-<placement>`, or `direct`. */
    source: string;
}

/** The query parameters onboarding reads and then removes from the address. */
const SETUP_PARAMS = ['order', 'known'] as const;

/** The dictionary's link placements (`utm_content`), so a stray value cannot invent a source. */
const DICTIONARY_PLACEMENTS: ReadonlySet<string> = new Set([
    'word', 'kanji', 'range', 'order', 'grammar', 'home', 'footer', 'about',
]);

const INTEGER = /^\d+$/;

/** Reads a link's query string; anything invalid is left out, so onboarding opens as it does without it. */
export function parseSetupLink(search: string): SetupLink {
    const params = new URLSearchParams(search);
    const link: SetupLink = { source: sourceOf(params) };
    const order = params.get('order');
    if (isKanjiOrderId(order)) link.order = order;
    const known = params.get('known')?.trim();
    if (known && INTEGER.test(known)) {
        link.known = Math.min(Math.max(Number(known), CONSTANTS.setup.minimumKanjiCount), CONSTANTS.setup.maximumKanjiCount);
    }
    return link;
}

function sourceOf(params: URLSearchParams): string {
    const placement = params.get('utm_content');
    return params.get('utm_source') === 'dictionary' && placement && DICTIONARY_PLACEMENTS.has(placement)
        ? `dictionary-${placement}`
        : 'direct';
}

/**
 * The query string without the setup parameters, so a reload or a shared address does not
 * carry them. The `utm_` ones stay: Umami's own UTM report reads them from the landing address.
 */
export function withoutSetupParams(search: string): string {
    const params = new URLSearchParams(search);
    for (const name of SETUP_PARAMS) params.delete(name);
    const rest = params.toString();
    return rest ? `?${rest}` : '';
}

/** The event Start learning sends: one per setup, with where the visitor came from. */
export function setupCompletedEvent(link: SetupLink): AnalyticsEvent {
    return { name: 'setup_completed', data: { source: link.source } };
}
