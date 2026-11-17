import { parseSetupLink, withoutSetupParams, type SetupLink } from '../utils/setupLink.utils';

/**
 * Reads the setup parameters of the address the app opened on and removes them from it, once,
 * before the router starts (main.tsx): the router then reads the clean address, and it is done
 * before the deferred Umami script, whose history hook would count a later `replaceState` as a
 * second page view. What it read lives in memory only, until setup completes.
 */
export function takeSetupLink(): SetupLink {
    const { pathname, search, hash } = window.location;
    const link = parseSetupLink(search);
    const rest = withoutSetupParams(search);
    if (rest !== search) window.history.replaceState(window.history.state, '', `${pathname}${rest}${hash}`);
    return link;
}
