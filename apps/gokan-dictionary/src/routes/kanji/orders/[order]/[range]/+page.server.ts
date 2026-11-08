import { pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => render(locals, () => pages().kanjiRangePage(params.order, params.range));
export const entries: EntryGenerator = () => pages().pageEntries.kanjiRange();
