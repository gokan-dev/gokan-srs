import type { ParamMatcher } from '@sveltejs/kit';

/** A list's page number after the first, which has none: 2, 3... */
export const match: ParamMatcher = param => /^[1-9]\d*$/.test(param) && param !== '1';
