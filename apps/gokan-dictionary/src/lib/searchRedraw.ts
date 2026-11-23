/**
 * Whether a search list is drawn again when more of the index arrives (the long-tail file, after
 * the first query): only while the reader has not moved in it, that is not scrolled it and not
 * drawn past its first page. A list drawn on scroll once had no first page to lose; redrawing it
 * then sent a reader who had scrolled back to its top, with rows moved as the long tail merged into
 * frequency order. A list kept as it is still answers the next query from the whole index.
 * `drawn` is 0 before anything is drawn (the core arriving), which always draws.
 */
export function redrawOnIndexChange({ drawn, pageSize, scrolled }: { drawn: number; pageSize: number; scrolled: number }): boolean {
    return drawn <= pageSize && scrolled <= 0;
}
