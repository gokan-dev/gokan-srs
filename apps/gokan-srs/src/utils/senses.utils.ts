import { RARE_SENSE_TAGS, isTag, shortTagLabel } from "@gokan/dataset-schema";
import type { Sense } from "@gokan/dataset-schema";

export interface ShownSense {
    sense: Sense;
    /** The sense's part-of-speech line, or null when it repeats the previous sense's. */
    posLabel: string | null;
}

/** The part-of-speech line of a sense: its short labels, joined. */
function posLabelOf(sense: Sense): string {
    return sense.pos.filter(isTag).map(shortTagLabel).join(', ');
}

/** An archaic, obsolete, rare or dated sense: listed apart on the word page, and given no Synonyms section unless every sense is (`synonymSections`). */
export function isRareSense(sense: Pick<Sense, 'misc'>): boolean {
    return sense.misc.isArchaic === true
        || sense.misc.isRare === true
        || sense.misc.rawTags.some(tag => isTag(tag) && RARE_SENSE_TAGS.includes(tag));
}

/** Marks each sense's part-of-speech line, shown only where it changes from the sense before. */
function withPosLabels(senses: Sense[]): ShownSense[] {
    let previous: string | null = null;
    return senses.map(sense => {
        const label = posLabelOf(sense);
        const shown = label !== '' && label !== previous ? label : null;
        previous = label;
        return { sense, posLabel: shown };
    });
}

/**
 * A word's meanings as the detail page lists them: the senses a learner meets,
 * then archaic, obsolete and rare ones in a group of their own.
 */
export function organizeSenses(senses: Sense[]): { common: ShownSense[]; rare: ShownSense[] } {
    return {
        common: withPosLabels(senses.filter(s => !isRareSense(s))),
        rare: withPosLabels(senses.filter(isRareSense)),
    };
}

/**
 * Each sense's number as the word's page lists it (organizeSenses: the common senses, then the
 * rare ones), by its index in `senses`: what a synonym group or "For meaning 1" refers to.
 */
export function senseNumbers(senses: readonly Pick<Sense, 'misc'>[]): number[] {
    const commonCount = senses.filter(s => !isRareSense(s)).length;
    let common = 0, rare = 0;
    return senses.map(s => (isRareSense(s) ? commonCount + ++rare : ++common));
}
