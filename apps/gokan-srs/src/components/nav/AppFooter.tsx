import { Link } from 'react-router-dom';
import { DictionaryLink } from './DictionaryLink';

const LINK = 'font-sans text-sm text-accent hover:underline';

/** Desktop only: on a phone both links live in the More sheet. Not shown during a session. */
export function AppFooter() {
    return (
        <footer className="hidden md:block w-full border-t border-divider">
            <div className="max-w-5xl mx-auto px-6 py-6 flex items-center gap-6">
                <Link to="/about" className={LINK}>About Gokan SRS</Link>
                <DictionaryLink className={LINK} />
            </div>
        </footer>
    );
}
