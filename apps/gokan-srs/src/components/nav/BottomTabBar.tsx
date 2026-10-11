import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart2, BookOpen, Ellipsis, House, Library, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DictionaryLink } from './DictionaryLink';
import { GRAMMAR, MORE_DESTINATIONS, STATS, STUDY, VOCABULARY, isDestinationActive, isMoreActive } from '../../utils/navigation.utils';
import type { NavDestination } from '../../utils/navigation.utils';

const TABS: { destination: NavDestination; icon: LucideIcon }[] = [
    { destination: STUDY, icon: House },
    { destination: VOCABULARY, icon: BookOpen },
    { destination: GRAMMAR, icon: Library },
    { destination: STATS, icon: BarChart2 },
];

function tabClass(active: boolean): string {
    return `flex-1 flex flex-col items-center justify-center gap-0.5 font-sans text-xs transition-colors ${
        active ? 'text-accent' : 'text-secondary hover:text-primary'
    }`;
}

/** The pages that do not fit the tab bar, in a sheet over it. */
function MoreSheet({ onClose }: { onClose: () => void }) {
    const { pathname } = useLocation();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const itemClass = (active: boolean) =>
        `flex items-center h-12 px-3 rounded-md font-sans text-base transition-colors hover:bg-surface-hover ${active ? 'text-accent' : 'text-primary'}`;

    return (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="More">
            <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 w-full h-full bg-primary/20 cursor-default" />
            <div className="absolute inset-x-0 bottom-0 bg-surface border-t border-divider rounded-t-md shadow-lg p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="type-subsection">More</h2>
                    <button type="button" onClick={onClose} aria-label="Close" autoFocus className="p-2 text-secondary hover:text-primary cursor-pointer">
                        <X size={18} />
                    </button>
                </div>
                <nav aria-label="More" className="flex flex-col">
                    {MORE_DESTINATIONS.map(destination => (
                        <Link key={destination.to} to={destination.to} onClick={onClose} className={itemClass(isDestinationActive(pathname, destination))}>
                            {destination.label}
                        </Link>
                    ))}
                    <DictionaryLink className={itemClass(false)} onClick={onClose} />
                </nav>
            </div>
        </div>
    );
}

/**
 * The phone navigation: a fixed bar of Study, Vocabulary, Grammar, Stats and
 * More, 56px plus the safe-area inset. `Page` pads its bottom to clear it.
 * Hidden from `md` up, where the header holds the links.
 */
export function BottomTabBar() {
    const { pathname } = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);

    return (
        <>
            <nav
                aria-label="Main"
                className="fixed inset-x-0 bottom-0 z-30 md:hidden bg-surface border-t border-divider pb-[env(safe-area-inset-bottom)]"
            >
                <div className="flex h-14">
                    {TABS.map(({ destination, icon: Icon }) => {
                        const active = isDestinationActive(pathname, destination);
                        return (
                            <Link key={destination.to} to={destination.to} className={tabClass(active)} aria-current={active ? 'page' : undefined}>
                                <Icon size={20} aria-hidden="true" />
                                {destination.label}
                            </Link>
                        );
                    })}
                    <button
                        type="button"
                        onClick={() => setMoreOpen(true)}
                        aria-expanded={moreOpen}
                        className={`${tabClass(isMoreActive(pathname))} cursor-pointer`}
                    >
                        <Ellipsis size={20} aria-hidden="true" />
                        More
                    </button>
                </div>
            </nav>
            {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
        </>
    );
}
