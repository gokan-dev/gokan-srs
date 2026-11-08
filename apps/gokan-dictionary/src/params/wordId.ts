import type { ParamMatcher } from '@sveltejs/kit';

/** A word's id: digits, so /vocab/jlpt-n5/ is never read as a word. */
export const match: ParamMatcher = param => /^\d+$/.test(param);
