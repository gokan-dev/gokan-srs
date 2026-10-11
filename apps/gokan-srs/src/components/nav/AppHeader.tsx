import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { Logo } from '../Logo';
import { SearchBar } from '../SearchBar';
import { Button } from '../ui/Button';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { useResponsive } from '../../context/Responsive/useResponsive';
import { HEADER_DESTINATIONS, SETTINGS, isDestinationActive } from '../../utils/navigation.utils';

/** Active: ink text and a 2px accent underline; inactive: secondary text, ink on hover. */
function navLinkClass(active: boolean): string {
    return `flex items-center h-full border-b-2 font-sans text-sm transition-colors ${
        active ? 'border-accent text-primary' : 'border-transparent text-secondary hover:text-primary'
    }`;
}

/**
 * The one app header. Its inner container has the `wide` page width, so the logo
 * and the navigation line up with the content edges.
 *
 * - From `md`: logo, the text links, then search and Settings on the right.
 *   Between `md` and `lg` search is an icon that opens the field.
 * - Below `md`: logo and a search icon; the destinations are in the bottom tab bar.
 * - Session focus mode (`/quiz`, `/grammar`): logo, search icon and "End session"
 *   only, which goes to the hub (leaving the activity ends its session).
 */
export function AppHeader({ focusMode }: { focusMode: boolean }) {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const { isMobile, isTablet } = useResponsive();
    const searchCollapsed = focusMode || isMobile || isTablet;

    return (
        <header className="w-full border-b border-divider bg-background">
            <div className="max-w-5xl mx-auto px-4 md:px-6 h-14 md:h-16 flex items-center gap-6">
                <Link to="/" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <Logo compact />
                </Link>

                {!focusMode && (
                    <nav aria-label="Main" className="hidden md:flex items-center gap-5 h-full">
                        {HEADER_DESTINATIONS.map(destination => (
                            <NavLink
                                key={destination.to}
                                to={destination.to}
                                className={() => navLinkClass(isDestinationActive(pathname, destination))}
                                aria-current={isDestinationActive(pathname, destination) ? 'page' : undefined}
                            >
                                {destination.label}
                            </NavLink>
                        ))}
                    </nav>
                )}

                <div className="flex-1" />

                <div className="flex items-center gap-3 h-full">
                    <SyncStatusIndicator />
                    <SearchBar collapsed={searchCollapsed} className={searchCollapsed ? '' : 'w-64 xl:w-80'} />
                    {!focusMode && (
                        <NavLink
                            to={SETTINGS.to}
                            aria-label="Settings"
                            className={() => `hidden md:flex gap-2 ${navLinkClass(isDestinationActive(pathname, SETTINGS))}`}
                        >
                            <UserRound size={18} aria-hidden="true" />
                            <span className="hidden lg:inline">Settings</span>
                        </NavLink>
                    )}
                    {focusMode && (
                        <Button variant="ghost" size="sm" onClick={() => void navigate('/')}>
                            End session
                        </Button>
                    )}
                </div>
            </div>
        </header>
    );
}
