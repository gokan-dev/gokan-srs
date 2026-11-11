import type { ParamMatcher } from '@sveltejs/kit';
import { servedLocaleNamed } from '$lib/locale';

/** A served locale by its name, English's included: a locale's sitemap (sitemap-en.xml). */
export const match: ParamMatcher = param => servedLocaleNamed(param) !== undefined;
