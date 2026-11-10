import { entriesOf, pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = event => render(event, locale => pages(locale).homePage());
export const entries: EntryGenerator = () => entriesOf(localePages => localePages.pageEntries.home());
