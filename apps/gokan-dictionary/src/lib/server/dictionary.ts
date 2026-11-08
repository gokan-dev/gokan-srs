// The dictionary's pages over the checkout: the one place a source of the dataset is chosen
// (dataset.server.ts's checkoutData, through the English view). Built on first use, so importing a
// route resolves no dataset.

import { checkoutData, resolveCompiledDir } from '../dataset.server';
import { pagesOf, type Pages } from './pages';

let built: Pages | null = null;

export function pages(): Pages {
    built ??= pagesOf(checkoutData(resolveCompiledDir()));
    return built;
}
