import { Link } from 'react-router-dom';
import { DictionaryLink } from './DictionaryLink';
import { APP_VERSION } from '../../services/release.service';
import { WHATS_NEW } from '../../utils/navigation.utils';

const LINK = 'font-sans text-sm text-accent hover:underline';

/**
 * The site's links, and the version this tab runs (What's new names it too).
 * Desktop only unless `alwaysVisible` is passed: on a phone its links are in the More sheet,
 * and the version is on About and What's new. Not shown during a session. `alwaysVisible` is
 * for the pages shown before setup (About, What's new), which have no tab bar, so the footer is
 * their only way on; its container then lines up with the header's at every width.
 */
export function AppFooter({ alwaysVisible = false }: { alwaysVisible?: boolean }) {
    return (
        <footer className={`${alwaysVisible ? 'block' : 'hidden md:block'} w-full border-t border-divider`}>
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 flex flex-wrap items-center gap-x-6 gap-y-2">
                <Link to="/about" className={LINK}>About Gokan SRS</Link>
                <DictionaryLink className={LINK} />
                <Link to={WHATS_NEW.to} className={LINK}>{WHATS_NEW.label}</Link>
                <span className="type-meta ml-auto" data-app-version>Version {APP_VERSION}</span>
            </div>
        </footer>
    );
}
