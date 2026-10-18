// A count with its noun, the way every page writes one: "1 word", "1,000 words".

/** `n` with `noun` in the singular for exactly one, else with an s; the number grouped as in English. */
export function countLabel(n: number, noun: string): string {
    return `${n.toLocaleString('en')} ${noun}${n === 1 ? '' : 's'}`;
}
