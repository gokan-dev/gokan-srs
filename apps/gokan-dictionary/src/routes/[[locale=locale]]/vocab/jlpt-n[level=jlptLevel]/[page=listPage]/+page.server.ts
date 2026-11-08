import { entriesOf, pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = event => render(event, locale => pages(locale).vocabJlptPage(Number(event.params.level), Number(event.params.page)));
export const entries: EntryGenerator = () => entriesOf(localePages => localePages.pageEntries.vocabJlptPage());
