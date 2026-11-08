import { pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, params }) => render(locals, () => pages().vocabJlptPage(Number(params.level), 1));
export const entries: EntryGenerator = () => pages().pageEntries.vocabJlpt();
