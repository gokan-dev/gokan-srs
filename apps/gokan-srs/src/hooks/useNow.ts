import { useEffect, useState } from 'react';

/**
 * The current time (epoch ms), refreshed every `refreshMs`. Components read the
 * clock through this instead of calling Date.now() while rendering: a render must
 * not depend on when it happens to run, and a countdown should keep counting.
 */
export function useNow(refreshMs = 30_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), refreshMs);
        return () => clearInterval(timer);
    }, [refreshMs]);
    return now;
}
