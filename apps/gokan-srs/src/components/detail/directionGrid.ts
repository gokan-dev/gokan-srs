/** The phone grid's columns, by how many directions it holds (whole class names, for Tailwind). */
const GRID_COLUMNS = ['grid-cols-1', 'grid-cols-2', 'grid-cols-3'] as const;

/** Your study's phone grid column class for `count` directions: one to three, never undefined (none still gets one column). */
export function directionGridColumns(count: number): typeof GRID_COLUMNS[number] {
    return GRID_COLUMNS[Math.min(Math.max(count, 1), GRID_COLUMNS.length) - 1];
}
