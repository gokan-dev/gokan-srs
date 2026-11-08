import type { ParamMatcher } from '@sveltejs/kit';

/** A JLPT level, 1 to 5. */
export const match: ParamMatcher = param => /^[1-5]$/.test(param);
