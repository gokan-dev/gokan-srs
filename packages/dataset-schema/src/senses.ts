import { isTag, RARE_SENSE_TAGS } from './tags';
import type { Sense } from './vocabulary';

/**
 * An archaic, obsolete, rare or dated sense: listed apart on a word page (both apps), and given
 * no Synonyms section unless every sense is. gokan-dataset's synonym build hides the same ones.
 */
export function isRareSense(sense: Pick<Sense, 'misc'>): boolean {
    return sense.misc.isArchaic === true
        || sense.misc.isRare === true
        || sense.misc.rawTags.some(tag => isTag(tag) && RARE_SENSE_TAGS.includes(tag));
}

/**
 * A word page header's one-line answer: the first four distinct glosses of the common senses
 * (ここ lists "here" twice across its senses; the summary says it once), rare senses only after.
 */
export function summaryGloss(senses: readonly Sense[]): string {
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
