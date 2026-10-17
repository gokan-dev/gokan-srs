import { useLocation } from 'react-router-dom';
import { routeSeo } from '../utils/seo.utils';

/**
 * The current route's canonical (and og:url), or its noindex. Rendered once, by App, above every
 * gate (onboarding included, which is what a crawler sees first); React 19 hoists these tags into
 * <head> and removes them when the route changes. The origin is the page's own, so staging names
 * staging, as the dictionary does.
 */
export function RouteSeo() {
    const { pathname } = useLocation();
    const seo = routeSeo(pathname);
    switch (seo.kind) {
        case 'canonical': {
            const url = new URL(seo.path, window.location.origin).toString();
            return (
                <>
                    <link rel="canonical" href={url} />
                    <meta property="og:url" content={url} />
                </>
            );
        }
        case 'noindex':
            return <meta name="robots" content="noindex" />;
    }
}
