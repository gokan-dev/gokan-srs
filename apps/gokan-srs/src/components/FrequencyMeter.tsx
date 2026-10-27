import { FREQUENCY_BARS, type FrequencyBand } from "@gokan/dataset-schema";

const BAR_HEIGHTS = ['h-[5px]', 'h-[8px]', 'h-[11px]', 'h-[14px]'];

/**
 * How common a word is, as signal bars: as many filled as its band is common. Filled bars are
 * `secondary`, never accent: it is a fact about the word, not the learner's progress. The band's
 * name says it in words beside it, so the bars are hidden from screen readers.
 */
export function FrequencyMeter({ band }: { band: FrequencyBand }) {
    return (
        <span aria-hidden="true" className="inline-flex items-end gap-0.5 h-[14px]">
            {BAR_HEIGHTS.slice(0, FREQUENCY_BARS).map((height, i) => (
                <span key={height} className={`w-1 ${height} rounded-[1px] ${i < band.bars ? 'bg-secondary' : 'bg-divider'}`} />
            ))}
        </span>
    );
}
