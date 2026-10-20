/** Whether a count change moves the grid: not on the first run (opening the page), nor when nothing changed. */
export function followsCountChange(previous: number | null, count: number, followCount: boolean): boolean {
    return followCount && previous !== null && previous !== count;
}
