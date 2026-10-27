/** The rank the dataset gives a word outside its frequency list (`frequency.kanjiRank`, `kanaRank`). */
export const UNRANKED = 999_999;

export type FrequencyBandName = 'Very common' | 'Common' | 'Less common' | 'Rare';

export interface FrequencyBand {
    name: FrequencyBandName;
    /** Signal bars filled, out of FREQUENCY_BARS: 4 for the most common words, 1 for rare ones. */
    bars: number;
    /** A round reference the rank sits within: "Top 300 words", "Beyond the top 50,000", "Not in the frequency list". */
    reference: string;
    /** The word has a place in the frequency list, so an exact rank can be shown beside the band. */
    ranked: boolean;
}

export const FREQUENCY_BARS = 4;

/** The band's upper rank, best first; a rank past the last is Rare. */
const BANDS: { name: FrequencyBandName; upTo: number }[] = [
    { name: 'Very common', upTo: 1_000 },
    { name: 'Common', upTo: 5_000 },
    { name: 'Less common', upTo: 15_000 },
];

/** Round sizes of a top list, so "#264" reads as "Top 300 words". */
const TOPS = [100, 200, 300, 500, 1_000, 2_000, 3_000, 5_000, 10_000, 15_000, 20_000, 30_000, 50_000];

/**
 * How common a word is, in words: a rank means nothing without the size of the list. `rank` is
 * 1-based; absent, not positive or UNRANKED is a word outside the list.
 */
export function frequencyBand(rank: number | null | undefined): FrequencyBand {
    const ranked = rank !== null && rank !== undefined && rank > 0 && rank !== UNRANKED;
    if (!ranked) return { name: 'Rare', bars: 1, reference: 'Not in the frequency list', ranked: false };
    const index = BANDS.findIndex(band => rank <= band.upTo);
    const top = TOPS.find(n => rank <= n);
    return {
        name: index === -1 ? 'Rare' : BANDS[index].name,
        bars: index === -1 ? 1 : FREQUENCY_BARS - index,
        reference: top === undefined ? `Beyond the top ${TOPS[TOPS.length - 1].toLocaleString('en-US')}` : `Top ${top.toLocaleString('en-US')} words`,
        ranked: true,
    };
}
