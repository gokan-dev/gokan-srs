import { pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => render(locals, () => pages().vocabJlptPage(Number(params.level), Number(params.page)));
export const entries: EntryGenerator = () => pages().pageEntries.vocabJlptPage();
