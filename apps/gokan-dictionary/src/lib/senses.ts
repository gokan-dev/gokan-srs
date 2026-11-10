// How a word page presents its senses: numbered, in plain-English labels, the common ones first
// and the rare and archaic ones last, behind a disclosure. A word like 上 has 27 senses; a
// learner should not have to read an archaic "emperor" to find "above".

import { isRareSense, isTag, shortTagLabel } from '@gokan/dataset-schema';
import type { Sense } from '@gokan/dataset-schema';
import { valueText } from '@gokan/dataset-schema/text';
import type { WordText } from './types';

/** Senses shown before the "All N meanings" disclosure. */
export const VISIBLE_SENSES = 5;

export interface SenseView {
    /** 1-based, continuous across the visible, more and rare lists. */
    number: number;
    /** The part of speech ("Ichidan verb, Transitive"), only when it differs from the sense before. */
    pos?: string;
    glosses: string;
    /** Usage labels ("Honorific", "Colloquial"), shown after the glosses. */
    labels: string[];
}

export interface Meanings {
    visible: SenseView[];
    /** The other common senses, behind "All N meanings". */
    more: SenseView[];
    /** Senses `isRareSense` holds rare, behind "Rare and archaic meanings (N)". */
    rare: SenseView[];
}

/** "Usually kana" is said once, in the page header, rather than on each sense. */
const HEADER_TAGS: ReadonlySet<string> = new Set(['uk']);

function posLabel(sense: Sense): string {
    return sense.pos.filter(isTag).map(shortTagLabel).join(', ');
}

export function meaningsOf(senses: Sense[]): Meanings {
    const common = senses.filter(sense => !isRareSense(sense));
    const rare = senses.filter(isRareSense);

    let previousPos = '';
    const views = [...common, ...rare].map((sense, index): SenseView => {
        const pos = posLabel(sense);
        const view: SenseView = {
            number: index + 1,
            glosses: sense.glosses.join('; '),
            labels: sense.misc.rawTags.flatMap(tag => (isTag(tag) && !HEADER_TAGS.has(tag) ? [shortTagLabel(tag)] : [])),
            ...(pos && pos !== previousPos ? { pos } : {}),
        };
        previousPos = pos;
        return view;
    });

    return {
        visible: views.slice(0, Math.min(VISIBLE_SENSES, common.length)),
        more: views.slice(VISIBLE_SENSES, common.length),
        rare: views.slice(common.length),
    };
}

/**
 * A word's summary gloss on a page in another language (its header line, its title and
 * description): its first two equivalents, else its first definition's first sense. A list of
 * words takes the enumeration comma, one sense's glosses the semicolon, as its Meanings do.
 */
export function wordTextSummary(word: WordText): string {
    const equivalents = word.equivalents.slice(0, 2).map(equivalent => equivalent.text);
    if (equivalents.length > 0) return equivalents.join('、');
    return (word.definitions[0]?.senses[0]?.glosses ?? []).map(valueText).join('；');
}
