// How a word page presents its senses: numbered, in plain-English labels, the common ones first
// and the rare and archaic ones last, behind a disclosure. A word like 上 has 27 senses; a
// learner should not have to read an archaic "emperor" to find "above".

import { isTag, RARE_SENSE_TAGS, shortTagLabel } from '@gokan/dataset-schema';
import type { Sense } from '@gokan/dataset-schema';

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
    /** Senses tagged with RARE_SENSE_TAGS, behind "Rare and archaic meanings (N)". */
    rare: SenseView[];
}

/** "Usually kana" is said once, in the page header, rather than on each sense. */
const HEADER_TAGS: ReadonlySet<string> = new Set(['uk']);

function isRareSense(sense: Sense): boolean {
    return sense.misc.isArchaic === true || sense.misc.isRare === true
        || sense.misc.rawTags.some(tag => isTag(tag) && RARE_SENSE_TAGS.includes(tag));
}

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
 * The header's one-line answer: the first four distinct glosses of the common senses (ここ lists
 * "here" twice across its senses; the summary says it once).
 */
export function summaryGloss(senses: Sense[]): string {
    const seen = new Set<string>();
    const glosses: string[] = [];
    const ordered = [...senses.filter(sense => !isRareSense(sense)), ...senses.filter(isRareSense)];
    for (const gloss of ordered.flatMap(sense => sense.glosses)) {
        const key = gloss.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        glosses.push(gloss);
        if (glosses.length === 4) break;
    }
    return glosses.join('; ');
}
