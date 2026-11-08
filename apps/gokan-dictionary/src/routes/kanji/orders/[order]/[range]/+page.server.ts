import { pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = event => render(event, () => pages().kanjiRangePage(event.params.order, event.params.range));
export const entries: EntryGenerator = () => pages().pageEntries.kanjiRange();
