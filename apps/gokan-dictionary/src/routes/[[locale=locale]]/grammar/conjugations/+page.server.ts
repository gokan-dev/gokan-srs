import { pages } from '#lib/server/dictionary.ts';
import { render } from '#lib/server/route.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = event => render(event, locale => pages(locale).grammarConjugationsIndexPage());
