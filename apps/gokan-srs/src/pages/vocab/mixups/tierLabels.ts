import type { MixupTier } from "../../../utils/mixupGroups.utils";

/**
 * A pair's tier, as grading reads it. Neutral like every metadata chip; the three read
 * differently by their sign as well as their word, never by a colour.
 */
export const TIER_LABEL: Record<MixupTier, { sign: string; label: string; meaning: string }> = {
    interchangeable: {
        sign: '=',
        label: 'Interchangeable',
        meaning: 'Close in general. On a card that does not use the meaning they share, the other word is still accepted as close.',
    },
    confusable: {
        sign: '≈',
        label: 'Confusable',
        meaning: 'Close in one meaning only. When the card uses that meaning, the other word is accepted, unless the pair was marked distinct by hand. Otherwise it earns nothing and costs nothing.',
    },
    unrelated: {
        sign: '≠',
        label: 'Not a synonym',
        meaning: 'The dictionary gives the two words no meaning in common, which is why the answer was marked wrong.',
    },
};
