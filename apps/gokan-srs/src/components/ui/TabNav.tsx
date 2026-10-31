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

/**
 * A scrolling row's divider: a 1px line drawn as its background, which stays put while the tabs
 * scroll, over its content box only, so a row bled to the screen's edges keeps the divider in line
 * with the page's content.
 */
const INSET_DIVIDER = 'bg-[linear-gradient(var(--color-divider),var(--color-divider))] bg-no-repeat bg-bottom bg-size-[100%_1px] bg-origin-content bg-clip-content';

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
 *   A page bleeds the row to the screen's edges (`PAGE_BLEED_INSET` from Page), so the tabs
 *   scroll under the edge and a tab cut there shows the row goes on. The gap is narrower on a
 *   phone: a wide one landing on the screen's edge would hide the next tab whole
 *   (check:layout measures it on the word pages).
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

    // Keeps the open tab in the row's view, inside its inline padding (a row bled to the screen's
    // edges pads itself back in line with the page), scrolling only the row: scrollIntoView would
    // also scroll the page to the row.
    useEffect(() => {
        const row = rowRef.current;
        const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
        if (!row || !tab) return;
        const style = getComputedStyle(row);
        const box = row.getBoundingClientRect();
        const left = box.left + parseFloat(style.paddingLeft);
        const right = box.right - parseFloat(style.paddingRight);
        const at = tab.getBoundingClientRect();
        if (at.left < left) row.scrollLeft -= left - at.left;
        else if (at.right > right) row.scrollLeft += at.right - right;
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
        <div ref={rowRef} role="tablist" aria-label={label} className={`flex gap-4 sm:gap-6 overflow-x-auto [scrollbar-width:none] ${INSET_DIVIDER} ${className}`}>
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
