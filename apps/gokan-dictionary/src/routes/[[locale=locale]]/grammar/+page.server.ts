import { pages } from '$lib/server/dictionary';
import { render } from '$lib/server/route';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = event => render(event, locale => pages(locale).grammarIndexPage());
