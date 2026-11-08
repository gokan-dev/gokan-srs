import { pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { EntryGenerator, PageServerLoad } from './$types';

export const load: PageServerLoad = event => render(event, () => pages().grammarFamilyPage(event.params.id));
export const entries: EntryGenerator = () => pages().pageEntries.grammarFamily();
