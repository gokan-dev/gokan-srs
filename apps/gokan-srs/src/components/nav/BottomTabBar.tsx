import { useCallback, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart2, BookOpen, Ellipsis, House, Library } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DictionaryLink } from './DictionaryLink';
import { BottomSheet } from '../ui/BottomSheet';
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

    const itemClass = (active: boolean) =>
        `flex items-center h-12 px-3 rounded-md font-sans text-base transition-colors hover:bg-surface-hover ${active ? 'text-accent' : 'text-primary'}`;

    return (
        <BottomSheet label="More" onClose={onClose} className="md:hidden">
            <nav aria-label="More" className="flex flex-col">
                {MORE_DESTINATIONS.map(destination => (
                    <Link key={destination.to} to={destination.to} onClick={onClose} className={itemClass(isDestinationActive(pathname, destination))}>
                        {destination.label}
                    </Link>
                ))}
                <DictionaryLink className={itemClass(false)} onClick={onClose} />
            </nav>
        </BottomSheet>
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
    // Stable, so the sheet's Esc listener is not re-attached on every render.
    const closeMore = useCallback(() => setMoreOpen(false), []);

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
            {moreOpen && <MoreSheet onClose={closeMore} />}
        </>
    );
}
