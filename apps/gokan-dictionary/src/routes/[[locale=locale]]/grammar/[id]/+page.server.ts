import { entityPages, entriesOf } from '$lib/server/dictionary';
import { ENTITY_PAGES_PRERENDERED } from '$lib/server/rendering';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

// Prerendered for the static deploy, or rendered on request (lib/server/rendering.ts).
export const prerender = ENTITY_PAGES_PRERENDERED;
export const load: PageServerLoad = event => render(event, locale => entityPages(locale).grammarPage(event.params.id));
export const entries: EntryGenerator = () => entriesOf(localePages => localePages.pageEntries.grammar());
