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

/**
 * How common it is on one line: the meter and the band's name, the round reference ("Top 300
 * words", "Top 500 kanji") and the exact rank in its title.
 */
export function HowCommon({ band, rank }: { band: FrequencyBand; rank: number | null | undefined }) {
    const title = band.ranked && rank ? `${band.reference}, rank ${rank.toLocaleString('en-US')}` : band.reference;
    return (
        <span className="inline-flex items-center gap-2 type-support" title={title}>
            <FrequencyMeter band={band} />
            {band.name}
        </span>
    );
}
