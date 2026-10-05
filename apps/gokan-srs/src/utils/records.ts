/**
 * The entries of a numerically keyed record (a JLPT level or KKLC step index). JSON
 * object keys are always strings, and Object.entries types such a record's values as
 * `any`; this restores both the number and the value type.
 */
export function numericEntries<T>(record: Readonly<Record<number, T>>): [number, T][] {
    return Object.keys(record).map(key => {
        const n = Number(key);
        return [n, record[n]];
    });
}
