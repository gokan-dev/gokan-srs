import { pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => render(locals, () => pages().kanjiOrderPage(params.order));
export const entries: EntryGenerator = () => pages().pageEntries.kanjiOrder();
