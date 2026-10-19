import { TagChip } from "../../../components/TagChip";
import type { MixupTier } from "../../../utils/mixupGroups.utils";
import { TIER_LABEL } from "./tierLabels";

/** A pair's tier as a neutral chip, its sign beside its name (TIER_LABEL). */
export function TierChip({ tier }: { tier: MixupTier }) {
    const { sign, label } = TIER_LABEL[tier];
    return (
        <TagChip size="sm">
            <span aria-hidden="true" className="mr-1 font-sans">{sign}</span>
            {label}
        </TagChip>
    );
}
