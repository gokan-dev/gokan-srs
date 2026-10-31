import { useEffect, useRef, type KeyboardEvent } from "react";
import { NavLink } from "react-router-dom";

/** A tab that is its own page: a link to its route. */
interface RouteTab {
    label: string;
    to: string;
}

/** A tab of one page: a button (`id`, which its panel names in `aria-labelledby`) showing its panel (`controls`, the panel's id) in place. */
export interface PageTab<K extends string> {
    key: K;
    label: string;
    id: string;
    controls: string;
}

interface RouteTabNavProps {
    tabs: RouteTab[];
    label: string;
    className?: string;
}

interface PageTabNavProps<K extends string> {
    tabs: PageTab<K>[];
    label: string;
    /** The open tab: one always is. */
    selected: K;
    onSelect: (key: K) => void;
    className?: string;
}

/**
 * A row's tabs: their underline overlaps the row's divider. A row that scrolls clips anything
 * outside it, so page tabs (`inset`) draw the divider as an inset line under the tabs instead.
 */
function tabClass(active: boolean, inset = false): string {
    return `${inset ? '' : '-mb-px '}py-2 border-b-2 font-sans text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-in-out ${
        active ? 'border-accent text-primary' : 'border-transparent text-secondary hover:text-primary'
    }`;
}

/** The tab a key moves to: Left / Right step (wrapping), Home / End jump to the ends. */
function stepTab(index: number, count: number, key: string): number | null {
    switch (key) {
        case 'ArrowRight': return (index + 1) % count;
        case 'ArrowLeft': return (index - 1 + count) % count;
        case 'Home': return 0;
        case 'End': return count - 1;
        default: return null;
    }
}

/**
 * Tabs, in one language (ink text and a 2px accent underline, as the header's navigation):
 * - route tabs (`to`), each its own page, so links, the active one the route showing;
 * - page tabs (`selected`), panels of one page (a word's Dict, Sentences...), so ARIA tabs:
 *   buttons with `role="tab"`, the arrow keys, Home and End moving between them. A row too wide
 *   for a phone scrolls sideways inside itself, the open tab kept in view; the page never does.
 */
export function TabNav<K extends string>(props: RouteTabNavProps | PageTabNavProps<K>) {
    if ('selected' in props) return <PageTabs {...props} />;
    const { tabs, label, className = '' } = props;
    return (
        <nav aria-label={label} className={`flex gap-6 border-b border-divider ${className}`}>
            {tabs.map(tab => (
                <NavLink key={tab.to} to={tab.to} end className={({ isActive }) => tabClass(isActive)}>
                    {tab.label}
                </NavLink>
            ))}
        </nav>
    );
}

function PageTabs<K extends string>({ tabs, label, selected, onSelect, className = '' }: PageTabNavProps<K>) {
    const rowRef = useRef<HTMLDivElement>(null);

    // Keeps the open tab in the row's view, scrolling only the row: scrollIntoView would also
    // scroll the page to the row.
    useEffect(() => {
        const row = rowRef.current;
        const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
        if (!row || !tab) return;
        const left = tab.offsetLeft - row.offsetLeft;
        const right = left + tab.offsetWidth;
        if (left < row.scrollLeft) row.scrollLeft = left;
        else if (right > row.scrollLeft + row.clientWidth) row.scrollLeft = right - row.clientWidth;
    }, [selected]);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const next = stepTab(index, tabs.length, event.key);
        if (next === null) return;
        event.preventDefault();
        const tab = tabs[next];
        onSelect(tab.key);
        document.getElementById(tab.id)?.focus();
    };

    return (
        <div ref={rowRef} role="tablist" aria-label={label} className={`flex gap-6 overflow-x-auto [scrollbar-width:none] shadow-[inset_0_-1px_0_var(--color-divider)] ${className}`}>
            {tabs.map((tab, index) => {
                const active = tab.key === selected;
                return (
                    <button
                        key={tab.key}
                        id={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        aria-controls={tab.controls}
                        tabIndex={active ? 0 : -1}
                        onClick={() => onSelect(tab.key)}
                        onKeyDown={event => onKeyDown(event, index)}
                        className={`shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${tabClass(active, true)}`}
                    >
                        {tab.label}
                    </button>
                );
            })}
        </div>
    );
}
