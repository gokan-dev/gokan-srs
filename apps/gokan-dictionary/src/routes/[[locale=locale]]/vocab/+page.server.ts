import { entriesOf, pages } from '#lib/server/dictionary.ts';
import { render } from '#lib/server/route.ts';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = event => render(event, locale => pages(locale).vocabIndexPage());
export const entries: EntryGenerator = () => entriesOf(localePages => localePages.pageEntries.vocabIndex());
