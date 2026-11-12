import { entityPages, entriesOf } from '#lib/server/dictionary.ts';
import { ENTITY_PAGES_PRERENDERED } from '#lib/server/rendering.ts';
import { render } from '#lib/server/route.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

// Prerendered for the static deploy, or rendered on request (lib/server/rendering.ts).
export const prerender = ENTITY_PAGES_PRERENDERED;
export const load: PageServerLoad = event => render(event, locale => entityPages(locale).kanjiPage(event.params.character));
export const entries: EntryGenerator = () => entriesOf(localePages => localePages.pageEntries.kanji());
