export interface Segment<K extends string> {
    key: K;
    /** Short, so four fit at 320px ("Sentences"), each segment as wide as its label needs. */
    label: string;
    /** The full name a screen reader hears with the count ("Example sentences"); it contains the label. */
    name: string;
    count: number;
    /** The id of the panel the segment opens. */
    controls: string;
}

interface SegmentedToggleProps<K extends string> {
    segments: Segment<K>[];
    /** The open segment, or none. */
    open: K | null;
    /** Pressing the open segment closes it: one choice at a time, which can be undone. */
    onToggle: (key: K) => void;
    label: string;
}

/**
 * One bordered group of segments, each a label over its count, at most one pressed. Each is
 * sized by its label (`flex-auto`), so the short ones give their spare room to the long ones
 * and no label is pressed against a divider at 320px. The size is always that of the semibold
 * label (an invisible semibold copy shares its grid cell), so pressing a segment, which turns
 * its label semibold, never moves the dividers. Single
 * choice that can be undone, so a toggle (`aria-pressed`), not tabs: nothing need be open.
 */
export function SegmentedToggle<K extends string>({ segments, open, onToggle, label }: SegmentedToggleProps<K>) {
    return (
        <div role="group" aria-label={label} className="flex rounded-md border border-divider divide-x divide-divider overflow-hidden">
            {segments.map(segment => {
                const pressed = segment.key === open;
                return (
                    <button
                        key={segment.key}
                        type="button"
                        onClick={() => onToggle(segment.key)}
                        aria-pressed={pressed}
                        aria-controls={segment.controls}
                        aria-label={`${segment.name}, ${segment.count.toLocaleString('en-US')}`}
                        className={`relative flex-auto min-w-0 min-h-[52px] px-1 py-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors duration-150 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${pressed ? 'bg-accent/12' : 'hover:bg-surface-hover'}`}
                    >
                        <span className="grid grid-cols-[minmax(0,1fr)] max-w-full">
                            <span data-segment-label className={`col-start-1 row-start-1 font-sans text-sm text-primary text-center truncate ${pressed ? 'font-semibold' : ''}`}>{segment.label}</span>
                            <span aria-hidden="true" className="col-start-1 row-start-1 invisible font-sans text-sm font-semibold truncate">{segment.label}</span>
                        </span>
                        <span className="type-meta tabular-nums">{segment.count.toLocaleString('en-US')}</span>
                        {pressed && <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                    </button>
                );
            })}
        </div>
    );
}
