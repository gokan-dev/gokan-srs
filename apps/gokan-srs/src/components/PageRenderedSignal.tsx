import React, { useEffect } from 'react';
import { useQuiz } from '../context/useQuiz';

/**
 * Rendered after the routes, inside their Suspense boundary: it commits only once the current
 * page's lazy chunk has loaded, and its effect runs after the page's own. The study flow's
 * background loads (the frequency index, the grammar preview) start from here, so they queue
 * behind the page's requests instead of ahead of them.
 */
export const PageRenderedSignal: React.FC = () => {
    const { markPageRendered } = useQuiz();
    useEffect(markPageRendered, [markPageRendered]);
    return null;
};
